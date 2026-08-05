// api/campaigns.js — Campagnes email automatiques
//  • Avis post-séjour : email X jours après le départ (réservations confirmées)
//  • Relance 90 jours : email aux anciens clients ayant donné leur consentement
//
// Déclenché par Vercel Cron (1×/jour). Voir "crons" dans vercel.json.
// SÉCURITÉ :
//  - N'envoie RIEN tant que CAMPAIGNS_ENABLED !== 'true' (mode simulation / dry-run).
//  - Authentifié par CRON_SECRET (header Authorization: Bearer …) ou token admin.
//  - Lien de désinscription dans chaque email + respect du flag unsubscribed.
//  - La relance marketing (90j) n'est envoyée qu'aux clients avec marketingConsent === true (RGPD).

const { kv } = require('@vercel/kv');
const crypto = require('crypto');

const RESERVATIONS_KEY = 'reservations';
const DAY = 86400000;
const FROM = 'Les Archers <noreply@lesarchersvoiron.fr>';
// Domaine "www" : il sert les fichiers en direct. Le non-www redirige (307),
// or les clients mail ne suivent PAS les redirections d'images -> www obligatoire.
const IMG_BASE = 'https://www.lesarchersvoiron.fr';
const SITE = (process.env.SITE_URL || 'https://www.lesarchersvoiron.fr').replace(/\/$/, '');
const REVIEW_URL = process.env.REVIEW_URL || 'https://www.google.com/maps?q=Les+Archers+9+Place+du+G%C3%A9n%C3%A9ral+Leclerc+Voiron';
// Image d'en-tête commune à tous les emails (bar, servie en direct sur www)
const HERO_IMG = `${IMG_BASE}/photo/bar-interieur.webp`;
const IMG_TABLE = `${IMG_BASE}/photo/plat.webp`;
const IMG_EXTERIEUR = `${IMG_BASE}/photo/facade.webp`;
const IMG_FENETRE = `${IMG_BASE}/photo/cocktail.webp`;
const IMG_SALON = `${IMG_BASE}/photo/bar-interieur.webp`;
const CAMPAIGN_IMAGES = { salon: IMG_SALON, fenetre: IMG_FENETRE, table: IMG_TABLE, exterieur: IMG_EXTERIEUR, hero: HERO_IMG };
const CONTACT_EMAIL = (process.env.CONTACT_EMAIL || '').trim();
const PHONE = '+33 4 76 05 00 42';
const LOYALTY_CODE = 'ARCHERS10';

// Encart code fidélité (-10% prochain séjour), réutilisé dans les emails de fidélisation
function loyaltyBlock() {
  return `<div style="text-align:center; margin:28px 0;">
    <div style="display:inline-block; border:2px dashed #C4704D; border-radius:10px; padding:14px 30px; background:#FDF6EF;">
      <span style="display:block; font-size:12px; text-transform:uppercase; letter-spacing:0.1em; color:#C4704D; font-weight:bold;">-10 % sur votre prochaine visite</span>
      <span style="display:block; font-size:26px; font-weight:bold; color:#2E3D2F; letter-spacing:0.06em; margin-top:4px;">${LOYALTY_CODE}</span>
    </div>
  </div>`;
}

async function getReservations() {
  const data = await kv.get(RESERVATIONS_KEY);
  return Array.isArray(data) ? data : [];
}
async function saveReservations(r) { await kv.set(RESERVATIONS_KEY, r); }

const SUBSCRIBERS_KEY = 'newsletter_subscribers';
async function getSubscribers() {
  const data = await kv.get(SUBSCRIBERS_KEY);
  return Array.isArray(data) ? data : [];
}
async function saveSubscribers(list) { await kv.set(SUBSCRIBERS_KEY, list); }

