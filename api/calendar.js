// api/calendar.js — Calendrier admin (réservations + blocages)
//  POST (x-admin-token = ADMIN_TOKEN) :
//   { action: 'data' }                                  -> logements, reservations, blocages
//   { action: 'block', logement_id, from, to, motif }   -> bloquer des dates
//   { action: 'unblock', id }                           -> retirer un blocage
//
// Service role Supabase (serveur). Plus tard : import iCal Eviivo/Booking/Airbnb.

const SUPABASE_URL = process.env.SUPABASE_URL || ''; // pas encore de projet Supabase pour la Brasserie des Archers
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function sb(path, opts) {
  opts = opts || {};
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    headers: Object.assign({ apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }, opts.headers || {}),
    body: opts.body,
  });
}

function isAdmin(req) {
  const t = (req.headers['x-admin-token'] || '').trim();
  const hash = ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim();
  return !!(t && hash && t === hash);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configuré' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Non autorisé' });

  const { action } = req.body || {};
  try {
    if (action === 'data') {
      const [lr, rr, br] = await Promise.all([
        sb('logements?select=id,nom&order=nom'),
        sb('reservations?statut=in.(pending,confirmed)&select=logement_id,arrivee,depart,statut,nom,email'),
        sb('blocages?select=id,logement_id,plage,motif'),
      ]);
      const logements = await lr.json();
      const reservations = await rr.json();
      const blocagesRaw = await br.json();
      // Convertir la plage daterange "[debut,fin)" en {from,to}
      const blocages = (Array.isArray(blocagesRaw) ? blocagesRaw : []).map(b => {
        const m = (b.plage || '').match(/[\[(]([0-9-]+),([0-9-]+)[\])]/);
        return { id: b.id, logement_id: b.logement_id, motif: b.motif, from: m ? m[1] : null, to: m ? m[2] : null };
      });
      return res.status(200).json({ logements, reservations, blocages });
    }

    if (action === 'block') {
      const { logement_id, from, to, motif } = req.body;
      if (!logement_id || !from || !to || from >= to) return res.status(400).json({ error: 'Logement et dates valides requis' });
      const ins = await sb('blocages', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ logement_id, plage: `[${from},${to})`, motif: motif || 'Indisponible' }) });
      if (!ins.ok) return res.status(409).json({ error: 'Conflit : ces dates chevauchent une réservation/un blocage existant.' });
      return res.status(200).json({ success: true });
    }

    if (action === 'unblock') {
      if (!req.body.id) return res.status(400).json({ error: 'id requis' });
      await sb(`blocages?id=eq.${req.body.id}`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
