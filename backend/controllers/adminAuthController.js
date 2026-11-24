const db = require('../db');
const adminAuthController = {
    async logAdminAction(admin_id, action, target_type = null, target_id = null, description = null, metadata = null, req = null) {
        try {
            const ip = req ? (req.ip || req.connection.remoteAddress) : null;
            const user_agent = req ? req.get('User-Agent') : null;
            const metaString = metadata ? JSON.stringify(metadata) : null;

            await db.query(`
                INSERT INTO admin_logs (admin_id, action, target_type, target_id, description, metadata, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [admin_id, action, target_type, target_id, description, metaString, ip, user_agent]);
        } catch (error) {
            console.error('Falha ao registrar log administrativo:', error);
            // Nunca falhamos a requisição se o log der erro para não comprometer a plataforma
        }
    },
};

module.exports = adminAuthController;
module.exports.logAdminAction = adminAuthController.logAdminAction;