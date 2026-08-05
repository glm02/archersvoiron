// api/analytics.js — Redirige vers visitors.js (KV) pour compatibilité
// Ce fichier est conservé pour ne pas casser d'éventuels appels existants
const { kv } = require('@vercel/kv');
const crypto = require('crypto');

const isAdmin = (h) =>
    ((h['x-admin-token'] || '').trim()) === (((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').trim());

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip + ((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '')).digest('hex').substring(0, 8);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        const { page, sessionId } = req.body || {};
        const rawIp = (req.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0].trim();
        const ip = hashIp(rawIp);
        try {
            if (sessionId) {
                await kv.incr('visitor_count');
                const today = new Date().toISOString().split('T')[0];
                await kv.incr(`visits_${today}`);
                const existing = (await kv.get('recent_visits')) || [];
                const updated = [{
                    date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
                    ip, page: page || '/'
                }, ...existing].slice(0, 50);
                await kv.set('recent_visits', updated);
            }
        } catch {}
        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        if (!isAdmin(req.headers)) return res.status(401).json({ error: 'Non autorisé' });
        try {
            const days = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                days.push(d.toISOString().split('T')[0]);
            }
            const [totalVisits, recentVisits, ...dayCounts] = await kv.mget(
                'visitor_count', 'recent_visits', ...days.map(d => `visits_${d}`)
            );
            return res.status(200).json({
                totalVisits: totalVisits || 0,
                recentVisits: recentVisits || [],
                chartData: days.map((date, i) => ({ date, count: dayCounts[i] || 0 })),
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
