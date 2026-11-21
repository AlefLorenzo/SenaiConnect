const db = require('../db');
const { supabaseAuthRequest } = require('../services/supabaseAuth');

async function requireAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (!token) {
            return res.status(401).json({ error: 'Token administrativo não fornecido.' });
        }

        const authUser = await supabaseAuthRequest('user', {
            method: 'GET',
            accessToken: token
        });

        if (!authUser || !authUser.id) {
            return res.status(401).json({ error: 'Sessão administrativa inválida ou expirada.' });
        }

        const [profiles] = await db.query(
            'SELECT id, name, email, role, admin_role, unit_id, is_blocked FROM users WHERE auth_user_id = ?',
            [authUser.id]
        );

        if (!profiles.length || !profiles[0].admin_role) {
            return res.status(403).json({ error: 'Acesso negado: esta conta não possui permissão administrativa.' });
        }

        const profile = profiles[0];
        if (profile.is_blocked) {
            return res.status(403).json({ error: 'Conta administrativa bloqueada.' });
        }

        req.admin = {
            id: profile.id,
            user_id: profile.id,
            authUserId: authUser.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            admin_role: profile.admin_role,
            unit_id: profile.unit_id
        };

        return next();
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            return res.status(error.status).json({ error: 'Sessão administrativa inválida ou sem permissão.' });
        }
        console.error('Falha ao validar sessão administrativa:', error);
        return res.status(error.status || 503).json({
            error: error.status === 503 ? error.message : 'Não foi possível validar a sessão administrativa.'
        });
    }
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.admin || !roles.includes(req.admin.admin_role)) {
            return res.status(403).json({ error: 'Acesso negado: você não possui permissão para esta ação.' });
        }
        return next();
    };
}

function requireUnitAccess(targetUnitId) {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        if (req.admin.admin_role === 'super_admin') return next();

        if (req.admin.admin_role === 'admin_unidade' &&
            Number(req.admin.unit_id) === Number(targetUnitId)) {
            return next();
        }

        return res.status(403).json({
            error: 'Acesso negado: você só pode gerenciar a própria unidade.'
        });
    };
}

module.exports = { requireAdmin, requireRole, requireUnitAccess };
