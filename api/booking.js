// api/booking.js — Tunnel de réservation (devis + paiement Stripe)
//  POST { action: 'logements' }                         -> catalogue (id, nom, capacite, prix)
//  POST { action: 'quote', logementId, arrivee, depart, nb_pers } -> dispo + prix
//  POST { action: 'checkout', ... } (Authorization: Bearer <token Supabase>) -> URL Stripe Checkout
//
// Lecture/écriture Supabase via la clé service (serveur uniquement).
// Paiement TOTAL. Anti-double-réservation garanti par la contrainte d'exclusion en base.

const SUPABASE_URL = process.env.SUPABASE_URL || ''; // pas encore de projet Supabase pour Les Archers
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const SITE = (process.env.SITE_URL || 'https://www.lesarchersvoiron.fr').replace(/\/$/, '');
const DISCOUNTS = { ARCHERS10: 0.10 };

function sb(path, opts) {
  opts = opts || {};
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    headers: Object.assign({
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    }, opts.headers || {}),
    body: opts.body,
  });
}

function nights(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

async function verifyUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function quote(logementId, arrivee, depart, nbPers, code) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  nbPers = parseInt(nbPers, 10);
  if (!UUID.test(String(logementId || ''))) return { error: 'Logement invalide' };
  if (!DATE.test(String(arrivee || '')) || !DATE.test(String(depart || ''))) return { error: 'Dates invalides' };
  if (!Number.isInteger(nbPers) || nbPers < 1 || nbPers > 50) return { error: 'Nombre de personnes invalide' };
  const lr = await sb(`logements?id=eq.${logementId}&select=*`);
  const lg = (await lr.json())[0];
  if (!lg) return { error: 'Logement introuvable' };
  const n = nights(arrivee, depart);
  const today = new Date().toISOString().slice(0, 10);
  if (!arrivee || !depart || n < 1) return { error: 'Dates invalides' };
  if (arrivee < today) return { error: 'La date d\'arrivée est passée' };
  if (nbPers < 1 || nbPers > lg.capacite) return { error: `Ce logement accueille ${lg.capacite} personne(s) maximum` };
  if (n < lg.nb_nuits_min) return { error: `Séjour minimum : ${lg.nb_nuits_min} nuit(s)` };

  const tr = await sb(`tarifs?logement_id=eq.${logementId}&select=*`);
  const tarifs = await tr.json();
  const tarif = (Array.isArray(tarifs) ? tarifs : []).find(t => t.date_debut <= arrivee && t.date_fin >= depart) || (tarifs || [])[0];
  if (!tarif) return { error: 'Tarif indisponible pour ces dates' };
  const total = n * (Number(tarif.prix_nuit) + nbPers * Number(tarif.prix_personne || 0));

  // Disponibilité : blocages + réservations en cours
  const br = await sb(`blocages?logement_id=eq.${logementId}&plage=ov.[${arrivee},${depart})&select=id`);
  const bl = await br.json();
  if (Array.isArray(bl) && bl.length) return { available: false, error: 'Ces dates ne sont pas disponibles' };
  const rr = await sb(`reservations?logement_id=eq.${logementId}&statut=in.(pending,confirmed)&select=arrivee,depart`);
  const rv = await rr.json();
  const overlap = (Array.isArray(rv) ? rv : []).some(r => r.arrivee < depart && r.depart > arrivee);
  if (overlap) return { available: false, error: 'Ces dates ne sont pas disponibles' };

  const pct = DISCOUNTS[(code || '').trim().toUpperCase()] || 0;
  const discount = Math.round(total * pct * 100) / 100;
  const totalFinal = Math.round((total - discount) * 100) / 100;
  return { available: true, nights: n, total, discount, totalFinal, codeValid: pct > 0, logementNom: lg.nom, prixNuit: Number(tarif.prix_nuit) };
}

