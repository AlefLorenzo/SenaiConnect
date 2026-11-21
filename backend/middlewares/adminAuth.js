const jwt = require('jsonwebtoken');
require('dotenv').config();
const SECRET_KEY = process.env.JWT_SECRET || 'senai_connect_super_secret_key';

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token administrativo não fornecido.' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado.' });
        }

        // Validação: usuário deve ter admin_role
        if (!decoded.admin_role) {
            return res.status(403).json({ error: 'Acesso negado: Usuário não possui papel administrativo.' });
        }

        req.admin = decoded;
        next();
    });
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.admin || !roles.includes(req.admin.admin_role)) {
            return res.status(403).json({ error: 'Acesso negado: Você não possui permissão para esta ação.' });
        }
        next();
    };
}

function requireUnitAccess(targetUnitId) {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        // Super admin pode acessar tudo
        if (req.admin.admin_role === 'super_admin') {
            return next();
        }

        // Admin de unidade só acessa a própria
        if (req.admin.admin_role === 'admin_unidade') {
            if (parseInt(req.admin.unit_id) !== parseInt(targetUnitId)) {
                return res.status(403).json({ error: 'Acesso negado: Você só tem permissão para gerenciar a sua própria unidade.' });
            }
            return next();
        }

        // Outros papéis requerem configurações adicionais no futuro
        return res.status(403).json({ error: 'Acesso negado: Permissão não configurada para seu papel.' });
    };
}

module.exports = {
    requireAdmin,
    requireRole,
    requireUnitAccess,
    SECRET_KEY
};