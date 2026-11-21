const db = require('../db');
const { supabaseAuthRequest } = require('../services/supabaseAuth');

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (!token) {
            return res.status(401).json({ error: 'Token de acesso não fornecido.' });
        }

        const authUser = await supabaseAuthRequest('user', {
            method: 'GET',
            accessToken: token
        });

        if (!authUser || !authUser.id) {
            return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
        }

        const [profiles] = await db.query(
            'SELECT id, name, email, role, admin_role, unit_id, is_blocked, onboarding_completed FROM users WHERE auth_user_id = ?',
            [authUser.id]
        );

        if (!profiles.length) {
            return res.status(403).json({ error: 'Sua conta Auth ainda não está vinculada a um perfil SENAI Connect.' });
        }

        const profile = profiles[0];
        if (profile.is_blocked) {
            return res.status(403).json({ error: 'Esta conta está bloqueada.' });
        }

        req.auth = authUser;
        req.user = {
            id: profile.id,
            authUserId: authUser.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            admin_role: profile.admin_role,
            unit_id: profile.unit_id,
            onboarding_completed: profile.onboarding_completed
        };

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
