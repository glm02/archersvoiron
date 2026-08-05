// api/newsletter.js — Inscription newsletter
//  • POST  { email, consent, source, honeypot }  → enregistre l'inscrit dans Vercel KV
//                                                   + email de bienvenue (code ARCHERS10)
//  • GET   (x-admin-token = ADMIN_TOKEN)          → liste des inscrits (pour l'admin)
//
// Stockage : KV clé 'newsletter_subscribers' = tableau d'objets { email, createdAt, source }.
// Resilience : si KV ou Resend échoue, on ne perd pas l'inscription (best-effort sur l'email).

const { kv } = require('@vercel/kv');

const SUBSCRIBERS_KEY = 'newsletter_subscribers';
const FROM = 'Les Archers <noreply@lesarchersvoiron.fr>';
const IMG_BASE = 'https://www.lesarchersvoiron.fr';
const HERO_IMG = `${IMG_BASE}/photo/bar-interieur.webp`;
const LOYALTY_CODE = 'ARCHERS10';

function isAdmin(req) {
  const adminToken = (req.headers['x-admin-token'] || '').trim();
  const tokenHash = ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim();
  return !!(adminToken && tokenHash && adminToken === tokenHash);
}

function welcomeEmailHtml() {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting">
<title>Bienvenue à Les Archers</title></head>
<body style="margin:0;padding:0;background:#EDE6D6;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDE6D6;font-size:1px;">Votre code -10 % vous attend pour votre prochain séjour.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE6D6;">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FDFBF7;border-radius:18px;overflow:hidden;border:1px solid #E7DECC;">
      <tr><td style="padding:0;line-height:0;font-size:0;"><img src="${HERO_IMG}" width="600" alt="Les Archers" style="display:block;width:100%;max-width:600px;height:200px;object-fit:cover;border:0;"></td></tr>
      <tr><td style="background:#2E3D2F;padding:30px 40px;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C4A57B;">Bienvenue dans notre cercle</p>
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:bold;line-height:1.25;color:#ffffff;">Merci de votre inscription</h1>
        <p style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:#D7C7AE;">Quelques nouvelles par an du domaine, et nos attentions réservées aux fidèles.</p>
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:#C4704D;">&nbsp;</td></tr>
      <tr><td style="padding:36px 40px 8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;color:#3E352B;">
        <p style="margin:0 0 18px;">Vous recevrez les plus belles saisons de Les Archers, nos disponibilités et nos offres réservées à nos abonnés.</p>
        <p style="margin:0 0 8px;">Pour vous remercier, voici <strong>10 % de réduction</strong> sur votre prochain séjour :</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:14px 0 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed #C4704D;border-radius:12px;background:#FDF6EF;"><tr><td style="padding:18px 40px;text-align:center;">
            <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#C4704D;font-weight:bold;">Votre code fidélité</span>
            <span style="display:block;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:bold;color:#2E3D2F;letter-spacing:3px;margin-top:6px;">${LOYALTY_CODE}</span>
          </td></tr></table>
        </td></tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 6px;">
          <a href="${IMG_BASE}/#contact" style="display:inline-block;background:#2E3D2F;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:15px 40px;border-radius:10px;">Réserver ma table</a>
        </td></tr></table>
        <p style="margin:24px 0 0;">À très bientôt,<br><span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#2E3D2F;">L'équipe des Archers</span></p>
      </td></tr>
      <tr><td style="padding:8px 40px 0;"><div style="border-top:1px solid #ECE3D2;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:22px 40px 34px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;color:#9A917F;text-align:center;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6B5744;font-weight:bold;">Les Archers</span><br>
        1157 Place du Général Leclerc · 38500 Voiron · Alpes-de-Haute-Provence<br>
        <a href="tel:+33476050042" style="color:#9A917F;text-decoration:none;">+33 6 06 79 23 93</a> &nbsp;·&nbsp;
        <a href="https://www.lesarchersvoiron.fr" style="color:#C4704D;text-decoration:none;font-weight:bold;">lesarchersvoiron.fr</a>
      </td></tr>
    </table>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr>
      <td style="padding:14px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#B0A793;">© ${year} Les Archers — Voiron, Provence</td>
    </tr></table>
  </td></tr>
</table>
</body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Liste des inscrits (admin) ──
  if (req.method === 'GET') {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Non autorisé' });
    try {
      const data = await kv.get(SUBSCRIBERS_KEY);
      const subscribers = Array.isArray(data) ? data : [];
      return res.status(200).json({ count: subscribers.length, subscribers });
    } catch (err) {
      return res.status(500).json({ error: 'KV indisponible: ' + err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, consent, source, honeypot } = req.body || {};

    // Anti-spam honeypot
    if (honeypot) return res.status(200).json({ success: true });

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    // Enregistrer dans KV (dédoublonnage)
    let alreadySubscribed = false;
    try {
      const data = await kv.get(SUBSCRIBERS_KEY);
      const subscribers = Array.isArray(data) ? data : [];
      if (subscribers.some(s => (s.email || '').toLowerCase() === cleanEmail)) {
        alreadySubscribed = true;
      } else {
        subscribers.unshift({
          email: cleanEmail,
          createdAt: new Date().toISOString(),
          source: source || 'site',
          consent: consent === true,
        });
        if (subscribers.length > 5000) subscribers.length = 5000;
        await kv.set(SUBSCRIBERS_KEY, subscribers);
      }
    } catch (err) {
      console.warn('[newsletter] KV save warning:', err.message);
    }

    // Email de bienvenue (uniquement pour un nouvel inscrit)
    if (!alreadySubscribed && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: FROM,
          to: [cleanEmail],
          subject: 'Bienvenue 🌿 + votre code -10 % — Les Archers',
          html: welcomeEmailHtml(),
        });
      } catch (err) {
        console.warn('[newsletter] Email bienvenue échoué:', err.message);
      }
    }

    return res.status(200).json({ success: true, alreadySubscribed });
  } catch (err) {
    console.error('ERREUR Newsletter API:', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
};