// ---- Retour Stripe (anciennement booking-success) ----
const OWNER_EMAIL = (process.env.CONTACT_EMAIL || 'lesarchersvoiron@gmail.com').trim();
const FROM = 'Les Archers <noreply@lesarchersvoiron.fr>';
const LOG_PHOTO = {
  magnan: '/photo/magnan/1.webp',
  giono: '/photo/chambre%20giono/photo%20a%20mettre%20en%20avant.webp',
  mistral: '/photo/mistral/1.webp',
  duplex: '/photo/studio/WhatsApp%20Image%202026-05-31%20at%2020.44.22.webp',
  arene: '/photo/chambre%20arene/WhatsApp%20Image%202026-05-31%20at%2020.43.54.webp',
  cedre: '/photo/cedres/1.webp',
  pagnol: '/photo/pagnol/3.webp',
};
function logPhoto(nom) {
  const t = (nom || '').toLowerCase();
  const key = Object.keys(LOG_PHOTO).find(k => t.indexOf(k) >= 0);
  return 'https://www.lesarchersvoiron.fr' + (key ? LOG_PHOTO[key] : '/photo/herobannerultraqualit%C3%A9.jpg');
}
function dfmt(d) { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }
function nomOf(r) { return (r.logements && r.logements.nom) || 'Séjour'; }
function sumRows(rows) { return rows.reduce((s, r) => s + Number(r.montant_total || 0), 0).toFixed(2); }
function rowsTable(rows) {
  return rows.map(r => `<tr><td style="padding:10px 0;border-bottom:1px solid #F0EBE0;font-weight:bold;">${nomOf(r)}</td><td style="padding:10px 0;border-bottom:1px solid #F0EBE0;">${dfmt(r.arrivee)} → ${dfmt(r.depart)} · ${r.nb_pers} pers.</td><td style="padding:10px 0;border-bottom:1px solid #F0EBE0;text-align:right;font-weight:bold;">${Number(r.montant_total).toFixed(2)} €</td></tr>`).join('');
}
function clientEmailHtml(rows) {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#3E352B;">
    <img src="${logPhoto(nomOf(rows[0]))}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:200px;object-fit:cover;border-radius:14px 14px 0 0;">
    <div style="background:#2E3D2F;padding:26px 34px;"><h1 style="margin:0;color:#fff;font-size:22px;">Réservation confirmée</h1><p style="margin:8px 0 0;color:#D7C7AE;">Merci ${rows[0].nom || ''}, votre paiement a bien été reçu.</p></div>
    <div style="height:4px;background:#C4704D;"></div>
    <div style="background:#FDFBF7;padding:30px 34px;border:1px solid #E7DECC;border-top:none;border-radius:0 0 14px 14px;line-height:1.7;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rowsTable(rows)}<tr><td colspan="2" style="padding:12px 0;font-weight:bold;">Total payé</td><td style="padding:12px 0;text-align:right;font-weight:bold;font-size:16px;">${sumRows(rows)} €</td></tr></table>
      <p style="margin:22px 0 0;">Nous avons hâte de vous accueillir à Les Archers. À très bientôt !</p>
      <p style="margin:18px 0 0;font-size:18px;color:#2E3D2F;">L'équipe des Archers</p>
      <p style="font-size:12px;color:#C8C3BB;margin:26px 0 0;text-align:center;">Les Archers · Voiron 38500 · lesarchersvoiron.fr</p>
    </div></div>`;
}
function ownerEmailHtml(rows) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#2E3D2F;">
    <div style="background:#C4704D;padding:24px 32px;border-radius:8px 8px 0 0;"><h1 style="margin:0;color:#fff;font-size:20px;">Nouvelle réservation payée</h1></div>
    <div style="background:#FDFBF7;padding:24px 32px;border:1px solid #EDE7D9;border-top:none;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 12px;"><strong>Client :</strong> ${rows[0].nom || '—'} (${rows[0].email})</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rowsTable(rows)}<tr><td colspan="2" style="padding:12px 0;font-weight:bold;">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;">${sumRows(rows)} €</td></tr></table>
    </div></div>`;
}
function redirectHome(res, okPaid) {
  res.statusCode = 302;
  res.setHeader('Location', `${SITE}/#compte?paid=${okPaid ? '1' : '0'}`);
  res.end();
}
async function handleSuccess(req, res) {
  const sessionId = (req.query && req.query.session_id) || '';
  if (!sessionId || !STRIPE_SECRET || !SERVICE) return redirectHome(res, false);
  try {
    const sr = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } });
    const session = await sr.json();
    if (!sr.ok || session.payment_status !== 'paid') return redirectHome(res, false);
    const meta = session.metadata || {};
    const ids = String(meta.reservation_ids || meta.reservation_id || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!ids.length) return redirectHome(res, false);
    const rr = await sb(`reservations?id=in.(${ids.join(',')})&select=*,logements(nom)`);
    const rows = await rr.json();
    if (!Array.isArray(rows) || !rows.length) return redirectHome(res, false);
    if (!rows.filter(r => r.statut !== 'confirmed').length) return redirectHome(res, true);
    await sb(`reservations?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify({ statut: 'confirmed' }) });
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({ from: FROM, to: [rows[0].email], subject: 'Votre réservation est confirmée — Les Archers', html: clientEmailHtml(rows) });
        await resend.emails.send({ from: FROM, to: [OWNER_EMAIL], reply_to: rows[0].email, subject: `Nouvelle réservation payée — ${rows.length > 1 ? rows.length + ' logements' : nomOf(rows[0])}`, html: ownerEmailHtml(rows) });
      } catch (e) { }
    }
    return redirectHome(res, true);
  } catch (err) { return redirectHome(res, false); }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return handleSuccess(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configuré' });

  const { action } = req.body || {};

  try {
    // Libère les réservations "en attente" expirées (paiement abandonné)
    await sb(`reservations?statut=eq.pending&expires_at=lt.${new Date().toISOString()}`, { method: 'DELETE' });

    if (action === 'logements') {
      const lr = await sb('logements?actif=eq.true&select=id,nom,type,capacite,nb_nuits_min&order=nom');
      const ls = await lr.json();
      const tr = await sb('tarifs?select=logement_id,prix_nuit');
      const ts = await tr.json();
      const prix = {};
      (Array.isArray(ts) ? ts : []).forEach(t => { const p = Number(t.prix_nuit); if (prix[t.logement_id] == null || p < prix[t.logement_id]) prix[t.logement_id] = p; });
      const out = (Array.isArray(ls) ? ls : []).map(l => ({ id: l.id, nom: l.nom, type: l.type, capacite: l.capacite, nb_nuits_min: l.nb_nuits_min, prix_nuit: prix[l.id] || null }));
      return res.status(200).json({ logements: out });
    }

    if (action === 'quote') {
      const { logementId, arrivee, depart, nb_pers } = req.body;
      if (!logementId || !arrivee || !depart) return res.status(400).json({ error: 'Paramètres manquants' });
      return res.status(200).json(await quote(logementId, arrivee, depart, parseInt(nb_pers || 1, 10), req.body.code));
    }

    if (action === 'checkout') {
      if (!STRIPE_SECRET) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configuré' });
      const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
      const user = await verifyUser(token);
      if (!user || !user.email) return res.status(401).json({ error: 'Connectez-vous pour réserver' });
      const { logementId, arrivee, depart, nb_pers } = req.body;
      const np = parseInt(nb_pers || 1, 10);
      const q = await quote(logementId, arrivee, depart, np, req.body.code);
      if (q.error || !q.available) return res.status(400).json({ error: q.error || 'Dates non disponibles' });

      // Réservation "en attente" (la contrainte d'exclusion empêche tout chevauchement)
      const expires = new Date(Date.now() + 30 * 60000).toISOString();
      const ins = await sb('reservations', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          logement_id: logementId, arrivee, depart, nb_pers: np,
          montant_total: q.totalFinal, acompte: 0, statut: 'pending', expires_at: expires,
          nom: (user.user_metadata && user.user_metadata.full_name) || '', email: user.email,
        }),
      });
      if (!ins.ok) return res.status(409).json({ error: 'Ces dates viennent d\'être réservées. Choisissez d\'autres dates.' });
      const resv = (await ins.json())[0];

      // Stripe Checkout (paiement total)
      const p = new URLSearchParams();
      p.append('mode', 'payment');
      p.append('success_url', `${SITE}/api/booking?session_id={CHECKOUT_SESSION_ID}`);
      p.append('cancel_url', `${SITE}/#compte`);
      p.append('customer_email', user.email);
      p.append('locale', 'fr');
      p.append('invoice_creation[enabled]', 'true');
      p.append('line_items[0][quantity]', '1');
      p.append('line_items[0][price_data][currency]', 'eur');
      p.append('line_items[0][price_data][unit_amount]', String(Math.round(q.totalFinal * 100)));
      p.append('line_items[0][price_data][product_data][name]', `${q.logementNom} — ${q.nights} nuit(s)`);
      p.append('line_items[0][price_data][product_data][description]', `Du ${arrivee} au ${depart} · ${np} personne(s)`);
      p.append('metadata[reservation_id]', resv.id);
      p.append('expires_at', String(Math.floor(Date.now() / 1000) + 1800));

      const sr = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: p.toString(),
      });
      const session = await sr.json();
      if (!sr.ok) {
        await sb(`reservations?id=eq.${resv.id}`, { method: 'DELETE' });
        return res.status(500).json({ error: 'Erreur Stripe : ' + ((session.error && session.error.message) || 'inconnue') });
      }
      await sb(`reservations?id=eq.${resv.id}`, { method: 'PATCH', body: JSON.stringify({ stripe_session_id: session.id }) });
      return res.status(200).json({ url: session.url });
    }

    if (action === 'checkout-cart') {
      if (!STRIPE_SECRET) return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configuré' });
      const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
      const user = await verifyUser(token);
      if (!user || !user.email) return res.status(401).json({ error: 'Connectez-vous pour réserver' });
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ error: 'Panier vide' });

      const quotes = [];
      for (const it of items) {
        const q = await quote(it.logementId, it.arrivee, it.depart, parseInt(it.nb_pers || 1, 10), req.body.code);
        if (q.error || !q.available) return res.status(400).json({ error: (it.nom || 'Logement') + ' : ' + (q.error || 'indisponible') });
        quotes.push({ it, q });
      }

      const expires = new Date(Date.now() + 30 * 60000).toISOString();
      const ids = [];
      for (const { it, q } of quotes) {
        const ins = await sb('reservations', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ logement_id: it.logementId, arrivee: it.arrivee, depart: it.depart, nb_pers: parseInt(it.nb_pers || 1, 10), montant_total: q.totalFinal, acompte: 0, statut: 'pending', expires_at: expires, nom: (user.user_metadata && user.user_metadata.full_name) || '', email: user.email }) });
        if (!ins.ok) { for (const id of ids) await sb('reservations?id=eq.' + id, { method: 'DELETE' }); return res.status(409).json({ error: (it.nom || 'Logement') + ' : ces dates viennent d\'être réservées.' }); }
        ids.push((await ins.json())[0].id);
      }

      const p = new URLSearchParams();
      p.append('mode', 'payment');
      p.append('success_url', SITE + '/api/booking?session_id={CHECKOUT_SESSION_ID}');
      p.append('cancel_url', SITE + '/#compte');
      p.append('customer_email', user.email);
      p.append('locale', 'fr');
      p.append('invoice_creation[enabled]', 'true');
      quotes.forEach(({ it, q }, i) => {
        p.append('line_items[' + i + '][quantity]', '1');
        p.append('line_items[' + i + '][price_data][currency]', 'eur');
        p.append('line_items[' + i + '][price_data][unit_amount]', String(Math.round(q.totalFinal * 100)));
        p.append('line_items[' + i + '][price_data][product_data][name]', q.logementNom + ' — ' + q.nights + ' nuit(s)');
        p.append('line_items[' + i + '][price_data][product_data][description]', 'Du ' + it.arrivee + ' au ' + it.depart + ' · ' + (it.nb_pers || 1) + ' pers.');
      });
      p.append('metadata[reservation_ids]', ids.join(','));
      p.append('expires_at', String(Math.floor(Date.now() / 1000) + 1800));

      const srp = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + STRIPE_SECRET, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
      const session = await srp.json();
      if (!srp.ok) { for (const id of ids) await sb('reservations?id=eq.' + id, { method: 'DELETE' }); return res.status(500).json({ error: 'Erreur Stripe : ' + ((session.error && session.error.message) || 'inconnue') }); }
      for (const id of ids) await sb('reservations?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ stripe_session_id: session.id }) });
      return res.status(200).json({ url: session.url });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
