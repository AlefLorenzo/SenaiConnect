const { getVerifiedIdentity } = require('../services/verifiedIdentity');

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (!token) {
            return res.status(401).json({ error: 'Token de acesso não fornecido.' });
        }

        const identity = await getVerifiedIdentity(token);
        req.auth = identity.authUser;
        req.user = identity.user;

        return next();
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            return res.status(error.status).json({ error: 'Sessão inválida ou expirada. Entre novamente.' });
        }

        console.error('Falha ao validar token Supabase:', error);
        return res.status(error.status || 503).json({
            error: error.status === 503
                ? error.message
                : 'Não foi possível validar sua sessão no Supabase.'
        });
    }
}

module.exports = { authenticateToken };
