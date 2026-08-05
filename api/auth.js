// api/auth.js — Authentification admin (sans rate-limiting KV)
// ADMIN_TOKEN dans Vercel doit etre le SHA-256 du mot de passe
// Ou définir ADMIN_PASSWORD en clair

async function sha256Node(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    try {
        const tokenHash = (((process.env.ADMIN_TOKEN || '').replace(/^"|"$/g, '') || '').replace(/^"|$/g, '') || '').trim();
        const tokenPlain = (process.env.ADMIN_PASSWORD || '').trim();
        
        let expectedPlainHash = '';
        if (tokenPlain) {
            expectedPlainHash = await sha256Node(tokenPlain);
        }

        // Si aucun token n'est configuré, accepte pour debug
        if (!tokenHash && !tokenPlain) {
            console.warn('Admin credentials not set — auth bypassed (dev mode)');
            return res.status(200).json({ success: true, dev: true });
        }

        const { token } = req.body || {};
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token manquant.' });
        }

        if ((tokenHash && token.trim() === tokenHash) || (expectedPlainHash && token.trim() === expectedPlainHash)) {
            return res.status(200).json({ success: true });
        }

        return res.status(401).json({
            success: false,
            message: 'Code incorrect.'
        });

    } catch (err) {
        console.error('Auth error:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur: ' + err.message });
    }
};
