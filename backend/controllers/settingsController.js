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

            // Default settings
            const defaultSettings = {
                theme: 'system', // 'light', 'dark', 'system'
                language: 'pt-BR',
                notifications: {
                    push: true,
                    email: true,
                    likes: true,
                    comments: true,
                    follows: true,
                    messages: true,
                    groups: true,
                    stories: true,
                    mentions: true
                },
                privacy: {
                    profileVisibility: user.privacy_showProfile || 'public',
                    showEmail: user.privacy_showEmail || false,
                    showLastSeen: 'everyone', // 'everyone', 'contacts', 'nobody'
                    showOnlineStatus: true,
                    readReceipts: true
                },
                accessibility: {
                    reducedMotion: false,
                    highContrast: false,
                    fontSize: 'medium' // 'small', 'medium', 'large'
                }
            };

            // Merge with stored settings
            let storedSettings = {};
            try {
                storedSettings = user.settings ? JSON.parse(user.settings) : {};
            } catch (e) {
                storedSettings = {};
            }

            let storedNotifications = {};
            try {
                storedNotifications = user.notification_prefs ? JSON.parse(user.notification_prefs) : {};
            } catch (e) {
                storedNotifications = {};
            }

            let storedAccessibility = {};
            try {
                storedAccessibility = user.accessibility_prefs ? JSON.parse(user.accessibility_prefs) : {};
            } catch (e) {
                storedAccessibility = {};
            }

            const settings = {
                ...defaultSettings,
                ...storedSettings,
                notifications: { ...defaultSettings.notifications, ...storedNotifications },
                privacy: { ...defaultSettings.privacy, ...storedSettings.privacy },
                accessibility: { ...defaultSettings.accessibility, ...storedAccessibility }
            };

            // Ensure privacy settings are synced with columns
            settings.privacy.profileVisibility = user.privacy_showProfile || 'public';
            settings.privacy.showEmail = user.privacy_showEmail === 1 || user.privacy_showEmail === true;

            res.status(200).json(settings);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            res.status(500).json({ error: 'Erro ao buscar configurações' });
        }
    },

    // Update user settings
    updateSettings: async (req, res) => {
        try {
            const userId = req.user.id;
            const { theme, language, notifications, privacy, accessibility } = req.body;

            // Get current settings
            const [users] = await db.query('SELECT settings FROM users WHERE id = ?', [userId]);
            if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            let currentSettings = {};
            try {
                currentSettings = users[0].settings ? JSON.parse(users[0].settings) : {};
            } catch (e) {
                currentSettings = {};
            }

            // Merge new settings
            const newSettings = {
                ...currentSettings,
                ...(theme && { theme }),
                ...(language && { language }),
                ...(notifications && { notifications: { ...currentSettings.notifications, ...notifications } }),
                ...(privacy && { privacy: { ...currentSettings.privacy, ...privacy } }),
                ...(accessibility && { accessibility: { ...currentSettings.accessibility, ...accessibility } })
            };

            // Update users table
            const updates = [];
            const values = [];

            // Update settings JSON
            updates.push('settings = ?');
            values.push(JSON.stringify(newSettings));

            // Update privacy columns if changed
            if (privacy) {
                if (privacy.profileVisibility !== undefined) {
                    updates.push('privacy_showProfile = ?');
                    values.push(privacy.profileVisibility);
                }
                if (privacy.showEmail !== undefined) {
                    updates.push('privacy_showEmail = ?');
                    values.push(privacy.showEmail ? 1 : 0);
                }
            }

            // Update notification_prefs if changed
            if (notifications) {
                updates.push('notification_prefs = ?');
                values.push(JSON.stringify({ ...currentSettings.notifications, ...notifications }));
            }

            // Update accessibility_prefs if changed
            if (accessibility) {
                updates.push('accessibility_prefs = ?');
                values.push(JSON.stringify({ ...currentSettings.accessibility, ...accessibility }));
            }

            if (updates.length > 0) {
                values.push(userId);
                await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
            }

            // Emit socket event for real-time sync
            socketHelper.broadcast('settings_updated', { userId, settings: newSettings });

            res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings: newSettings });
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