// Liste de diffusion = clients ayant consenti au marketing + abonnés newsletter
// (dédupliqués par email, désinscrits exclus)
async function buildAudience() {
  const [reservations, subs] = await Promise.all([getReservations(), getSubscribers()]);
  const unsub = new Set();
  reservations.forEach(r => { if (r.unsubscribed && r.email) unsub.add(r.email.trim().toLowerCase()); });
  subs.forEach(x => { if (x.unsubscribed && x.email) unsub.add(x.email.trim().toLowerCase()); });
  const map = new Map();
  const add = (email, name, source) => {
    email = (email || '').trim().toLowerCase();
    if (!email || unsub.has(email)) return;
    if (!map.has(email)) map.set(email, { email, name: name || '', sources: [source] });
    else { const e = map.get(email); if (!e.sources.includes(source)) e.sources.push(source); if (!e.name && name) e.name = name; }
  };
  reservations.forEach(r => { if (r.marketingConsent === true) add(r.email, r.name, 'client'); });
  subs.forEach(x => add(x.email, x.name, 'newsletter'));
  return Array.from(map.values());
}

// Email de campagne (sujet + message libre) — rendu identique pour l'aperçu et l'envoi
function broadcastEmailHtml(message, unsubUrl, imageKey) {
  const safe = String(message || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const img = CAMPAIGN_IMAGES[imageKey] || IMG_SALON;
  return shell(img, 'Les Archers', '', '<div>' + safe + '</div>', unsubUrl);
}

const LISTS_KEY = 'mailing_lists';
async function getLists() {
  const data = await kv.get(LISTS_KEY);
  return Array.isArray(data) ? data : [];
}
async function saveLists(list) { await kv.set(LISTS_KEY, list); }

async function getUnsubSet() {
  const [reservations, subs] = await Promise.all([getReservations(), getSubscribers()]);
  const set = new Set();
  reservations.forEach(r => { if (r.unsubscribed && r.email) set.add(r.email.trim().toLowerCase()); });
  subs.forEach(x => { if (x.unsubscribed && x.email) set.add(x.email.trim().toLowerCase()); });
  return set;
}

// Résout les destinataires selon la cible : 'all' | 'newsletter' | 'clients' | 'list:<id>'
async function resolveRecipients(target) {
  target = target || 'all';
  if (target === 'clients-all') return getAllClients();
  if (target.indexOf('list:') === 0) {
    const id = target.slice(5);
    const lists = await getLists();
    const list = lists.find(l => l.id === id);
    if (!list) return [];
    const unsub = await getUnsubSet();
    return (list.members || [])
      .map(e => (e || '').trim().toLowerCase())
      .filter(e => e && !unsub.has(e))
      .map(e => ({ email: e, name: '' }));
  }
  let aud = await buildAudience();
  if (target === 'newsletter') aud = aud.filter(a => a.sources.includes('newsletter'));
  else if (target === 'clients') aud = aud.filter(a => a.sources.includes('client'));
  return aud;
}

// Tous les anciens clients (toutes les réservations, hors désinscrits), dédupliqués
async function getAllClients() {
  const reservations = await getReservations();
  const unsub = await getUnsubSet();
  const seen = new Set();
  const out = [];
  reservations.forEach(r => {
    const e = (r.email || '').trim().toLowerCase();
    if (!e || seen.has(e) || unsub.has(e)) return;
    seen.add(e);
    out.push({ email: e, name: r.name || '', sources: ['client'] });
  });
  return out;
}

function unsubToken(email) {
  return crypto.createHash('sha256')
    .update((email || '').toLowerCase() + ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || 'salt'))
    .digest('hex').slice(0, 16);
}

function isAuthorized(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (secret && auth === secret) return true;
  const adminToken = (req.headers['x-admin-token'] || '').trim();
  const tokenHash = ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim();
  if (adminToken && tokenHash && adminToken === tokenHash) return true;
  return false;
}

