// api/reservations.js — Vercel Serverless Function
// Stockage persistant des réservations via Vercel KV (Upstash)
// GET  → liste toutes les réservations (protégé par ADMIN_TOKEN)
// POST → crée une réservation
// PATCH ?id=xxx → met à jour le statut
// DELETE ?id=xxx → supprime une réservation

const { kv } = require('@vercel/kv');
const crypto = require('crypto');

const RESERVATIONS_KEY = 'reservations';

// Lis toutes les réservations depuis KV
async function getReservations() {
  try {
    const data = await kv.get(RESERVATIONS_KEY);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Sauvegarde le tableau complet dans KV
async function saveReservations(reservations) {
  await kv.set(RESERVATIONS_KEY, reservations);
}

function sha256Node(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminToken = (req.headers['x-admin-token'] || '').trim();
  const tokenHash = ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim();
  const tokenPlain = (process.env.ADMIN_PASSWORD || '').trim();
  
  let expectedPlainHash = '';
  if (tokenPlain) expectedPlainHash = sha256Node(tokenPlain);

  const isAdmin = adminToken && ((tokenHash && adminToken === tokenHash) || (expectedPlainHash && adminToken === expectedPlainHash));
  const hasAuthSetup = tokenHash || tokenPlain;

  // ── POST — Créer une réservation (publique, appelée depuis le formulaire) ──
  if (req.method === 'POST') {
    const { name, email, phone, dateStart, dateEnd, guests, typeLogement, message, honeypot } = req.body || {};

    // Anti-spam honeypot
    if (honeypot) return res.status(200).json({ success: true });

    // Validation basique
    if (!name || !email) {
      return res.status(400).json({ error: 'Nom et email obligatoires' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

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
      status: 'new',          // new | confirmed | refused | read
      createdAt: new Date().toISOString(),
    };

    try {
      const reservations = await getReservations();
      reservations.unshift(reservation);
      // Garder les 500 dernières
      if (reservations.length > 500) reservations.length = 500;
      await saveReservations(reservations);
      return res.status(200).json({ success: true, id: reservation.id });
    } catch (err) {
      console.error('KV save error:', err);
      // Retourner succès quand même pour ne pas bloquer l'utilisateur
      return res.status(200).json({ success: true, _warning: 'KV unavailable' });
    }
  }

  // ── GET — Lire les réservations (protégé admin) ──
  if (req.method === 'GET') {
    if (!isAdmin && hasAuthSetup) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    try {
      const reservations = await getReservations();
      const newCount = reservations.filter(r => r.status === 'new').length;
      return res.status(200).json({ reservations, newCount, total: reservations.length });
    } catch (err) {
      console.error('KV read error:', err);
      return res.status(500).json({ error: 'Erreur lecture KV', reservations: [], newCount: 0, total: 0 });
    }
  }

  // ── PATCH — Mettre à jour le statut (protégé admin) ──
  if (req.method === 'PATCH') {
    if (!isAdmin && hasAuthSetup) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    const { id } = req.query;
    const { status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'id et status requis' });
    if (!['new', 'confirmed', 'refused', 'read'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    try {
      const reservations = await getReservations();
      const idx = reservations.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Réservation non trouvée' });
      reservations[idx].status = status;
      reservations[idx].updatedAt = new Date().toISOString();
      await saveReservations(reservations);
      return res.status(200).json({ success: true, reservation: reservations[idx] });
    } catch (err) {
      console.error('KV patch error:', err);
      return res.status(500).json({ error: 'Erreur mise à jour' });
    }
  }

  // ── DELETE — Supprimer une réservation (protégé admin) ──
  if (req.method === 'DELETE') {
    if (!isAdmin && hasAuthSetup) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const reservations = await getReservations();
      const filtered = reservations.filter(r => r.id !== id);
      if (filtered.length === reservations.length) {
        return res.status(404).json({ error: 'Réservation non trouvée' });
      }
      await saveReservations(filtered);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('KV delete error:', err);
      return res.status(500).json({ error: 'Erreur suppression' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
