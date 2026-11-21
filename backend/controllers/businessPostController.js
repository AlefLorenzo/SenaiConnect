const db = require('../db');
const socketHelper = require('../socketHelper');
const notificationController = require('./notificationController');
const { logAdminAction } = require('./adminAuthController');

const businessPostController = {
    // ============================================
    // LISTAR PUBLICAÇÕES (FEED)
    // ============================================
    listPosts: async (req, res) => {
        try {
            const userId = req.user?.id;
            const { businessId, search, postType, category, isSponsored, page = 1, limit = 10, sort = 'recent' } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE bp.status = "published" AND b.status = "approved"';
            const params = [];

            if (businessId) {
                whereClause += ' AND bp.business_id = ?';
                params.push(businessId);
            }
            if (search) {
                whereClause += ' AND (bp.content LIKE ? OR b.company_name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            if (postType) {
                whereClause += ' AND bp.post_type = ?';
                params.push(postType);
            }
            if (category) {
                whereClause += ' AND bp.category = ?';
                params.push(category);
            }
            if (isSponsored !== undefined) {
                whereClause += ' AND bp.is_sponsored = ?';
                params.push(isSponsored === 'true' ? 1 : 0);
            }

            let orderBy = 'bp.published_at DESC';
            if (sort === 'popular') orderBy = '(bp.likes_count + bp.comments_count * 2 + bp.shares_count) DESC';
            else if (sort === 'oldest') orderBy = 'bp.published_at ASC';

            const query = `
                SELECT bp.*, b.company_name, b.logo_url, b.slug as business_slug,
                ${userId ? 'EXISTS(SELECT 1 FROM business_post_likes WHERE post_id = bp.id AND user_id = ?) as liked' : 'FALSE as liked'},
                ${userId ? 'EXISTS(SELECT 1 FROM business_post_saves WHERE post_id = bp.id AND user_id = ?) as saved' : 'FALSE as saved'}
                FROM business_posts bp
                JOIN businesses b ON bp.business_id = b.id
                ${whereClause}
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
            `;
            if (userId) params.push(userId);
            params.push(parseInt(limit), offset);

            const [posts] = await db.query(query, params);

            // Parse carousel_images JSON
            posts.forEach(post => {
                if (post.carousel_images) {
                    try {
                        post.carousel_images = JSON.parse(post.carousel_images);
                    } catch {
                        post.carousel_images = [];
                    }
                }
                if (post.social_links) {
                    try {
                        post.social_links = JSON.parse(post.social_links);
                    } catch {
                        post.social_links = null;
                    }
                }
            });

            // Total para paginação
            const countQuery = `
                SELECT COUNT(*) as total
                FROM business_posts bp
                JOIN businesses b ON bp.business_id = b.id
                ${whereClause}
            `;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({
                posts,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        } catch (error) {
            console.error('Erro ao listar posts:', error);
            res.status(500).json({ error: 'Erro ao buscar publicações.' });
        }
    },

    // Obter post por ID
    getPost: async (req, res) => {
        try {
            const userId = req.user?.id;
            const { id } = req.params;

            const query = `
                SELECT bp.*, b.company_name, b.logo_url, b.cover_image_url, b.slug as business_slug, b.contact_email, b.website,
                ${userId ? 'EXISTS(SELECT 1 FROM business_post_likes WHERE post_id = bp.id AND user_id = ?) as liked' : 'FALSE as liked'},
                ${userId ? 'EXISTS(SELECT 1 FROM business_post_saves WHERE post_id = bp.id AND user_id = ?) as saved' : 'FALSE as saved'},
                EXISTS(SELECT 1 FROM business_followers WHERE business_id = bp.business_id AND user_id = ?) as is_following_business
                FROM business_posts bp
                JOIN businesses b ON bp.business_id = b.id
                WHERE bp.id = ? AND bp.status = 'published' AND b.status = 'approved'
            `;
            const params = [id];
            if (userId) params.push(userId, userId);
            else params.push(null, null);

            const [posts] = await db.query(query, params);
            if (posts.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const post = posts[0];
            if (post.carousel_images) {
                try { post.carousel_images = JSON.parse(post.carousel_images); } catch { post.carousel_images = []; }
            }

            // Incrementar views
            await db.query('UPDATE business_posts SET views_count = views_count + 1 WHERE id = ?', [id]);

            // Comentários
            const [comments] = await db.query(`
                SELECT bpc.*, u.name as user_name, u.avatar as user_avatar,
                ${userId ? 'EXISTS(SELECT 1 FROM business_post_likes WHERE post_id = bpc.id AND user_id = ?) as liked' : 'FALSE as liked'}
                FROM business_post_comments bpc
                JOIN users u ON bpc.user_id = u.id
                WHERE bpc.post_id = ? AND bpc.parent_id IS NULL
                ORDER BY bpc.created_at ASC
            `, [id]);

            // Respostas para cada comentário
            for (const comment of comments) {
                const [replies] = await db.query(`
                    SELECT bpc.*, u.name as user_name, u.avatar as user_avatar
                    FROM business_post_comments bpc
                    JOIN users u ON bpc.user_id = u.id
                    WHERE bpc.parent_id = ?
                    ORDER BY bpc.created_at ASC
                `, [comment.id]);
                comment.replies = replies;
            }

            res.json({ ...post, comments });
        } catch (error) {
            console.error('Erro ao buscar post:', error);
            res.status(500).json({ error: 'Erro ao buscar publicação.' });
        }
    },

    // Criar nova publicação
    createPost: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                content,
                attachment_url,
                attachment_type,
                attachment_name,
                carousel_images,
                post_type,
                category,
                external_link,
                link_label
            } = req.body;

            // Verificar se usuário tem empresa aprovada
            const [business] = await db.query('SELECT id FROM businesses WHERE owner_user_id = ? AND status = "approved"', [userId]);
            if (business.length === 0) {
                return res.status(403).json({ error: 'Você precisa ter uma empresa aprovada para publicar.' });
            }

            if (!content && !attachment_url) {
                return res.status(400).json({ error: 'O conteúdo ou anexo é obrigatório.' });
            }

            const validTypes = ['general', 'job', 'internship', 'course', 'event', 'product', 'news', 'project'];
            const finalType = validTypes.includes(post_type) ? post_type : 'general';

            const [result] = await db.query(
                `INSERT INTO business_posts (business_id, content, attachment_url, attachment_type, attachment_name, carousel_images, post_type, category, external_link, link_label)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    business[0].id,
                    content || '',
                    attachment_url || null,
                    attachment_type || 'image',
                    attachment_name || null,
                    carousel_images ? JSON.stringify(carousel_images) : null,
                    finalType,
                    category || 'Geral',
                    external_link || null,
                    link_label || null
                ]
            );

            const [post] = await db.query(`
                SELECT bp.*, b.company_name, b.logo_url, b.slug as business_slug
                FROM business_posts bp
                JOIN businesses b ON bp.business_id = b.id
                WHERE bp.id = ?
            `, [result.insertId]);

            // Atualizar contador de posts da empresa
            await db.query('UPDATE businesses SET posts_count = posts_count + 1 WHERE id = ?', [business[0].id]);

            // Notificar seguidores
            const [followers] = await db.query('SELECT user_id FROM business_followers WHERE business_id = ?', [business[0].id]);
            for (const follower of followers) {
                await notificationController.createNotification(
                    follower.user_id,
                    'new_post',
                    userId,
                    result.insertId,
                    `${business[0].company_name} publicou uma nova ${finalType === 'job' ? 'vaga' : finalType === 'event' ? 'evento' : 'publicação'}!`
                );
                socketHelper.sendToUser(follower.user_id, 'new_business_post', {
                    postId: result.insertId,
                    businessId: business[0].id,
                    businessName: business[0].company_name
                });
            }

            // Broadcast para feed global se não for sponsored
            socketHelper.broadcast('business_post_created', post[0]);

            res.status(201).json(post[0]);
        } catch (error) {
            console.error('Erro ao criar post:', error);
            res.status(500).json({ error: 'Erro ao criar publicação.' });
        }
    },

    // Atualizar publicação
    updatePost: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const {
                content,
                attachment_url,
                attachment_type,
                attachment_name,
                carousel_images,
                post_type,
                category,
                external_link,
                link_label
            } = req.body;

            const [post] = await db.query('SELECT * FROM business_posts WHERE id = ?', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            // Verificar permissão
            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [post[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão para editar esta publicação.' });
            }

            const updates = [];
            const values = [];

            if (content !== undefined) { updates.push('content = ?'); values.push(content); }
            if (attachment_url !== undefined) { updates.push('attachment_url = ?'); values.push(attachment_url); }
            if (attachment_type !== undefined) { updates.push('attachment_type = ?'); values.push(attachment_type); }
            if (attachment_name !== undefined) { updates.push('attachment_name = ?'); values.push(attachment_name); }
            if (carousel_images !== undefined) { updates.push('carousel_images = ?'); values.push(carousel_images ? JSON.stringify(carousel_images) : null); }
            if (post_type !== undefined) { updates.push('post_type = ?'); values.push(post_type); }
            if (category !== undefined) { updates.push('category = ?'); values.push(category); }
            if (external_link !== undefined) { updates.push('external_link = ?'); values.push(external_link); }
            if (link_label !== undefined) { updates.push('link_label = ?'); values.push(link_label); }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            await db.query(`UPDATE business_posts SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query(`
                SELECT bp.*, b.company_name, b.logo_url, b.slug as business_slug
                FROM business_posts bp
                JOIN businesses b ON bp.business_id = b.id
                WHERE bp.id = ?
            `, [id]);

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar post:', error);
            res.status(500).json({ error: 'Erro ao atualizar publicação.' });
        }
    },

    // Excluir publicação
    deletePost: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [post] = await db.query('SELECT * FROM business_posts WHERE id = ?', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [post[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão para excluir esta publicação.' });
            }

            await db.query('UPDATE business_posts SET status = "archived" WHERE id = ?', [id]);
            await db.query('UPDATE businesses SET posts_count = GREATEST(0, posts_count - 1) WHERE id = ?', [post[0].business_id]);

            socketHelper.broadcast('business_post_deleted', { id: parseInt(id) });

            res.json({ message: 'Publicação arquivada com sucesso.' });
        } catch (error) {
            console.error('Erro ao excluir post:', error);
            res.status(500).json({ error: 'Erro ao excluir publicação.' });
        }
    },

    // ============================================
    // INTERAÇÕES (LIKE, SAVE, SHARE, COMMENT)
    // ============================================

    toggleLike: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [post] = await db.query('SELECT business_id FROM business_posts WHERE id = ?', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const [existing] = await db.query('SELECT 1 FROM business_post_likes WHERE post_id = ? AND user_id = ?', [id, userId]);

            if (existing.length > 0) {
                await db.query('DELETE FROM business_post_likes WHERE post_id = ? AND user_id = ?', [id, userId]);
                await db.query('UPDATE business_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?', [id]);
                res.json({ liked: false, message: 'Curtida removida' });
            } else {
                await db.query('INSERT INTO business_post_likes (post_id, user_id) VALUES (?, ?)', [id, userId]);
                await db.query('UPDATE business_posts SET likes_count = likes_count + 1 WHERE id = ?', [id]);

                // Notificar dono do post (empresa)
                const [bizPost] = await db.query('SELECT business_id FROM business_posts WHERE id = ?', [id]);
                if (bizPost.length > 0) {
                    const [biz] = await db.query('SELECT owner_user_id, company_name FROM businesses WHERE id = ?', [bizPost[0].business_id]);
                    const [user] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
                    if (biz.length > 0 && biz[0].owner_user_id !== userId) {
                        await notificationController.createNotification(
                            biz[0].owner_user_id,
                            'like',
                            userId,
                            id,
                            `${user[0].name} curtiu a publicação da ${biz[0].company_name}.`
                        );
                        socketHelper.sendToUser(biz[0].owner_user_id, 'business_post_liked', {
                            postId: parseInt(id),
                            likerName: user[0].name
                        });
                    }
                }

                res.json({ liked: true, message: 'Publicação curtida' });
            }
        } catch (error) {
            console.error('Erro ao curtir:', error);
            res.status(500).json({ error: 'Erro ao curtir.' });
        }
    },

    toggleSave: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [post] = await db.query('SELECT id FROM business_posts WHERE id = ?', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const [existing] = await db.query('SELECT 1 FROM business_post_saves WHERE post_id = ? AND user_id = ?', [id, userId]);

            if (existing.length > 0) {
                await db.query('DELETE FROM business_post_saves WHERE post_id = ? AND user_id = ?', [id, userId]);
                await db.query('UPDATE business_posts SET saves_count = GREATEST(0, saves_count - 1) WHERE id = ?', [id]);
                res.json({ saved: false, message: 'Removido dos salvos' });
            } else {
                await db.query('INSERT INTO business_post_saves (post_id, user_id) VALUES (?, ?)', [id, userId]);
                await db.query('UPDATE business_posts SET saves_count = saves_count + 1 WHERE id = ?', [id]);
                res.json({ saved: true, message: 'Publicação salva' });
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            res.status(500).json({ error: 'Erro ao salvar.' });
        }
    },

    sharePost: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { quote } = req.body;

            const [post] = await db.query('SELECT * FROM business_posts WHERE id = ? AND status = "published"', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const [existing] = await db.query('SELECT 1 FROM business_post_shares WHERE post_id = ? AND user_id = ?', [id, userId]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Você já compartilhou esta publicação.' });
            }

            await db.query('INSERT INTO business_post_shares (post_id, user_id, quote) VALUES (?, ?, ?)', [id, userId, quote || '']);
            await db.query('UPDATE business_posts SET shares_count = shares_count + 1 WHERE id = ?', [id]);

            res.json({ message: 'Compartilhado no feed!', shareId: post[0].id });
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            res.status(500).json({ error: 'Erro ao compartilhar.' });
        }
    },

    // Comentários
    addComment: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { content, parent_id } = req.body;

            if (!content?.trim()) {
                return res.status(400).json({ error: 'Comentário não pode estar vazio.' });
            }

            const [post] = await db.query('SELECT business_id FROM business_posts WHERE id = ? AND status = "published"', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const [result] = await db.query(
                'INSERT INTO business_post_comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
                [id, userId, content, parent_id || null]
            );

            await db.query('UPDATE business_posts SET comments_count = comments_count + 1 WHERE id = ?', [id]);

            const [comment] = await db.query(`
                SELECT bpc.*, u.name as user_name, u.avatar as user_avatar
                FROM business_post_comments bpc
                JOIN users u ON bpc.user_id = u.id
                WHERE bpc.id = ?
            `, [result.insertId]);

            // Notificar dono do post (se não for ele mesmo)
            if (comment[0].user_id !== post[0].business_id) {
                const [biz] = await db.query('SELECT owner_user_id, company_name FROM businesses WHERE id = ?', [post[0].business_id]);
                if (biz.length > 0 && biz[0].owner_user_id !== userId) {
                    await notificationController.createNotification(
                        biz[0].owner_user_id,
                        'comment',
                        userId,
                        id,
                        `${comment[0].user_name} comentou na publicação da ${biz[0].company_name}.`
                    );
                    socketHelper.sendToUser(biz[0].owner_user_id, 'business_post_commented', {
                        postId: parseInt(id),
                        commenterName: comment[0].user_name
                    });
                }
            }

            // Notificar autor do comentário pai (se for resposta)
            if (parent_id) {
                const [parentComment] = await db.query('SELECT user_id FROM business_post_comments WHERE id = ?', [parent_id]);
                if (parentComment.length > 0 && parentComment[0].user_id !== userId) {
                    await notificationController.createNotification(
                        parentComment[0].user_id,
                        'comment_reply',
                        userId,
                        id,
                        `${comment[0].user_name} respondeu seu comentário.`
                    );
                }
            }

            res.status(201).json(comment[0]);
        } catch (error) {
            console.error('Erro ao comentar:', error);
            res.status(500).json({ error: 'Erro ao adicionar comentário.' });
        }
    },

    getComments: async (req, res) => {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const query = `
                SELECT bpc.*, u.name as user_name, u.avatar as user_avatar,
                ${userId ? 'EXISTS(SELECT 1 FROM business_post_likes WHERE post_id = bpc.id AND user_id = ?) as liked' : 'FALSE as liked'}
                FROM business_post_comments bpc
                JOIN users u ON bpc.user_id = u.id
                WHERE bpc.post_id = ? AND bpc.parent_id IS NULL
                ORDER BY bpc.created_at ASC
                LIMIT ? OFFSET ?
            `;
            const params = [id, parseInt(limit), offset];
            if (userId) params.unshift(userId);

            const [comments] = await db.query(query, params);

            // Buscar respostas para cada comentário
            for (const comment of comments) {
                const [replies] = await db.query(`
                    SELECT bpc.*, u.name as user_name, u.avatar as user_avatar
                    FROM business_post_comments bpc
                    JOIN users u ON bpc.user_id = u.id
                    WHERE bpc.parent_id = ?
                    ORDER BY bpc.created_at ASC
                `, [comment.id]);
                comment.replies = replies;
            }

            res.json(comments);
        } catch (error) {
            console.error('Erro ao buscar comentários:', error);
            res.status(500).json({ error: 'Erro ao buscar comentários.' });
        }
    },

    deleteComment: async (req, res) => {
        try {
            const userId = req.user.id;
            const { commentId } = req.params;

            const [comment] = await db.query('SELECT * FROM business_post_comments WHERE id = ?', [commentId]);
            if (comment.length === 0) {
                return res.status(404).json({ error: 'Comentário não encontrado.' });
            }

            const [post] = await db.query('SELECT business_id FROM business_posts WHERE id = ?', [comment[0].post_id]);
            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [post[0].business_id]);

            if (comment[0].user_id !== userId && business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão para excluir este comentário.' });
            }

            await db.query('DELETE FROM business_post_comments WHERE id = ?', [commentId]);
            await db.query('UPDATE business_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = ?', [comment[0].post_id]);

            res.json({ message: 'Comentário excluído.' });
        } catch (error) {
            console.error('Erro ao excluir comentário:', error);
            res.status(500).json({ error: 'Erro ao excluir comentário.' });
        }
    },

    // ============================================
    // MINHAS PUBLICAÇÕES (PAINEL DA EMPRESA)
    // ============================================
    getMyPosts: async (req, res) => {
        try {
            const userId = req.user.id;
            const { status, page = 1, limit = 10 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [business] = await db.query('SELECT id FROM businesses WHERE owner_user_id = ?', [userId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Você não possui uma empresa.' });
            }

            let whereClause = 'WHERE bp.business_id = ?';
            const params = [business[0].id];

            if (status) {
                whereClause += ' AND bp.status = ?';
                params.push(status);
            }

            const query = `
                SELECT bp.*,
                (SELECT COUNT(*) FROM business_post_likes WHERE post_id = bp.id) as likes_count,
                (SELECT COUNT(*) FROM business_post_comments WHERE post_id = bp.id) as comments_count,
                (SELECT COUNT(*) FROM business_post_shares WHERE post_id = bp.id) as shares_count
                FROM business_posts bp
                ${whereClause}
                ORDER BY bp.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);

            const [posts] = await db.query(query, params);

            const countQuery = `SELECT COUNT(*) as total FROM business_posts ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({ posts, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao buscar meus posts:', error);
            res.status(500).json({ error: 'Erro ao buscar publicações.' });
        }
    },

    // Estatísticas do post (para painel da empresa)
    getPostStats: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [post] = await db.query('SELECT * FROM business_posts WHERE id = ?', [id]);
            if (post.length === 0) {
                return res.status(404).json({ error: 'Publicação não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [post[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            // Views por dia (últimos 30 dias)
            const [viewsByDay] = await db.query(`
                SELECT DATE(viewed_at) as date, COUNT(*) as views
                FROM ad_impressions
                WHERE campaign_id IN (SELECT id FROM business_campaigns WHERE business_id = ?)
                AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(viewed_at)
                ORDER BY date ASC
            `, [post[0].business_id]);

            res.json({
                views_count: post[0].views_count,
                likes_count: post[0].likes_count,
                comments_count: post[0].comments_count,
                shares_count: post[0].shares_count,
                saves_count: post[0].saves_count,
                views_by_day: viewsByDay
            });
        } catch (error) {
            console.error('Erro ao buscar stats do post:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        }
    }
};

module.exports = businessPostController;