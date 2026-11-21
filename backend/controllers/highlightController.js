const db = require('../db');
const socketHelper = require('../socketHelper');
const { filterUserProfile } = require('../utils/privacyHelper');

const highlightController = {
    // Get all highlights for a user
    getUserHighlights: async (req, res) => {
        try {
            const { userId } = req.params;
            const viewerId = req.user?.id || null;
            const targetId = parseInt(userId);

            // Check if target user exists and get privacy settings
            const [targetUser] = await db.query('SELECT id, name, avatar, privacy_showProfile, role FROM users WHERE id = ?', [targetId]);
            if (targetUser.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            // Check privacy
            if (viewerId) {
                const [viewer] = await db.query('SELECT role FROM users WHERE id = ?', [viewerId]);
                targetUser[0].viewerRole = viewer.length > 0 ? viewer[0].role : 'aluno';
            }

            const filtered = filterUserProfile(targetUser[0], viewerId);

            if (filtered._privacy?.restricted) {
                return res.status(403).json({ error: 'Perfil privado - destaques não visíveis.' });
            }

            // Get highlights with story counts
            const [highlights] = await db.query(`
                SELECT h.*,
                    COUNT(hs.story_id) as stories_count
                FROM highlights h
                LEFT JOIN highlight_stories hs ON h.id = hs.highlight_id
                WHERE h.user_id = ?
                GROUP BY h.id
                ORDER BY h.updated_at DESC
            `, [targetId]);

            // For each highlight, get the stories
            for (let highlight of highlights) {
                const [stories] = await db.query(`
                    SELECT s.*, u.name as user_name, u.avatar as user_avatar
                    FROM stories s
                    JOIN highlight_stories hs ON s.id = hs.story_id
                    JOIN users u ON s.user_id = u.id
                    WHERE hs.highlight_id = ?
                    AND s.expires_at > NOW()
                    ORDER BY s.created_at DESC
                `, [highlight.id]);
                highlight.stories = stories;
                highlight.coverUrl = highlight.cover_url;
            }

            res.status(200).json(highlights);
        } catch (error) {
            console.error('Erro ao buscar destaques:', error);
            res.status(500).json({ error: 'Erro ao buscar destaques.' });
        }
    },

    // Create a new highlight
    createHighlight: async (req, res) => {
        try {
            const userId = req.user.id;
            const { title, coverUrl, storyIds } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({ error: 'Título é obrigatório.' });
            }

            const [result] = await db.query(
                'INSERT INTO highlights (user_id, title, cover_url) VALUES (?, ?, ?)',
                [userId, title.trim(), coverUrl || null]
            );

            const highlightId = result.insertId;

            // Add stories to highlight if provided
            if (storyIds && storyIds.length > 0) {
                // Verify stories belong to user and are not expired
                const placeholders = storyIds.map(() => '?').join(',');
                const [validStories] = await db.query(
                    `SELECT id FROM stories WHERE id IN (${placeholders}) AND user_id = ? AND expires_at > NOW()`,
                    [...storyIds, userId]
                );

                if (validStories.length > 0) {
                    const values = validStories.map(s => [highlightId, s.id]);
                    await db.query(
                        'INSERT INTO highlight_stories (highlight_id, story_id) VALUES ?',
                        [values]
                    );
                }
            }

            // Fetch created highlight with stories
            const [created] = await db.query(`
                SELECT h.*, COUNT(hs.story_id) as stories_count
                FROM highlights h
                LEFT JOIN highlight_stories hs ON h.id = hs.highlight_id
                WHERE h.id = ?
                GROUP BY h.id
            `, [highlightId]);

            if (created.length > 0) {
                created[0].coverUrl = created[0].cover_url;
                // Get stories for the highlight
                const [stories] = await db.query(`
                    SELECT s.*, u.name as user_name, u.avatar as user_avatar
                    FROM stories s
                    JOIN highlight_stories hs ON s.id = hs.story_id
                    JOIN users u ON s.user_id = u.id
                    WHERE hs.highlight_id = ?
                    AND s.expires_at > NOW()
                    ORDER BY s.created_at DESC
                `, [highlightId]);
                created[0].stories = stories;
            }

            res.status(201).json(created[0] || { id: highlightId, title: title.trim(), coverUrl, stories: [] });
        } catch (error) {
            console.error('Erro ao criar destaque:', error);
            res.status(500).json({ error: 'Erro ao criar destaque.' });
        }
    },

    // Update a highlight
    updateHighlight: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { title, coverUrl } = req.body;

            // Check ownership
            const [highlight] = await db.query('SELECT id, user_id FROM highlights WHERE id = ?', [id]);
            if (highlight.length === 0) return res.status(404).json({ error: 'Destaque não encontrado.' });
            if (highlight[0].user_id !== userId) return res.status(403).json({ error: 'Sem permissão.' });

            const updates = [];
            const params = [];

            if (title !== undefined) {
                if (!title.trim()) return res.status(400).json({ error: 'Título não pode ser vazio.' });
                updates.push('title = ?');
                params.push(title.trim());
            }
            if (coverUrl !== undefined) {
                updates.push('cover_url = ?');
                params.push(coverUrl);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            params.push(id);
            await db.query(`UPDATE highlights SET ${updates.join(', ')} WHERE id = ?`, params);

            // Fetch updated highlight
            const [updated] = await db.query(`
                SELECT h.*, COUNT(hs.story_id) as stories_count
                FROM highlights h
                LEFT JOIN highlight_stories hs ON h.id = hs.highlight_id
                WHERE h.id = ?
                GROUP BY h.id
            `, [id]);

            if (updated.length > 0) {
                updated[0].coverUrl = updated[0].cover_url;
            }

            res.status(200).json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar destaque:', error);
            res.status(500).json({ error: 'Erro ao atualizar destaque.' });
        }
    },

    // Delete a highlight
    deleteHighlight: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Check ownership
            const [highlight] = await db.query('SELECT id, user_id FROM highlights WHERE id = ?', [id]);
            if (highlight.length === 0) return res.status(404).json({ error: 'Destaque não encontrado.' });
            if (highlight[0].user_id !== userId) return res.status(403).json({ error: 'Sem permissão.' });

            // Delete highlight (cascade will delete highlight_stories)
            await db.query('DELETE FROM highlights WHERE id = ?', [id]);

            res.status(200).json({ message: 'Destaque excluído.' });
        } catch (error) {
            console.error('Erro ao excluir destaque:', error);
            res.status(500).json({ error: 'Erro ao excluir destaque.' });
        }
    },

    // Add stories to a highlight
    addStoriesToHighlight: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { storyIds } = req.body;

            if (!storyIds || !Array.isArray(storyIds) || storyIds.length === 0) {
                return res.status(400).json({ error: 'Lista de stories é obrigatória.' });
            }

            // Check ownership
            const [highlight] = await db.query('SELECT id, user_id FROM highlights WHERE id = ?', [id]);
            if (highlight.length === 0) return res.status(404).json({ error: 'Destaque não encontrado.' });
            if (highlight[0].user_id !== userId) return res.status(403).json({ error: 'Sem permissão.' });

            // Verify stories belong to user and are not expired
            const placeholders = storyIds.map(() => '?').join(',');
            const [validStories] = await db.query(
                `SELECT id FROM stories WHERE id IN (${placeholders}) AND user_id = ? AND expires_at > NOW()`,
                [...storyIds, userId]
            );

            if (validStories.length === 0) {
                return res.status(400).json({ error: 'Nenhum story válido para adicionar.' });
            }

            // Insert stories (ignore duplicates)
            const values = validStories.map(s => [id, s.id]);
            await db.query(
                'INSERT IGNORE INTO highlight_stories (highlight_id, story_id) VALUES ?',
                [values]
            );

            // Fetch updated highlight with stories
            const [updated] = await db.query(`
                SELECT h.*, COUNT(hs.story_id) as stories_count
                FROM highlights h
                LEFT JOIN highlight_stories hs ON h.id = hs.highlight_id
                WHERE h.id = ?
                GROUP BY h.id
            `, [id]);

            if (updated.length > 0) {
                updated[0].coverUrl = updated[0].cover_url;
                const [stories] = await db.query(`
                    SELECT s.*, u.name as user_name, u.avatar as user_avatar
                    FROM stories s
                    JOIN highlight_stories hs ON s.id = hs.story_id
                    JOIN users u ON s.user_id = u.id
                    WHERE hs.highlight_id = ?
                    AND s.expires_at > NOW()
                    ORDER BY s.created_at DESC
                `, [id]);
                updated[0].stories = stories;
            }

            res.status(200).json(updated[0]);
        } catch (error) {
            console.error('Erro ao adicionar stories ao destaque:', error);
            res.status(500).json({ error: 'Erro ao adicionar stories ao destaque.' });
        }
    },

    // Remove story from highlight
    removeStoryFromHighlight: async (req, res) => {
        try {
            const { id, storyId } = req.params;
            const userId = req.user.id;

            // Check ownership
            const [highlight] = await db.query('SELECT id, user_id FROM highlights WHERE id = ?', [id]);
            if (highlight.length === 0) return res.status(404).json({ error: 'Destaque não encontrado.' });
            if (highlight[0].user_id !== userId) return res.status(403).json({ error: 'Sem permissão.' });

            await db.query('DELETE FROM highlight_stories WHERE highlight_id = ? AND story_id = ?', [id, storyId]);

            res.status(200).json({ message: 'Story removido do destaque.' });
        } catch (error) {
            console.error('Erro ao remover story do destaque:', error);
            res.status(500).json({ error: 'Erro ao remover story do destaque.' });
        }
    }
};

module.exports = highlightController;