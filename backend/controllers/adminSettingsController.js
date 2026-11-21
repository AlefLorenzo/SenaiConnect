const db = require('../db');
const { logAdminAction } = require('./adminAuthController');

// Configurações padrão do sistema
const DEFAULT_SETTINGS = {
    // Geral
    platform_name: 'SENAI Connect',
    student_domain: '@estudante.senai.com',
    teacher_domain: '@docente.senai.com',
    maintenance_mode: false,
    public_registration: true,
    email_verification: true,

    // Notificações
    push_notifications: true,
    email_notifications: true,
    digest_time: '09:00',
    notify_urgent_notices: true,
    notify_reports: true,

    // Moderação
    auto_moderation: true,
    auto_block_threshold: 3,
    blocked_words: 'spam,phishing,golpe,fraude',
    max_posts_per_hour: 10,
    max_messages_per_hour: 30,

    // Segurança
    require_2fa: true,
    session_timeout: 8,
    lockout_failed: true,
    detailed_audit: true
};

const adminSettingsController = {
    // Obter todas as configurações
    getSettings: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT `key`, `value`, `type`, `description` FROM system_settings ORDER BY `key`');

            const settings = {};
            rows.forEach(row => {
                let value = row.value;
                if (row.type === 'boolean') value = value === 'true';
                else if (row.type === 'number') value = parseInt(value, 10);
                else if (row.type === 'json') {
                    try { value = JSON.parse(value); } catch { value = null; }
                }
                settings[row.key] = value;
            });

            // Mesclar com padrões para chaves faltando
            const merged = { ...DEFAULT_SETTINGS, ...settings };

            res.json(merged);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            res.status(500).json({ error: 'Erro ao buscar configurações' });
        }
    },

    // Atualizar configurações
    updateSettings: async (req, res) => {
        try {
            const admin = req.admin;
            const newSettings = req.body;

            const allowedKeys = Object.keys(DEFAULT_SETTINGS);
            const updates = [];

            for (const [key, value] of Object.entries(newSettings)) {
                if (!allowedKeys.includes(key)) continue;

                let dbValue = value;
                let type = 'string';

                if (typeof value === 'boolean') {
                    dbValue = value ? 'true' : 'false';
                    type = 'boolean';
                } else if (typeof value === 'number') {
                    dbValue = value.toString();
                    type = 'number';
                } else if (typeof value === 'object' && value !== null) {
                    dbValue = JSON.stringify(value);
                    type = 'json';
                }

                updates.push(db.query(`
                    INSERT INTO system_settings (\`key\`, \`value\`, \`type\`, \`description\`, \`updated_at\`)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), \`type\` = VALUES(\`type\`), \`updated_at\` = CURRENT_TIMESTAMP
                `, [key, dbValue, type, getSettingDescription(key)]));
            }

            await Promise.all(updates);

            await logAdminAction(admin.id, 'SETTINGS_UPDATED', 'settings', null, 'Atualizou configurações do sistema', { settings: newSettings }, req);

            res.json({ message: 'Configurações salvas com sucesso' });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            res.status(500).json({ error: 'Erro ao salvar configurações' });
        }
    },

    // Resetar para padrões
    resetSettings: async (req, res) => {
        try {
            const admin = req.admin;

            await db.query('DELETE FROM system_settings');

            await logAdminAction(admin.id, 'SETTINGS_RESET', 'settings', null, 'Restaurou configurações padrão', null, req);

            res.json({ message: 'Configurações restauradas aos padrões', settings: DEFAULT_SETTINGS });
        } catch (error) {
            console.error('Erro ao resetar configurações:', error);
            res.status(500).json({ error: 'Erro ao resetar configurações' });
        }
    },

    // Limpar cache (placeholder - implementar conforme infraestrutura)
    clearCache: async (req, res) => {
        try {
            const admin = req.admin;

            // Aqui você implementaria a limpeza de cache real (Redis, etc.)
            // Por enquanto, apenas loga a ação
            await logAdminAction(admin.id, 'CACHE_CLEARED', 'system', null, 'Limpou cache do sistema', null, req);

            res.json({ message: 'Cache limpo com sucesso' });
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            res.status(500).json({ error: 'Erro ao limpar cache' });
        }
    },

    // Exportar dados de auditoria
    exportAudit: async (req, res) => {
        try {
            const admin = req.admin;

            await logAdminAction(admin.id, 'AUDIT_EXPORTED', 'audit', null, 'Exportou logs de auditoria', null, req);

            res.json({ message: 'Use a rota GET /api/admin/audit/export para baixar o CSV' });
        } catch (error) {
            console.error('Erro ao exportar auditoria:', error);
            res.status(500).json({ error: 'Erro ao exportar auditoria' });
        }
    },

    // Info do sistema
    getSystemInfo: async (req, res) => {
        try {
            const [[{ dbSize }]] = await db.query(`
                SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as dbSize
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
            `);

            const [[{ tableCount }]] = await db.query(`
                SELECT COUNT(*) as tableCount
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
            `);

            const [tables] = await db.query(`
                SELECT table_name, table_rows,
                       ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                ORDER BY (data_length + index_length) DESC
            `);

            const [version] = await db.query('SELECT VERSION() as version');

            res.json({
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
            res.status(500).json({ error: 'Erro ao buscar informações do sistema' });
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