function shell(imgUrl, title, intro, bodyHtml, unsubUrl) {
  const year = new Date().getFullYear();
  const preheader = (intro || title || '').replace(/<[^>]+>/g, '');
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#EDE6D6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDE6D6;font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE6D6;">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FDFBF7;border-radius:18px;overflow:hidden;border:1px solid #E7DECC;">
      ${imgUrl ? `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${imgUrl}" width="600" alt="Les Archers" style="display:block;width:100%;max-width:600px;height:200px;object-fit:cover;border:0;outline:none;text-decoration:none;"></td></tr>` : ''}
      <tr><td style="background:#2E3D2F;padding:30px 40px;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C4A57B;">Les Archers</p>
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:bold;line-height:1.25;color:#ffffff;">${title}</h1>
        ${intro ? `<p style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:#D7C7AE;">${intro}</p>` : ''}
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:#C4704D;">&nbsp;</td></tr>
      <tr><td style="padding:36px 40px 10px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;color:#3E352B;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:8px 40px 0;"><div style="border-top:1px solid #ECE3D2;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:22px 40px 34px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;color:#9A917F;text-align:center;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6B5744;font-weight:bold;">Les Archers</span><br>
        1157 Place du Général Leclerc · 38500 Voiron · Alpes-de-Haute-Provence<br>
        <a href="tel:+33476050042" style="color:#9A917F;text-decoration:none;">+33 6 06 79 23 93</a> &nbsp;·&nbsp;
        <a href="https://www.lesarchersvoiron.fr" style="color:#C4704D;text-decoration:none;font-weight:bold;">lesarchersvoiron.fr</a>
        ${unsubUrl ? `<br><br><a href="${unsubUrl}" style="color:#B6AC99;text-decoration:underline;">Se désinscrire de ces emails</a>` : ''}
      </td></tr>
    </table>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr>
      <td style="padding:14px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#B0A793;">© ${year} Les Archers — Voiron, Provence</td>
    </tr></table>
  </td></tr>
</table>
</body></html>`;
}

function reviewEmailHtml(name) {
  return shell(
    HERO_IMG,
    `Merci pour votre visite${name ? ', ' + name : ''}`,
    'Nous espérons que vous avez passé un bon moment aux Archers.',
    `<p>Votre avis nous aide énormément et guide les futurs visiteurs. Si vous avez quelques instants, partager votre expérience sur Google nous ferait très plaisir :</p>
     <p style="text-align:center; margin:28px 0;">
       <a href="${REVIEW_URL}" style="display:inline-block; background:#C4704D; color:#fff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:bold;">Laisser un avis sur Google</a>
     </p>
     ${loyaltyBlock()}
     <p>Au plaisir de vous revoir bientôt à Les Archers.</p>
     <p style="margin-top:20px;">L'équipe des Archers</p>`,
    null
  );
}

function reengageEmailHtml(name, unsubUrl) {
  return shell(
    IMG_EXTERIEUR,
    `Cela faisait longtemps${name ? ', ' + name : ''}`,
    'Les Archers vous attend, place du Général Leclerc.',
    `<p>Les saisons passent et notre terrasse est toujours aussi agréable. Si l'envie d'un café, d'une formule du jour ou d'un cocktail signature vous tente, nous serions ravis de vous accueillir à nouveau.</p>
     <p style="text-align:center; margin:28px 0;">
       <a href="${SITE}/#specialites" style="display:inline-block; background:#2E3D2F; color:#fff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:bold;">Voir nos spécialités</a>
     </p>
     ${loyaltyBlock()}
     <p>À très bientôt,<br>L'équipe des Archers</p>`,
    unsubUrl
  );
}

function promoEmailHtml(name, unsubUrl) {
  return shell(
    IMG_FENETRE,
    `Une offre pour vous${name ? ', ' + name : ''}`,
    'Profitez de nos meilleures conditions du moment.',
    `<p>En ce moment à Les Archers, nous vous réservons une attention particulière pour votre prochaine visite : formules du jour, cocktails signature et tapas maison, en terrasse ou au comptoir.</p>
     <p style="text-align:center; margin:28px 0;">
       <a href="${SITE}/#contact" style="display:inline-block; background:#C4704D; color:#fff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:bold;">Profiter de l'offre</a>
     </p>
     <p>À très bientôt,<br>L'équipe des Archers</p>`,
    unsubUrl
  );
}

