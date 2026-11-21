const db = require('../db');
const { logAdminAction } = require('./adminAuthController');

const DEFAULT_SETTINGS = {
    platform_name: 'SENAI Connect',
    student_domain: '@estudante.senai.com',
    teacher_domain: '@docente.senai.com',
    maintenance_mode: false,
    public_registration: true,
    email_verification: true,
    push_notifications: true,
    email_notifications: true,
    digest_time: '09:00',
    notify_urgent_notices: true,
    notify_reports: true,
    auto_moderation: true,
    auto_block_threshold: 3,
    blocked_words: 'spam,phishing,golpe,fraude',
    max_posts_per_hour: 10,
    max_messages_per_hour: 30,
    require_2fa: true,
    session_timeout: 8,
    lockout_failed: true,
    detailed_audit: true
};

const adminSettingsController = {
    getSettings: async (req, res) => {
        try {
            const [rows] = await db.query(
                'SELECT setting_key, setting_value FROM system_settings ORDER BY setting_key'
            );
            const settings = {};
            rows.forEach((row) => {
                settings[row.setting_key] = row.setting_value;
            });
            return res.json({ ...DEFAULT_SETTINGS, ...settings });
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return res.status(500).json({ error: 'Erro ao buscar configurações.' });
        }
    },

    updateSettings: async (req, res) => {
        try {
            const admin = req.admin;
            const newSettings = req.body || {};
            const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));
            const updates = [];

            for (const [key, value] of Object.entries(newSettings)) {
                if (!allowedKeys.has(key)) continue;
                updates.push(db.query(
                    'INSERT INTO system_settings ' +
                    '(setting_key, setting_value, description, updated_by, updated_at) ' +
                    'VALUES (?, ?::jsonb, ?, ?, NOW()) ' +
                    'ON CONFLICT (setting_key) DO UPDATE SET ' +
                    'setting_value = EXCLUDED.setting_value, ' +
                    'description = EXCLUDED.description, ' +
                    'updated_by = EXCLUDED.updated_by, updated_at = NOW()',
                    [key, JSON.stringify(value), getSettingDescription(key), admin.id]
                ));
            }

            await Promise.all(updates);
            await logAdminAction(
                admin.id, 'SETTINGS_UPDATED', 'settings', null,
                'Atualizou configurações do sistema', { settings: newSettings }, req
            );

            return res.json({ message: 'Configurações salvas com sucesso.' });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            return res.status(500).json({ error: 'Erro ao salvar configurações.' });
        }
    },

    resetSettings: async (req, res) => {
        try {
            await db.query('DELETE FROM system_settings');
            await logAdminAction(
                req.admin.id, 'SETTINGS_RESET', 'settings', null,
                'Restaurou configurações padrão', null, req
            );
            return res.json({
                message: 'Configurações restauradas aos padrões.',
                settings: DEFAULT_SETTINGS
            });
        } catch (error) {
            console.error('Erro ao resetar configurações:', error);
            return res.status(500).json({ error: 'Erro ao resetar configurações.' });
        }
    },

    clearCache: async (req, res) => {
        try {
            await logAdminAction(
                req.admin.id, 'CACHE_CLEARED', 'system', null,
                'Limpou cache do sistema', null, req
            );
            return res.json({ message: 'Cache limpo com sucesso.' });
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            return res.status(500).json({ error: 'Erro ao limpar cache.' });
        }
    },

    exportAudit: async (req, res) => {
        try {
            await logAdminAction(
                req.admin.id, 'AUDIT_EXPORTED', 'audit', null,
                'Exportou logs de auditoria', null, req
            );
            return res.json({ message: 'Use a rota GET /api/admin/audit/export para baixar o CSV.' });
        } catch (error) {
            console.error('Erro ao exportar auditoria:', error);
            return res.status(500).json({ error: 'Erro ao exportar logs.' });
        }
    },

    getSystemInfo: async (req, res) => {
        try {
            const [[{ dbSize }]] = await db.query(
                'SELECT ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0)::numeric, 2) AS "dbSize"'
            );
            const [[{ tableCount }]] = await db.query(
                'SELECT COUNT(*)::int AS "tableCount" FROM information_schema.tables ' +
                "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
            );
            const [tables] = await db.query(
                'SELECT table_name, NULL::bigint AS table_rows, ' +
                'ROUND((pg_total_relation_size(quote_ident(table_schema) || \'.\' || quote_ident(table_name)) ' +
                '/ 1024.0 / 1024.0)::numeric, 2) AS size_mb ' +
                'FROM information_schema.tables ' +
                "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' " +
                'ORDER BY pg_total_relation_size(quote_ident(table_schema) || \'.\' || quote_ident(table_name)) DESC'
            );
            const [version] = await db.query('SELECT version() AS version');

            return res.json({
                database: {
                    version: version[0].version,
                    size_mb: dbSize,
                    tables: tableCount,
                    tableDetails: tables
                },
                node: process.version,
                platform: process.platform,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        } catch (error) {
            console.error('Erro ao buscar info do sistema:', error);
            return res.status(500).json({ error: 'Erro ao buscar informações do sistema.' });
        }
    }
};

function getSettingDescription(key) {
    const descriptions = {
        platform_name: 'Nome da plataforma exibido no cabeçalho',
        student_domain: 'Domínio de e-mail para cadastro de alunos',
        teacher_domain: 'Domínio de e-mail para cadastro de professores',
        maintenance_mode: 'Modo de manutenção (bloqueia acesso de alunos)',
        public_registration: 'Permitir cadastro público de novos usuários',
        email_verification: 'Exigir verificação de e-mail no cadastro',
        push_notifications: 'Enviar notificações push',
        email_notifications: 'Enviar notificações por e-mail',
        digest_time: 'Horário do resumo diário',
        notify_urgent_notices: 'Notificar avisos urgentes imediatamente',
        notify_reports: 'Notificar admins sobre novas denúncias',
        auto_moderation: 'Moderação automática por IA',
        auto_block_threshold: 'Limite de denúncias para auto-bloqueio',
        blocked_words: 'Palavras bloqueadas (separadas por vírgula)',
        max_posts_per_hour: 'Máximo de posts por hora por usuário',
        max_messages_per_hour: 'Máximo de mensagens por hora por usuário',
        require_2fa: 'Exigir 2FA para administradores',
        session_timeout: 'Tempo de sessão admin (horas)',
        lockout_failed: 'Bloquear IP após tentativas falhadas',
        detailed_audit: 'Log de auditoria detalhado'
    };
    return descriptions[key] || '';
}

module.exports = adminSettingsController;
