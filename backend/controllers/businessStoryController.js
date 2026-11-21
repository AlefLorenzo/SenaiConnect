const db = require('../db');
const socketHelper = require('../socketHelper');
const notificationController = require('./notificationController');

const businessStoryController = {
    // ============================================
    // LISTAR STORIES (PARA FEED HORIZONTAL)
    // ============================================
    getAll: async (req, res) => {
        try {
            const userId = req.user?.id;

            // Buscar stories ativos (não expirados) de empresas aprovadas
            const query = `
                SELECT bs.*, b.company_name, b.logo_url, b.slug as business_slug,
                EXISTS(SELECT 1 FROM business_story_views WHERE story_id = bs.id AND user_id = ?) as seen,
                (SELECT COUNT(*) FROM business_story_views WHERE story_id = bs.id) as views_count
                FROM business_stories bs
                JOIN businesses b ON bs.business_id = b.id
                WHERE bs.expires_at > NOW()
                AND b.status = 'approved'
                ORDER BY
                    CASE WHEN bs.is_sponsored = 1 THEN 0 ELSE 1 END,
                    bs.created_at DESC
            `;
            const params = userId ? [userId] : [null];

            const [stories] = await db.query(query, params);

            // Agrupar por empresa
            const grouped = {};
            stories.forEach(story => {
                if (!grouped[story.business_id]) {
                    grouped[story.business_id] = {
                        business_id: story.business_id,
                        business_name: story.company_name,
                        business_logo: story.logo_url,
                        business_slug: story.business_slug,
                        stories: [],
                        has_unseen: false
                    };
                }
                grouped[story.business_id].stories.push(story);

                if (!story.seen && story.business_id !== userId) {
                    grouped[story.business_id].has_unseen = true;
                }
            });

            // Converter para array e ordenar: empresas com stories não vistos primeiro, depois por data
            let result = Object.values(grouped);
            result.sort((a, b) => {
                if (a.has_unseen !== b.has_unseen) return a.has_unseen ? -1 : 1;
                const aLatest = Math.max(...a.stories.map(s => new Date(s.created_at).getTime()));
                const bLatest = Math.max(...b.stories.map(s => new Date(s.created_at).getTime()));
                return bLatest - aLatest;
            });

            res.json(result);
        } catch (error) {
            console.error('Erro ao buscar stories:', error);
            res.status(500).json({ error: 'Erro ao buscar stories.' });
        }
    },

    // Ver story (marcar como visto)
    viewStory: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [story] = await db.query('SELECT id FROM business_stories WHERE id = ? AND expires_at > NOW()', [id]);
            if (story.length === 0) {
                return res.status(404).json({ error: 'Story não encontrado ou expirado.' });
            }

            await db.query(
                'INSERT IGNORE INTO business_story_views (story_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            await db.query('UPDATE business_stories SET views_count = views_count + 1 WHERE id = ?', [id]);

            res.json({ message: 'Story marcado como visto.' });
        } catch (error) {
            console.error('Erro ao marcar story como visto:', error);
            res.status(500).json({ error: 'Erro interno.' });
        }
    },

    // Click no link do story
    clickStory: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [story] = await db.query('SELECT id FROM business_stories WHERE id = ? AND expires_at > NOW()', [id]);
            if (story.length === 0) {
                return res.status(404).json({ error: 'Story não encontrado ou expirado.' });
            }

            await db.query(
                'INSERT IGNORE INTO business_story_clicks (story_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            await db.query('UPDATE business_stories SET clicks_count = clicks_count + 1 WHERE id = ?', [id]);

            res.json({ message: 'Click registrado.' });
        } catch (error) {
            console.error('Erro ao registrar click no story:', error);
            res.status(500).json({ error: 'Erro interno.' });
        }
    },

    // Criar story
    create: async (req, res) => {
        try {
            const userId = req.user.id;
            const { media_url, media_type, text_content, link_url, link_label, cta_text } = req.body;

            // Verificar se usuário tem empresa aprovada
            const [business] = await db.query('SELECT id, company_name FROM businesses WHERE owner_user_id = ? AND status = "approved"', [userId]);
            if (business.length === 0) {
                return res.status(403).json({ error: 'Você precisa ter uma empresa aprovada para publicar stories.' });
            }

            if (!media_url && !text_content) {
                return res.status(400).json({ error: 'O story precisa de uma imagem/vídeo ou texto.' });
            }

            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

            const [result] = await db.query(
                `INSERT INTO business_stories (business_id, media_url, media_type, text_content, link_url, link_label, cta_text, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [business[0].id, media_url || null, media_type || 'image', text_content || null, link_url || null, link_label || null, cta_text || null, expiresAt]
            );

            const [created] = await db.query(
                `SELECT bs.*, b.company_name, b.logo_url, b.slug as business_slug
                 FROM business_stories bs JOIN businesses b ON bs.business_id = b.id
                 WHERE bs.id = ?`,
                [result.insertId]
            );

            // Notificar seguidores
            const [followers] = await db.query('SELECT user_id FROM business_followers WHERE business_id = ?', [business[0].id]);
            for (const follower of followers) {
                await notificationController.createNotification(
                    follower.user_id,
                    'new_story',
                    userId,
                    null,
                    `${business[0].company_name} publicou um novo story!`
                );
                socketHelper.sendToUser(follower.user_id, 'new_business_story', {
                    storyId: result.insertId,
                    businessId: business[0].id,
                    businessName: business[0].company_name
                });
            }

            // Broadcast para stories globais
            socketHelper.broadcast('business_story_created', created[0]);

            res.status(201).json(created[0]);
        } catch (error) {
            console.error('Erro ao criar story:', error);
            res.status(500).json({ error: 'Erro ao criar story.' });
        }
    },

    // Excluir story
    delete: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [story] = await db.query('SELECT business_id FROM business_stories WHERE id = ?', [id]);
            if (story.length === 0) return res.status(404).json({ error: 'Story não encontrado.' });

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [story[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            await db.query('DELETE FROM business_stories WHERE id = ?', [id]);
            res.json({ message: 'Story excluído.' });
        } catch (error) {
            console.error('Erro ao excluir story:', error);
            res.status(500).json({ error: 'Erro ao excluir story.' });
        }
    },

    // Meus stories (para painel da empresa)
    getMyStories: async (req, res) => {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [business] = await db.query('SELECT id FROM businesses WHERE owner_user_id = ?', [userId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Você não possui uma empresa.' });
            }

            const query = `
                SELECT bs.*, b.company_name, b.logo_url
                FROM business_stories bs
                JOIN businesses b ON bs.business_id = b.id
                WHERE bs.business_id = ?
                ORDER BY bs.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const [stories] = await db.query(query, [business[0].id, parseInt(limit), offset]);

            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM business_stories WHERE business_id = ?', [business[0].id]);

            res.json({ stories, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao buscar meus stories:', error);
            res.status(500).json({ error: 'Erro ao buscar stories.' });
        }
    },

    // Stats do story
    getStoryStats: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [story] = await db.query('SELECT * FROM business_stories WHERE id = ?', [id]);
            if (story.length === 0) {
                return res.status(404).json({ error: 'Story não encontrado.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [story[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            // Visualizações por hora
            const [viewsByHour] = await db.query(`
                SELECT HOUR(viewed_at) as hour, COUNT(*) as views
                FROM business_story_views
                WHERE story_id = ?
                GROUP BY HOUR(viewed_at)
                ORDER BY hour ASC
            `, [id]);

            res.json({
                views_count: story[0].views_count,
                clicks_count: story[0].clicks_count,
                views_by_hour: viewsByHour,
                expires_at: story[0].expires_at,
                is_expired: new Date(story[0].expires_at) < new Date()
            });
        } catch (error) {
            console.error('Erro ao buscar stats do story:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        }
    }
};

module.exports = businessStoryController;