function replyEmailHtml(name, message) {
  const safe = String(message || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const contactLine = CONTACT_EMAIL
    ? `par email à <a href="mailto:${CONTACT_EMAIL}" style="color:#C4704D;">${CONTACT_EMAIL}</a> ou par téléphone au <strong>${PHONE}</strong>`
    : `par téléphone au <strong>${PHONE}</strong>`;
  return shell(
    HERO_IMG,
    `Bonjour ${name || ''}`,
    'Les Archers vous répond.',
    `<p>${safe}</p>
     <p style="margin-top:24px;">Bien à vous,<br>L'équipe des Archers</p>
     <div style="margin-top:24px; padding:14px 18px; background:#FDF6EF; border-left:3px solid #C4704D; border-radius:0 6px 6px 0; font-size:13px; color:#6B5744; line-height:1.6;">
       <strong>Merci de ne pas répondre directement à cet email</strong> : il s'agit d'une adresse automatique (no-reply) qui n'est pas relevée.<br>
       Pour toute question, contactez-nous ${contactLine}.
     </div>`,
    null
  );
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Liste de diffusion (admin) : GET ?audience=1 ──
  if (req.method === 'GET' && req.query && req.query.audience) {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Non autorisé' });
    try {
      const [audience, allClients] = await Promise.all([buildAudience(), getAllClients()]);
      const newsletter = audience.filter(a => a.sources.includes('newsletter')).length;
      const clients = audience.filter(a => a.sources.includes('client')).length;
      return res.status(200).json({ count: audience.length, newsletter, clients, audience, allClients, allClientsCount: allClients.length });
    } catch (err) {
      return res.status(500).json({ error: 'KV indisponible: ' + err.message });
    }
  }

  // ── Listes de diffusion (admin) : GET ?lists=1 ──
  if (req.method === 'GET' && req.query && req.query.lists) {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Non autorisé' });
    try {
      const lists = await getLists();
      return res.status(200).json({ lists: lists.map(l => ({ id: l.id, name: l.name, count: (l.members || []).length })) });
    } catch (err) {
      return res.status(500).json({ error: 'KV indisponible: ' + err.message });
    }
  }

  // ── Désinscription publique : GET ?unsubscribe=<token>&email=<email> ──
  if (req.method === 'GET' && req.query && req.query.unsubscribe) {
    const email = (req.query.email || '').toLowerCase();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!email || unsubToken(email) !== req.query.unsubscribe) {
      return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:48px;"><h2>Lien invalide</h2></body></html>');
    }
    try {
      const reservations = await getReservations();
      let changed = false;
      reservations.forEach(r => {
        if ((r.email || '').toLowerCase() === email) { r.unsubscribed = true; changed = true; }
      });
      if (changed) await saveReservations(reservations);
      const subs = await getSubscribers();
      let subChanged = false;
      subs.forEach(x => { if ((x.email || '').toLowerCase() === email) { x.unsubscribed = true; subChanged = true; } });
      if (subChanged) await saveSubscribers(subs);
    } catch { }
    return res.status(200).send('<html><body style="font-family:sans-serif;text-align:center;padding:48px;color:#2E3D2F;"><h2>Désinscription confirmée ✓</h2><p>Vous ne recevrez plus d\'emails de Les Archers.</p></body></html>');
  }

  // ── POST — Envoi manuel d'un email depuis l'admin (avis ou relance) ──
  if (req.method === 'POST') {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Non autorisé' });
    const { type, id } = req.body || {};

    // ── Gestion des listes de diffusion ──
    if (type === 'createList') {
      const name = (req.body.name || '').toString().trim();
      if (!name) return res.status(400).json({ error: 'Nom de liste requis' });
      const lists = await getLists();
      const list = { id: 'list_' + Date.now().toString(36), name, members: [], createdAt: new Date().toISOString() };
      lists.push(list);
      await saveLists(lists);
      return res.status(200).json({ success: true, list: { id: list.id, name: list.name, count: 0 } });
    }
    if (type === 'deleteList') {
      const lists = (await getLists()).filter(l => l.id !== req.body.id);
      await saveLists(lists);
      return res.status(200).json({ success: true });
    }
    if (type === 'addToList') {
      const id = req.body.id;
      const emails = Array.isArray(req.body.emails) ? req.body.emails : [];
      const lists = await getLists();
      const list = lists.find(l => l.id === id);
      if (!list) return res.status(404).json({ error: 'Liste introuvable' });
      if (!Array.isArray(list.members)) list.members = [];
      const set = new Set(list.members.map(e => (e || '').toLowerCase()));
      let added = 0;
      emails.forEach(e => { e = (e || '').trim().toLowerCase(); if (e && !set.has(e)) { set.add(e); list.members.push(e); added++; } });
      await saveLists(lists);
      return res.status(200).json({ success: true, count: list.members.length, added });
    }
    if (type === 'removeFromList') {
      const id = req.body.id;
      const email = (req.body.email || '').trim().toLowerCase();
      const lists = await getLists();
      const list = lists.find(l => l.id === id);
      if (list) { list.members = (list.members || []).filter(e => (e || '').toLowerCase() !== email); await saveLists(lists); }
      return res.status(200).json({ success: true });
    }

    // ── Aperçu d'une campagne (HTML identique à l'envoi réel) ──
    if (type === 'preview') {
      return res.status(200).json({ html: broadcastEmailHtml(req.body.message || '', '#', req.body.image) });
    }

    // ── Envoi groupé à la liste de diffusion ──
    if (type === 'broadcast') {
      if (!process.env.RESEND_API_KEY) {
        return res.status(500).json({ error: 'RESEND_API_KEY non configuré sur Vercel' });
      }
      const subject = (req.body.subject || '').toString().trim();
      const message = (req.body.message || '').toString();
      if (!subject || !message.trim()) {
        return res.status(400).json({ error: 'Sujet et message requis' });
      }
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const testEmail = (req.body.testEmail || '').toString().trim();
      const imageKey = (req.body.image || '').toString();

      if (testEmail) {
        try {
          const unsubUrl = SITE + '/api/campaigns?unsubscribe=' + unsubToken(testEmail) + '&email=' + encodeURIComponent(testEmail);
          await resend.emails.send({ from: FROM, to: [testEmail], subject, html: broadcastEmailHtml(message, unsubUrl, imageKey) });
          return res.status(200).json({ success: true, test: true });
        } catch (e) {
          return res.status(500).json({ error: 'Envoi test échoué: ' + e.message });
        }
      }

      let audience;
      try { audience = await resolveRecipients(req.body.target); }
      catch (err) { return res.status(500).json({ error: 'KV indisponible: ' + err.message }); }
      if (!audience.length) return res.status(400).json({ error: 'Aucun destinataire dans la liste' });

      let sent = 0, failed = 0;
      for (const a of audience) {
        try {
          const unsubUrl = SITE + '/api/campaigns?unsubscribe=' + unsubToken(a.email) + '&email=' + encodeURIComponent(a.email);
          await resend.emails.send({ from: FROM, to: [a.email], subject, html: broadcastEmailHtml(message, unsubUrl, imageKey) });
          sent++;
        } catch (e) { failed++; }
      }
      return res.status(200).json({ success: true, sent, failed, total: audience.length });
    }
    if (!id || !['review', 'reengage', 'promo', 'reply'].includes(type)) {
      return res.status(400).json({ error: 'Paramètres type/id requis' });
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY non configuré sur Vercel' });
    }
    let reservations;
    try { reservations = await getReservations(); }
    catch (err) { return res.status(500).json({ error: 'KV indisponible: ' + err.message }); }
    const r = reservations.find(x => x.id === id);
    if (!r) return res.status(404).json({ error: 'Réservation introuvable' });
    const email = (r.email || '').trim();
    if (!email) return res.status(400).json({ error: "Ce client n'a pas d'email" });
    if (r.unsubscribed && type !== 'reply') return res.status(400).json({ error: "Ce client s'est désinscrit" });

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const unsubUrl = `${SITE}/api/campaigns?unsubscribe=${unsubToken(email)}&email=${encodeURIComponent(email)}`;
      if (type === 'review') {
        await resend.emails.send({ from: FROM, to: [email], subject: 'Merci pour votre visite — votre avis compte', html: reviewEmailHtml(r.name) });
        r.reviewSentAt = new Date().toISOString();
      } else if (type === 'promo') {
        await resend.emails.send({ from: FROM, to: [email], subject: 'Une offre pour vous à Les Archers', html: promoEmailHtml(r.name, unsubUrl) });
        r.lastPromoAt = new Date().toISOString();
      } else if (type === 'reply') {
        const msg = (req.body.message || '').toString().trim();
        if (!msg) return res.status(400).json({ error: 'Message vide' });
        await resend.emails.send({ from: FROM, to: [email], subject: 'Réponse de Les Archers', html: replyEmailHtml(r.name, msg) });
        r.lastReplyAt = new Date().toISOString();
      } else {
        await resend.emails.send({ from: FROM, to: [email], subject: 'Revenez vous ressourcer à Les Archers', html: reengageEmailHtml(r.name, unsubUrl) });
        r.lastReengagedAt = new Date().toISOString();
      }
      await saveReservations(reservations);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Envoi échoué: ' + e.message });
    }
  }

  if (!isAuthorized(req)) return res.status(401).json({ error: 'Non autorisé' });

  const dryRun = process.env.CAMPAIGNS_ENABLED !== 'true' || (req.query && req.query.dryRun === '1');
  const now = Date.now();

  let reservations;
  try { reservations = await getReservations(); }
  catch (err) { return res.status(500).json({ error: 'KV indisponible: ' + err.message }); }

  let resend = null;
  if (!dryRun && process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  const report = { dryRun, reviewCandidates: 0, reviewSent: 0, reengageCandidates: 0, reengageSent: 0, errors: 0 };

  for (const r of reservations) {
    const email = (r.email || '').trim();
    if (!email || r.unsubscribed) continue;
    const end = r.dateEnd ? new Date(r.dateEnd).getTime() : 0;

    // ── Avis post-séjour (transactionnel, lié au service) ──
    if (r.status === 'confirmed' && end && !r.reviewSentAt) {
      const daysSinceEnd = (now - end) / DAY;
      if (daysSinceEnd >= 2 && daysSinceEnd <= 30) {
        report.reviewCandidates++;
        if (!dryRun && resend) {
          try {
            await resend.emails.send({ from: FROM, to: [email], subject: 'Merci pour votre visite 🍷 — votre avis compte', html: reviewEmailHtml(r.name) });
            r.reviewSentAt = new Date().toISOString();
            report.reviewSent++;
          } catch (e) { report.errors++; }
        }
      }
    }

    // ── Relance 90 jours (marketing → consentement RGPD requis) ──
    if (r.marketingConsent === true) {
      const lastContact = r.lastReengagedAt ? new Date(r.lastReengagedAt).getTime()
        : (end || new Date(r.createdAt || 0).getTime());
      const daysSince = (now - lastContact) / DAY;
      if (daysSince >= 90) {
        report.reengageCandidates++;
        if (!dryRun && resend) {
          try {
            const unsubUrl = `${SITE}/api/campaigns?unsubscribe=${unsubToken(email)}&email=${encodeURIComponent(email)}`;
            await resend.emails.send({ from: FROM, to: [email], subject: 'Revenez vous ressourcer à Les Archers', html: reengageEmailHtml(r.name, unsubUrl) });
            r.lastReengagedAt = new Date().toISOString();
            report.reengageSent++;
          } catch (e) { report.errors++; }
        }
      }
    }
  }

  if (!dryRun) {
    try { await saveReservations(reservations); } catch (err) { report.saveError = err.message; }
  }

  return res.status(200).json({ success: true, ...report });
};
