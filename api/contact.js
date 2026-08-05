// api/contact.js — Vercel Serverless Function
// Envoie un email via Resend + sauvegarde la demande de réservation dans Vercel KV

const { kv } = require('@vercel/kv');

const RESERVATIONS_KEY = 'reservations';

async function saveReservationToKV(reservation) {
  try {
    const data = await kv.get(RESERVATIONS_KEY);
    const reservations = Array.isArray(data) ? data : [];
    reservations.unshift(reservation);
    if (reservations.length > 500) reservations.length = 500;
    await kv.set(RESERVATIONS_KEY, reservations);
  } catch (err) {
    // Ne pas bloquer l'envoi email si KV échoue
    console.warn('KV save warning:', err.message);
  }
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, dateStart, dateEnd, guests, typeLogement, message, marketingConsent, honeypot } = req.body || {};

    // Anti-spam honeypot
    if (honeypot) return res.status(200).json({ success: true });

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Nom et email obligatoires' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const dateFormatted = dateStart
      ? new Date(dateStart).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Non précisée';
    const timeFormatted = dateEnd || 'Non précisée';

    // Sauvegarder la réservation dans KV (avant l'email, pour être sûr)
    const reservation = {
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      email,
      phone: phone || '',
      dateStart: dateStart || '',
      dateEnd: dateEnd || '',
      guests: guests || '2',
      typeLogement: typeLogement || 'Non précisé',
      message: message || '',
      marketingConsent: marketingConsent === true,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    await saveReservationToKV(reservation);

    // Configurer Resend
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY non configuré. Mode simulation (seul le KV est sauvé).');
    } else {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const subjectLine = dateStart
        ? `🍽️ Nouvelle demande de ${name} — ${dateFormatted}`
        : `📩 Nouveau message de ${name} — Les Archers`;

      // CONTACT_EMAIL env var a toujours la priorité — KV n'est qu'un fallback
      let adminEmailConfig = process.env.CONTACT_EMAIL;
      console.log('[contact] CONTACT_EMAIL env =', adminEmailConfig);
      if (!adminEmailConfig) {
        try {
          const settings = await kv.get('admin_settings');
          if (settings && settings.receiveEmail) {
            adminEmailConfig = settings.receiveEmail;
            console.log('[contact] KV fallback adminEmail =', adminEmailConfig);
          }
        } catch (err) {
          console.warn('Erreur RECUP KV Settings Email:', err);
        }
      }

      console.log('[contact] Admin email destination finale =', adminEmailConfig);
      if (!adminEmailConfig) {
        console.error("ERREUR : CONTACT_EMAIL non configuré dans Vercel.");
        return res.status(500).json({ success: false, error: "Configuration email manquante." });
      }

      // ── Email au propriétaire ──
      const { data, error: ownerError } = await resend.emails.send({
        from: 'Les Archers <noreply@lesarchersvoiron.fr>',
        to: [adminEmailConfig],
        reply_to: email,
        subject: subjectLine,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2E3D2F;">
            <div style="background: #C4704D; padding: 32px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">Nouvelle demande de réservation</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Les Archers</p>
            </div>
            <div style="background: #FDFBF7; padding: 32px; border: 1px solid #EDE7D9; border-top: none; border-radius: 0 0 8px 8px;">
              <table style="width:100%; border-collapse: collapse;">
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold; width: 40%;">Nom</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;">${name}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold;">Email</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;"><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold;">Téléphone</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;">${phone || 'Non renseigné'}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold;">Motif</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;">${typeLogement || 'Non précisé'}</td></tr>
                ${dateStart ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold;">Date souhaitée</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;">${dateFormatted}</td></tr>` : ''}
                ${dateEnd ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold;">Heure souhaitée</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;">${timeFormatted}</td></tr>` : ''}
                ${guests ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9; font-weight: bold;">Personnes</td><td style="padding: 10px 0; border-bottom: 1px solid #EDE7D9;">${guests}</td></tr>` : ''}
                <tr><td style="padding: 10px 0; font-weight: bold; vertical-align: top;">Message</td><td style="padding: 10px 0;">${message ? message.replace(/\n/g, '<br>') : 'Aucun message'}</td></tr>
              </table>
              <div style="margin-top: 24px; padding: 16px; background: #F9F5EE; border-radius: 6px; font-size: 14px; color: #938E85;">
                Répondre directement à cet email contactera <strong>${email}</strong>
              </div>
            </div>
          </div>
        `
      });

      if (ownerError) {
        console.error("ERREUR RESEND (Admin notification):", JSON.stringify(ownerError, null, 2));
        // On ne bloque plus la requête si Resend est en Sandbox, car la réservation est déjà sauvée dans KV.
        // On renvoie un header custom ou on continue simplement pour que le visiteur ait un message de succès.
      }

      // ── Email de confirmation au visiteur ──
      const { error: visitorError } = await resend.emails.send({
        from: 'Les Archers <noreply@lesarchersvoiron.fr>',
        to: [email],
        subject: `Votre demande a bien été reçue — Les Archers`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2E3D2F;">
            <div style="background: #2E3D2F; padding: 32px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 22px;">Bonjour ${name},</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Nous avons bien reçu votre demande et reviendrons vers vous très prochainement.</p>
            </div>
            <div style="background: #FDFBF7; padding: 32px; border: 1px solid #EDE7D9; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 24px; line-height: 1.6;">
                Merci pour votre intérêt pour <strong>Les Archers</strong>.
                ${dateStart
            ? ` Nous reviendrons vers vous dans les plus brefs délais pour confirmer votre réservation le <strong>${dateFormatted}</strong>${dateEnd ? ` à <strong>${timeFormatted}</strong>` : ''}.`
            : ' Notre équipe vous contactera très prochainement.'
          }
              </p>

              <div style="background: #fff; border: 1px solid #EDE7D9; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #C4704D; font-weight: bold;">Récapitulatif de votre demande</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                  <tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85; width: 40%;">Nom</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; font-weight: 600;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85;">Email</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0;">${email}</td>
                  </tr>
                  ${phone ? `<tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85;">Téléphone</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0;">${phone}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85;">Motif</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0;">${typeLogement || 'Non précisé'}</td>
                  </tr>
                  ${dateStart ? `<tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85;">Date souhaitée</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0;">${dateFormatted}</td>
                  </tr>` : ''}
                  ${dateEnd ? `<tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85;">Heure souhaitée</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0;">${timeFormatted}</td>
                  </tr>` : ''}
                  ${guests ? `<tr>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0; color: #938E85;">Personnes</td>
                    <td style="padding: 9px 0; border-bottom: 1px solid #F0EBE0;">${guests}</td>
                  </tr>` : ''}
                  ${message ? `<tr>
                    <td style="padding: 9px 0; color: #938E85; vertical-align: top;">Message</td>
                    <td style="padding: 9px 0; line-height: 1.5;">${message.replace(/\n/g, '<br>')}</td>
                  </tr>` : ''}
                </table>
              </div>

              <div style="background: #FDF6EF; border-left: 3px solid #C4704D; padding: 14px 18px; border-radius: 0 6px 6px 0; margin-bottom: 24px; font-size: 14px; color: #6B5744;">
                Si vous avez des questions, répondez directement à cet email ou contactez-nous à <strong>${adminEmailConfig}</strong>.
              </div>

              <p style="font-size: 12px; color: #C8C3BB; margin: 0; text-align: center;">Les Archers · 04 76 05 00 42 · lesarchersvoiron.fr</p>
            </div>
          </div>
        `
      });

      if (visitorError) {
        console.error('[contact] ERREUR RESEND email visiteur:', JSON.stringify(visitorError));
      } else {
        console.log('[contact] Email confirmation visiteur envoyé à:', email);
      }
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('ERREUR CRITIQUE Contact API:', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer ou nous contacter par email.' });
  }
};
