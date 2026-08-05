// api/settings.js — Vercel Serverless Function
// Variables d'env requises dans Vercel Dashboard :
//   KV_REST_API_URL   -> généré par Vercel KV (Storage > KV)
//   KV_REST_API_TOKEN -> généré par Vercel KV
//   ADMIN_TOKEN       -> défini manuellement (même valeur que dans le front)
//
// GET  -> lecture publique (pas de token)
// POST -> écriture admin (header x-admin-token requis)

const { kv } = require('@vercel/kv');

const SETTINGS_KEY = 'admin_settings';

const DEFAULT_SETTINGS = {
  title: 'Brasserie des Archers',
  heroTitle: 'Brasserie des Archers',
  heroSub: "Un lieu où tradition et modernité se rencontrent, place du Général Leclerc, pour une expérience café-brasserie unique au cœur de Voiron depuis 1905.",
  email: process.env.CONTACT_EMAIL || '',
  receiveEmail: process.env.CONTACT_EMAIL || '',
  phone: '+33 4 76 05 00 42',
  bookingRating: '4,8',
  bookingReviews: '',
  bookingUrl: 'https://www.google.com/maps?q=Les+Archers+9+Place+du+G%C3%A9n%C3%A9ral+Leclerc+Voiron',
  review1Text: "Très bon moment passé dans ce restaurant ! Nous avons pleinement profité de la terrasse ensoleillée. Le service était irréprochable et les serveurs particulièrement gentils et attentionnés.",
  review1Author: 'Elisa M.',
  review2Text: "Très bel établissement ! On est super bien accueillis par l'équipe ! Le cadre est superbe et on y mange très bien.",
  review2Author: 'Julien S.',
  review3Text: "Une vraie pépite ! À découvrir absolument, trop trop bon ! Je recommande vivement. Mes respects au chef, chapeau bas !",
  review3Author: 'PoPs',
};

function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isValidUrl(v) { try { new URL(v); return true; } catch { return false; } }

function validateSettings(s) {
  const errors = [];
  if (s.title        && s.title.length > 100)     errors.push('title trop long (max 100)');
  if (s.heroTitle    && s.heroTitle.length > 200)  errors.push('heroTitle trop long (max 200)');
  if (s.heroSub      && s.heroSub.length > 600)    errors.push('heroSub trop long (max 600)');
  if (s.email        && !isValidEmail(s.email))    errors.push('email invalide');
  if (s.receiveEmail && !isValidEmail(s.receiveEmail)) errors.push('receiveEmail invalide');
  if (s.bookingUrl   && !isValidUrl(s.bookingUrl)) errors.push('bookingUrl invalide (doit commencer par https://)');
  return errors;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — lecture publique ────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      let settings = await kv.get(SETTINGS_KEY);
      if (!settings || typeof settings !== 'object') settings = DEFAULT_SETTINGS;
      else settings = { ...DEFAULT_SETTINGS, ...settings };
      return res.status(200).json(settings);
    } catch (err) {
      console.error('Settings GET error:', err);
      return res.status(200).json(DEFAULT_SETTINGS);
    }
  }

  // ── POST — écriture admin ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const providedToken = (req.headers['x-admin-token'] || '').trim();
    const actualToken   = ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim();

    if (!providedToken || providedToken !== actualToken) {
      return res.status(401).json({ error: 'Non autorisé — vérifiez le token admin' });
    }

    try {
      const newSettings = req.body || {};
      const errors = validateSettings(newSettings);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation échouée', details: errors });
      }
      const merged = { ...DEFAULT_SETTINGS, ...newSettings };
      await kv.set(SETTINGS_KEY, merged);
      return res.status(200).json({ success: true, settings: merged });
    } catch (err) {
      console.error('Settings POST error:', err);
      return res.status(500).json({ error: 'Erreur KV: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
