// api/my-reservations.js — Demandes de réservation de l'utilisateur connecté
//  GET (Authorization: Bearer <token Supabase>)
//   1. Vérifie le token auprès de Supabase Auth (récupère l'email vérifié)
//   2. Renvoie, depuis Vercel KV, les demandes dont l'email correspond
//
// Aucune donnée d'un autre client n'est exposée : le filtre se fait sur
// l'email VÉRIFIÉ par Supabase, jamais sur une valeur envoyée par le client.

const { kv } = require('@vercel/kv');

const SUPABASE_URL = process.env.SUPABASE_URL || ''; // pas encore de projet Supabase pour la Brasserie des Archers
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';
const RESERVATIONS_KEY = 'reservations';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  // 1. Vérifier le token auprès de Supabase
  let email = '';
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.status(401).json({ error: 'Session invalide ou expirée' });
    const user = await r.json();
    email = (user && user.email || '').trim().toLowerCase();
  } catch (err) {
    return res.status(500).json({ error: 'Service d\'authentification indisponible' });
  }
  if (!email) return res.status(401).json({ error: 'Email introuvable' });

  // 2. Récupérer ses demandes depuis KV
  try {
    const data = await kv.get(RESERVATIONS_KEY);
    const all = Array.isArray(data) ? data : [];
    const mine = all
      .filter(r => (r.email || '').trim().toLowerCase() === email)
      .map(r => ({
        dateStart: r.dateStart || '',
        dateEnd: r.dateEnd || '',
        guests: r.guests || '',
        typeLogement: r.typeLogement || '',
        message: r.message || '',
        status: r.status || 'new',
        createdAt: r.createdAt || '',
      }));
    // Réservations payées (Supabase)
    try {
      if (SERVICE) {
        const rr = await fetch(`${SUPABASE_URL}/rest/v1/reservations?email=eq.${encodeURIComponent(email)}&statut=in.(pending,confirmed)&select=arrivee,depart,nb_pers,montant_total,statut,created_at,logements(nom)`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
        if (rr.ok) {
          const rows = await rr.json();
          (Array.isArray(rows) ? rows : []).forEach(b => mine.push({
            dateStart: b.arrivee, dateEnd: b.depart, guests: b.nb_pers,
            typeLogement: (b.logements && b.logements.nom) || 'Séjour',
            message: '', status: b.statut, createdAt: b.created_at, montant: b.montant_total, source: 'booking'
          }));
        }
      }
    } catch (e) { /* best-effort */ }
    mine.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({ email, reservations: mine });
  } catch (err) {
    return res.status(500).json({ error: 'KV indisponible: ' + err.message });
  }
};
