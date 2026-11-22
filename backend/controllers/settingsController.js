const db = require('../db');
const socketHelper = require('../socketHelper');

const settingsController = {
    // Get user settings
    getSettings: async (req, res) => {
        try {
            const userId = req.user.id;
            const [users] = await db.query(
                'SELECT settings, privacy_showProfile, privacy_showEmail, notification_prefs, accessibility_prefs FROM users WHERE id = ?',
                [userId]
            );
            if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            const user = users[0];
            const parseObject = (value) => {
                if (!value) return {};
                if (typeof value === 'object' && !Array.isArray(value)) return value;
                try {
                    const parsed = JSON.parse(value);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch { return {}; }
            };
            const stored = parseObject(user.settings);
            const notifications = parseObject(user.notification_prefs);
            const accessibility = parseObject(user.accessibility_prefs);
            const defaults = {
                theme: 'system',
                language: 'pt-BR',
                notifications: { push: true, email: true, likes: true, comments: true, follows: true, messages: true, groups: true, stories: true, mentions: true },
                privacy: { profileVisibility: 'public', showEmail: false, showLastSeen: 'everyone', showOnlineStatus: true, readReceipts: true },
                accessibility: { reducedMotion: false, highContrast: false, fontSize: 'medium' }
            };
            const result = {
                ...defaults,
                ...stored,
                notifications: { ...defaults.notifications, ...parseObject(stored.notifications), ...notifications },
                privacy: { ...defaults.privacy, ...parseObject(stored.privacy) },
                accessibility: { ...defaults.accessibility, ...parseObject(stored.accessibility), ...accessibility }
            };
            const storedProfileVisibility = user.privacy_showprofile ?? user.privacy_showProfile;
            const storedShowEmail = user.privacy_showemail ?? user.privacy_showEmail;
            result.privacy.profileVisibility = storedProfileVisibility || result.privacy.profileVisibility;
            result.privacy.showEmail = storedShowEmail === 1 || storedShowEmail === true;
            res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            res.status(500).json({ error: 'Erro ao buscar configurações' });
        }
    },

    // Update user settings. Merge with dedicated preference columns to avoid losing saved options.
    updateSettings: async (req, res) => {
        try {
            const userId = req.user.id;
            const body = req.body || {};
            const { theme, language, notifications, privacy, accessibility } = body;
            if (theme !== undefined && !['light', 'dark', 'system'].includes(theme)) {
                return res.status(400).json({ error: 'Tema inválido.' });
            }
            if (language !== undefined && language !== 'pt-BR') {
                return res.status(400).json({ error: 'Idioma não suportado.' });
            }
            const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
            if ((notifications !== undefined && !isObject(notifications)) ||
                (privacy !== undefined && !isObject(privacy)) ||
                (accessibility !== undefined && !isObject(accessibility))) {
                return res.status(400).json({ error: 'Formato de configurações inválido.' });
            }

            const [users] = await db.query(
                'SELECT settings, privacy_showProfile, privacy_showEmail, notification_prefs, accessibility_prefs FROM users WHERE id = ?',
                [userId]
            );
            if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
            const parseObject = (value) => {
                if (!value) return {};
                if (typeof value === 'object' && !Array.isArray(value)) return value;
                try {
                    const parsed = JSON.parse(value);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch { return {}; }
            };
            const user = users[0];
            const current = parseObject(user.settings);
            const currentNotifications = parseObject(user.notification_prefs);
            const currentAccessibility = parseObject(user.accessibility_prefs);
            const defaults = {
                notifications: { push: true, email: true, likes: true, comments: true, follows: true, messages: true, groups: true, stories: true, mentions: true },
                privacy: { profileVisibility: user.privacy_showProfile || 'public', showEmail: user.privacy_showEmail === 1 || user.privacy_showEmail === true, showLastSeen: 'everyone', showOnlineStatus: true, readReceipts: true },
                accessibility: { reducedMotion: false, highContrast: false, fontSize: 'medium' }
            };
            const nextNotifications = { ...defaults.notifications, ...parseObject(current.notifications), ...currentNotifications, ...(notifications || {}) };
            const nextPrivacy = { ...defaults.privacy, ...parseObject(current.privacy), ...(privacy || {}) };
            const nextAccessibility = { ...defaults.accessibility, ...parseObject(current.accessibility), ...currentAccessibility, ...(accessibility || {}) };

            if (!['public', 'professor', 'private'].includes(nextPrivacy.profileVisibility)) {
                return res.status(400).json({ error: 'Visibilidade de perfil inválida.' });
            }
            if (!['everyone', 'contacts', 'nobody'].includes(nextPrivacy.showLastSeen)) {
                return res.status(400).json({ error: 'Preferência de visto por último inválida.' });
            }
            if (!['small', 'medium', 'large'].includes(nextAccessibility.fontSize)) {
                return res.status(400).json({ error: 'Tamanho de fonte inválido.' });
            }
            for (const [key, value] of Object.entries({ ...nextNotifications, ...nextPrivacy, ...nextAccessibility })) {
                if (typeof value === 'boolean' || typeof value === 'string') continue;
                return res.status(400).json({ error: 'Valor de configuração inválido: ' + key });
            }
            const nextSettings = {
                ...current,
                ...(theme !== undefined ? { theme } : {}),
                ...(language !== undefined ? { language } : {}),
                notifications: nextNotifications,
                privacy: nextPrivacy,
                accessibility: nextAccessibility
            };
            await db.query(
                'UPDATE users SET settings = ?, notification_prefs = ?, accessibility_prefs = ?, privacy_showProfile = ?, privacy_showEmail = ? WHERE id = ?',
                [JSON.stringify(nextSettings), JSON.stringify(nextNotifications), JSON.stringify(nextAccessibility),
                    nextPrivacy.profileVisibility, nextPrivacy.showEmail ? 1 : 0, userId]
            );
            socketHelper.broadcast('settings_updated', { userId, settings: nextSettings });
            res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings: nextSettings });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            res.status(500).json({ error: 'Erro ao atualizar configurações' });
        }
    },

    // Update theme only (for quick toggle)
    updateTheme: async (req, res) => {
        try {
            const userId = req.user.id;
            const { theme } = req.body;

            if (!['light', 'dark', 'system'].includes(theme)) {
                return res.status(400).json({ error: 'Tema inválido.' });
            }

            const [users] = await db.query('SELECT settings FROM users WHERE id = ?', [userId]);
            if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            let currentSettings = {};
            try {
                currentSettings = users[0].settings ? JSON.parse(users[0].settings) : {};
            } catch (e) {
                currentSettings = {};
            }

            currentSettings.theme = theme;

            await db.query('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(currentSettings), userId]);

            socketHelper.broadcast('settings_updated', { userId, settings: currentSettings });

            res.status(200).json({ message: 'Tema atualizado!', theme });
        } catch (error) {
            console.error('Erro ao atualizar tema:', error);
            res.status(500).json({ error: 'Erro ao atualizar tema' });
        }
    }
};

module.exports = settingsController;