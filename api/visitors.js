// api/visitors.js — Compteur visiteurs avec IP réelle Vercel
// Variables env requises: KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_TOKEN
const { kv }  = require('@vercel/kv');
const crypto  = require('crypto');

const VISITS_KEY  = 'visitor_count';
const COOKIE_KEY  = 'cookie_accept_count';
const RECENT_KEY  = 'recent_visits';
const MAX_RECENT  = 100;

const isAdmin = (h) =>
  ((h['x-admin-token'] || '').trim()) === (((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim());

/**
 * getRealIp — extrait l'IP réelle depuis les headers Vercel.
 *
 * Vercel injecte plusieurs headers dans cet ordre de fiabilité :
 *   1. x-real-ip          → IP directe mise par Vercel Edge (la plus fiable)
 *   2. x-vercel-forwarded-for → IP client avant Vercel Edge
 *   3. x-forwarded-for    → liste CSV d'IPs (peut être spoofée par l'appelant)
 *      Format: "client, proxy1, proxy2" → on prend la DERNIÈRE entrée
 *      (la dernière est ajoutée par le dernier serveur de confiance)
 */
function getRealIp(headers) {
  // 1. Header le plus fiable sur Vercel
  if (headers['x-real-ip']) {
    return headers['x-real-ip'].trim();
  }
  // 2. Header spécifique Vercel
  if (headers['x-vercel-forwarded-for']) {
    return headers['x-vercel-forwarded-for'].split(',')[0].trim();
  }
  // 3. x-forwarded-for — on prend la DERNIÈRE entrée (pas la première)
  if (headers['x-forwarded-for']) {
    const parts = headers['x-forwarded-for'].split(',');
    return parts[parts.length - 1].trim();
  }
  return '127.0.0.1';
}

// Hash partiel 10 chars — anonymise l'IP (RGPD) tout en permettant dédoublonnage
function hashIp(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || 'salt'))
    .digest('hex')
    .substring(0, 10);
}

// Parse le User-Agent en quelques mots lisibles
function parseUA(ua = '') {
  if (!ua) return 'Inconnu';
  if (/bot|crawl|spider|slurp|facebot/i.test(ua)) return '🤖 Bot';
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'Mac'
    : /iPhone|iPad/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Linux/i.test(ua) ? 'Linux' : '?';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Chrome/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari' : '?';
  return `${browser} / ${os}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — Stats admin ───────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!isAdmin(req.headers)) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    try {
      // Support du paramètre range (défaut 30 jours)
      const range = parseInt(req.query?.range || '30') || 30;
      const maxRange = 365; // Sécurité
      const effectiveRange = Math.min(range, maxRange);

      const days = [];
      for (let i = effectiveRange - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }

      // Récupération des stats par jour
      const chartData = { labels: [], total: [], unique: [] };
      for (const day of days) {
        const total = await kv.get(`visits_${day}`) || 0;
        const unique = await kv.get(`visits_unique_${day}`) || 0;
        
        // Formattage date courte (ex: 15 Avr)
        const dateParts = day.split('-');
        const shortDate = `${dateParts[2]}/${dateParts[1]}`;
        
        chartData.labels.push(shortDate);
        chartData.total.push(total);
        chartData.unique.push(unique);
      }

      const totalVisits = await kv.get(VISITS_KEY) || 0;
      const cookieCount = await kv.get(COOKIE_KEY) || 0;
      const recent = await kv.get(RECENT_KEY) || [];
      const todayUnique = await kv.get(`visits_unique_${new Date().toISOString().split('T')[0]}`) || 0;

      // Pages les plus visitées depuis les visites récentes
      const pageMap = {};
      recent.forEach(v => { pageMap[v.page || '/'] = (pageMap[v.page || '/'] || 0) + 1; });
      const topPages = Object.entries(pageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, count]) => ({ page, count }));

      return res.status(200).json({
        totalVisits:      totalVisits || 0,
        todayUnique:      todayUnique || 0,
        cookieAcceptCount: cookieCount || 0,
        recentVisits:     recent.slice(0, 50),
        chartData,
        topPages,
      });
    } catch (err) {
      return res.status(500).json({ error: 'KV unavailable: ' + err.message });
    }
  }

  // ── POST — Enregistrer visite ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { event, page, sessionId } = req.body || {};
    const rawIp  = getRealIp(req.headers);
    const ipHash = hashIp(rawIp);
    const ua     = parseUA(req.headers['user-agent']);
    const today  = new Date().toISOString().split('T')[0];

    try {
      if (event === 'cookie_accept') {
        await kv.incr(COOKIE_KEY);
        return res.status(200).json({ success: true });
      }

      if (event === 'visit') {
        // Incrémente compteur global
        await kv.incr(VISITS_KEY);
        // Incrémente compteur du jour
        await kv.incr(`visits_${today}`);

        // Visiteurs uniques du jour (par hash IP)
        const uniqueKey = `visits_unique_${today}`;
        const seenKey   = `seen_${today}_${ipHash}`;
        const alreadySeen = await kv.exists(seenKey);
        if (!alreadySeen) {
          await kv.incr(uniqueKey);
          // Expire le marqueur après 24h
          await kv.set(seenKey, 1, { ex: 86400 });
        }

        // Ajouter aux visites récentes
        const existing = (await kv.get(RECENT_KEY)) || [];
        const newVisit = {
          date:      new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
          ip:        ipHash,   // hash partiel — jamais l'IP brute (RGPD)
          page:      page || '/',
          browser:   ua,
          sessionId: (sessionId || '').substring(0, 16),
        };
        const updated = [newVisit, ...existing].slice(0, MAX_RECENT);
        await kv.set(RECENT_KEY, updated);

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'event requis (visit | cookie_accept)' });
    } catch (err) {
      // Ne pas bloquer le front si KV est down
      return res.status(200).json({ success: false, warn: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
