const db = require('../db');
const socketHelper = require('../socketHelper');
const { buildPrivacyWhereClause, buildEmailSelectClause, buildProfileVisibilityClause } = require('../utils/privacyHelper');

const storyController = {
    // Busca stories das últimas 24h com filtro de privacidade (perfil + story + exceptions)
    getAll: async (req, res) => {
        try {
            const viewerId = req.user?.id || null;

            const query = `
                SELECT s.*,
                CASE
                    WHEN s.user_id = ${viewerId || 0} THEN 1
                    WHEN EXISTS (
                        SELECT 1
                        FROM story_views sv
                        WHERE sv.story_id = s.id
                          AND sv.user_id = ${viewerId || 0}
                    ) THEN 1
                    ELSE 0
                END AS viewed,
                u.name as user_name, u.avatar as user_avatar,
                ${buildEmailSelectClause(viewerId, 'u')},
                ${buildProfileVisibilityClause(viewerId, 'u')},
                u.privacy_showProfile
                FROM stories s
                JOIN users u ON s.user_id = u.id
                WHERE s.expires_at > NOW()
                AND ${buildPrivacyWhereClause(viewerId, 'u')}
                AND (
                    s.user_id = ${viewerId || 0}
                    OR EXISTS (
                        SELECT 1
                        FROM story_privacy_exceptions spe
                        WHERE spe.story_id = s.id
                          AND spe.user_id = ${viewerId || 0}
                          AND spe.exception_type = 'include'
                    )
                    OR (
                        (
                            s.privacy = 'public'
                            OR (
                                s.privacy = 'followers'
                                AND EXISTS (
                                    SELECT 1 FROM follows
                                    WHERE follower_id = ${viewerId || 0}
                                      AND followed_id = s.user_id
                                )
                            )
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM story_privacy_exceptions spe
                            WHERE spe.story_id = s.id
                              AND spe.user_id = ${viewerId || 0}
                              AND spe.exception_type = 'exclude'
                        )
                    )
                )
                ORDER BY s.created_at DESC
            `;
            const [stories] = await db.query(query);

            // Agrupa por usuário
            const grouped = {};
            stories.forEach(story => {
                if (!grouped[story.user_id]) {
                    grouped[story.user_id] = {
                        user_id: story.user_id,
                        user_name: story.user_name,
                        user_avatar: story.user_avatar,
                        profile_visibility: story.profile_visibility,
                        profile_visible: story.profile_visible,
                        stories: []
                    };
                }
                grouped[story.user_id].stories.push({
                    id: story.id,
                    media_url: story.media_url,
                    media_type: story.media_type,
                    text_content: story.text_content,
                    background_color: story.background_color,
                    text_overlay_data: story.text_overlay_data,
                    created_at: story.created_at,
                    expires_at: story.expires_at,
                    reply_count: story.reply_count,
                    reaction_count: story.reaction_count,
                    viewed: Boolean(story.viewed)
                });
            });

            res.status(200).json(Object.values(grouped));
        } catch (error) {
            console.error('Erro ao buscar stories:', error);
            res.status(500).json({ error: 'Erro ao buscar stories.' });
        }
    },

    // Busca stories de um usuário específico (para highlights no perfil)
    getUserStories: async (req, res) => {
        try {
            const { userId } = req.params;
            const viewerId = req.user?.id || null;
            const targetId = parseInt(userId);

            // Check if viewer can see target's profile
            const [targetUser] = await db.query('SELECT privacy_showProfile, role FROM users WHERE id = ?', [targetId]);
            if (targetUser.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            if (viewerId) {
                const [viewer] = await db.query('SELECT role FROM users WHERE id = ?', [viewerId]);
                targetUser[0].viewerRole = viewer.length > 0 ? viewer[0].role : 'aluno';
            }

            const { filterUserProfile } = require('../utils/privacyHelper');
            const filtered = filterUserProfile(targetUser[0], viewerId);

            if (filtered._privacy?.restricted) {
                return res.status(403).json({ error: 'Perfil privado - stories não visíveis.' });
            }

            // Busca stories não expirados do usuário com filtro de privacidade do story
            const query = `
                SELECT s.*
                FROM stories s
                WHERE s.user_id = ?
                AND s.expires_at > NOW()
                AND (
                    s.user_id = ${viewerId || 0}
                    OR EXISTS (
                        SELECT 1
                        FROM story_privacy_exceptions spe
                        WHERE spe.story_id = s.id
                          AND spe.user_id = ${viewerId || 0}
                          AND spe.exception_type = 'include'
                    )
                    OR (
                        (
                            s.privacy = 'public'
                            OR (
                                s.privacy = 'followers'
                                AND EXISTS (
                                    SELECT 1 FROM follows
                                    WHERE follower_id = ${viewerId || 0}
                                      AND followed_id = s.user_id
                                )
                            )
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM story_privacy_exceptions spe
                            WHERE spe.story_id = s.id
                              AND spe.user_id = ${viewerId || 0}
                              AND spe.exception_type = 'exclude'
                        )
                    )
                )
                ORDER BY s.created_at DESC
            `;
            const [stories] = await db.query(query, [targetId]);

            res.status(200).json({
                user_id: targetId,
                user_name: targetUser[0].name,
                user_avatar: targetUser[0].avatar,
                stories: stories
            });
        } catch (error) {
            console.error('Erro ao buscar stories do usuário:', error);
            res.status(500).json({ error: 'Erro ao buscar stories do usuário.' });
        }
    },

    create: async (req, res) => {
        try {
            const userId = req.user.id;
            const { media_url, media_type, text_content, privacy, background_color, text_overlay_data, privacy_exceptions } = req.body;

            if (!media_url && !text_content) {
                return res.status(400).json({ error: 'O story precisa de uma imagem/vídeo ou texto.' });
            }

            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
            const storyPrivacy = privacy || 'public'; // public, followers, close_friends

            const connection = await db.getConnection();
            let storyId;
            try {
                await connection.beginTransaction();

                const [result] = await connection.execute(
                    `INSERT INTO stories (user_id, media_url, media_type, text_content, expires_at, privacy, background_color, text_overlay_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, media_url || null, media_type || null, text_content || null, expiresAt, storyPrivacy, background_color || null, text_overlay_data ? JSON.stringify(text_overlay_data) : null]
                );

                storyId = result.insertId;

                // Handle privacy exceptions (exclude/include lists)
                if (privacy_exceptions && Array.isArray(privacy_exceptions) && privacy_exceptions.length > 0) {
                    for (const exception of privacy_exceptions) {
                        if (exception.user_id && exception.exception_type) {
                            await connection.execute(
                                `INSERT INTO story_privacy_exceptions (story_id, user_id, exception_type) VALUES (?, ?, ?)
                                 ON DUPLICATE KEY UPDATE exception_type = VALUES(exception_type)`,
                                [storyId, exception.user_id, exception.exception_type]
                            );
                        }
                    }
                }

                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            // Busca o story criado com dados do user
            const [created] = await db.query(
                `SELECT s.*, u.name as user_name, u.avatar as user_avatar
                 FROM stories s JOIN users u ON s.user_id = u.id
                 WHERE s.id = ?`,
                [storyId]
            );

            // Emite via socket para todos
            socketHelper.broadcast('new_story', created[0]);

            res.status(201).json(created[0]);
        } catch (error) {
            console.error('Erro ao criar story:', error);
            res.status(500).json({ error: 'Erro ao criar story.' });
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const [story] = await db.query('SELECT user_id, media_url FROM stories WHERE id = ?', [id]);
            if (story.length === 0) return res.status(404).json({ error: 'Story não encontrado.' });
            if (story[0].user_id !== userId) return res.status(403).json({ error: 'Sem permissão.' });

            await db.query('DELETE FROM stories WHERE id = ?', [id]);

            // Emite via socket para remover dos viewers
            socketHelper.broadcast('story_deleted', { storyId: parseInt(id), userId });

            res.status(200).json({ message: 'Story excluído.' });
        } catch (error) {
            console.error('Erro ao excluir story:', error);
            res.status(500).json({ error: 'Erro ao excluir story.' });
        }
    },

    // View story - mark as viewed
    view: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // The composite primary key makes this an atomic, idempotent write.
            // Returning a row tells us whether this request created the first view.
            const [insertResult] = await db.query(
                'INSERT INTO story_views (story_id, user_id, viewed_at) VALUES (?, ?, NOW()) ' +
                'ON CONFLICT (story_id, user_id) DO NOTHING RETURNING story_id',
                [id, userId]
            );

            if (insertResult.rows?.length) {
                const [story] = await db.query('SELECT user_id FROM stories WHERE id = ?', [id]);
                if (story.length > 0 && Number(story[0].user_id) !== Number(userId)) {
                    const notificationController = require('./notificationController');
                    try {
                        await notificationController.createNotification(
                            story[0].user_id,
                            'story_view',
                            userId,
                            'visualizou sua história.',
                            'story',
                            parseInt(id, 10),
                            `story_${id}_view`,
                            { action: 'view', story_id: parseInt(id, 10) }
                        );
                    } catch (notificationError) {
                        // The view is already persisted; a notification failure must
                        // not turn a successful story view into an apparent API failure.
                        console.warn('Falha ao criar notificação de visualização de story:', notificationError.message);
                    }
                }
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Erro ao marcar story como visto:', error);
            res.status(500).json({ error: 'Erro ao marcar story como visto.' });
        }
    },

    // Get story viewers (owner only) - with timestamps
    getViewers: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Check ownership
            const [story] = await db.query('SELECT user_id FROM stories WHERE id = ?', [id]);
            if (story.length === 0) return res.status(404).json({ error: 'Story não encontrado.' });
            if (story[0].user_id !== userId) return res.status(403).json({ error: 'Apenas o dono pode ver a lista de visualizações.' });

            // Get viewers with timestamps
            const [viewers] = await db.query(`
                SELECT sv.user_id, sv.viewed_at, u.name, u.avatar, u.username
                FROM story_views sv
                JOIN users u ON sv.user_id = u.id
                WHERE sv.story_id = ?
                ORDER BY sv.viewed_at DESC
            `, [id]);

            res.status(200).json(viewers);
        } catch (error) {
            console.error('Erro ao buscar visualizações:', error);
            res.status(500).json({ error: 'Erro ao buscar visualizações.' });
        }
    },

    // Get story reactions
    getReactions: async (req, res) => {
        try {
            const { id } = req.params;

            const [reactions] = await db.query(`
                SELECT sr.reaction_type, sr.user_id, sr.created_at, u.name, u.avatar
                FROM story_reactions sr
                JOIN users u ON sr.user_id = u.id
                WHERE sr.story_id = ?
                ORDER BY sr.created_at DESC
            `, [id]);

            // Group by reaction type
            const grouped = {};
            reactions.forEach(r => {
                if (!grouped[r.reaction_type]) {
                    grouped[r.reaction_type] = { type: r.reaction_type, count: 0, users: [] };
                }
                grouped[r.reaction_type].count++;
                grouped[r.reaction_type].users.push({
                    user_id: r.user_id,
                    name: r.name,
                    avatar: r.avatar,
                    created_at: r.created_at
                });
            });

            res.status(200).json(Object.values(grouped));
        } catch (error) {
            console.error('Erro ao buscar reações:', error);
            res.status(500).json({ error: 'Erro ao buscar reações.' });
        }
    },

    // Add/remove reaction
    react: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { reaction_type } = req.body; // 'heart', 'laugh', 'wow', 'sad', 'angry', 'clap', 'pray', 'fire'

            const validReactions = ['heart', 'laugh', 'wow', 'sad', 'angry', 'clap', 'pray', 'fire'];
            if (!validReactions.includes(reaction_type)) {
                return res.status(400).json({ error: 'Tipo de reação inválido.' });
            }

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Check if reaction exists
                const [existing] = await connection.execute(
                    'SELECT * FROM story_reactions WHERE story_id = ? AND user_id = ? AND reaction_type = ?',
                    [id, userId, reaction_type]
                );

                let action = 'added';
                if (existing.length > 0) {
                    // Remove reaction
                    await connection.execute(
                        'DELETE FROM story_reactions WHERE story_id = ? AND user_id = ? AND reaction_type = ?',
                        [id, userId, reaction_type]
                    );
                    action = 'removed';
                } else {
                    // Add reaction
                    await connection.execute(
                        'INSERT INTO story_reactions (story_id, user_id, reaction_type) VALUES (?, ?, ?)',
                        [id, userId, reaction_type]
                    );
                }

                // Update reaction count on story
                const [countResult] = await connection.execute(
                    'SELECT COUNT(*) as count FROM story_reactions WHERE story_id = ?',
                    [id]
                );
                await connection.execute(
                    'UPDATE stories SET reaction_count = ? WHERE id = ?',
                    [countResult[0].count, id]
                );

                await connection.commit();

                // Get story owner for notification - Activity Center format
                const [story] = await connection.execute('SELECT user_id FROM stories WHERE id = ?', [id]);
                if (story.length > 0 && story[0].user_id !== userId && action === 'added') {
                    // Notify story owner via socket
                    const [reactor] = await connection.execute('SELECT name FROM users WHERE id = ?', [userId]);
                    socketHelper.sendToUser(story[0].user_id, 'story_reaction', {
                        storyId: parseInt(id),
                        reactionType: reaction_type,
                        fromUserId: userId,
                        fromUserName: reactor[0]?.name || 'Alguém'
                    });

                    // Create Activity Center notification
                    const notificationController = require('./notificationController');
                    await notificationController.createNotification(
                        story[0].user_id,
                        'story_reaction',
                        userId,
                        `reagiu à sua história com ${reaction_type}.`,
                        'story',
                        parseInt(id),
                        `story_${id}_reaction`,
                        { action: 'reaction', story_id: parseInt(id), reaction_type }
                    );
                }
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            res.status(200).json({ success: true, action });
        } catch (error) {
            console.error('Erro ao reagir ao story:', error);
            res.status(500).json({ error: 'Erro ao reagir ao story.' });
        }
    },

    // Get story replies
    getReplies: async (req, res) => {
        try {
            const { id } = req.params;

            const [replies] = await db.query(`
                SELECT sr.*, u.name, u.avatar, u.username
                FROM story_replies sr
                JOIN users u ON sr.user_id = u.id
                WHERE sr.story_id = ?
                ORDER BY sr.created_at ASC
            `, [id]);

            res.status(200).json(replies);
        } catch (error) {
            console.error('Erro ao buscar respostas:', error);
            res.status(500).json({ error: 'Erro ao buscar respostas.' });
        }
    },

    // Reply to a visible, active story. A reply is a normal private DM
    // linked to the original story so the chat can render its WhatsApp-style quote.
    reply: async (req, res) => {
        let connection;
        let transactionStarted = false;

        try {
            const { id } = req.params;
            const userId = Number(req.user.id);
            const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

            if (!Number.isSafeInteger(userId) || userId <= 0) {
                return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
            }
            if (!/^\d+$/.test(String(id))) {
                return res.status(400).json({ error: 'Identificador de story inválido.' });
            }
            if (!content) {
                return res.status(400).json({ error: 'A resposta não pode estar vazia.' });
            }
            if (content.length > 500) {
                return res.status(400).json({ error: 'A resposta pode ter no máximo 500 caracteres.' });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();
            transactionStarted = true;

            const [storyRows] = await connection.execute(
                `SELECT s.id, s.user_id, s.media_url, s.media_type, s.text_content,
                        s.background_color, s.created_at, s.expires_at, u.name AS owner_name
                 FROM stories s
                 JOIN users u ON u.id = s.user_id
                 WHERE s.id = ?`,
                [id]
            );

            if (!storyRows.length) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(404).json({ error: 'Story não encontrado.' });
            }

            const story = storyRows[0];
            if (story.expires_at && new Date(story.expires_at).getTime() <= Date.now()) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(410).json({ error: 'Este story expirou e não aceita mais respostas.' });
            }

            if (Number(story.user_id) === userId) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(400).json({ error: 'Você não pode responder ao seu próprio story.' });
            }

            // Reuse the same profile/story visibility rules as the stories feed.
            const [visibleStories] = await connection.execute(
                `SELECT s.id
                 FROM stories s
                 JOIN users u ON u.id = s.user_id
                 WHERE s.id = ?
                   AND ${buildPrivacyWhereClause(userId, 'u')}
                   AND (
                       s.user_id = ?
                       OR EXISTS (
                           SELECT 1
                           FROM story_privacy_exceptions spe
                           WHERE spe.story_id = s.id
                             AND spe.user_id = ?
                             AND spe.exception_type = 'include'
                       )
                       OR (
                           (
                               s.privacy = 'public'
                               OR (
                                   s.privacy = 'followers'
                                   AND EXISTS (
                                       SELECT 1 FROM follows
                                       WHERE follower_id = ?
                                         AND followed_id = s.user_id
                                   )
                               )
                           )
                           AND NOT EXISTS (
                               SELECT 1
                               FROM story_privacy_exceptions spe
                               WHERE spe.story_id = s.id
                                 AND spe.user_id = ?
                                 AND spe.exception_type = 'exclude'
                           )
                       )
                   )`,
                [id, userId, userId, userId, userId]
            );

            if (!visibleStories.length) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(404).json({ error: 'Este story não está disponível para você.' });
            }

            const ownerId = Number(story.user_id);
            const conversationId = [userId, ownerId]
                .sort((a, b) => a - b)
                .join('_');

            const [replyResult] = await connection.execute(
                'INSERT INTO story_replies (story_id, user_id, content) VALUES (?, ?, ?) RETURNING id',
                [id, userId, content]
            );
            const replyId = replyResult.insertId;

            // The current messaging system stores individual messages by sender/receiver,
            // not by a separate conversations.id. Use the same schema and canonical chat ID.
            const [messageResult] = await connection.execute(
                `INSERT INTO messages
                    (sender_id, receiver_id, content, status, message_type)
                 VALUES (?, ?, ?, 'enviada', 'story_reply')
                 RETURNING id`,
                [userId, ownerId, content]
            );
            const messageId = messageResult.insertId;

            await connection.execute(
                'UPDATE story_replies SET message_id = ? WHERE id = ?',
                [messageId, replyId]
            );
            await connection.execute(
                'UPDATE stories SET reply_count = COALESCE(reply_count, 0) + 1 WHERE id = ?',
                [id]
            );

            const [senderRows] = await connection.execute(
                'SELECT id, name, avatar FROM users WHERE id = ?',
                [userId]
            );
            const sender = senderRows[0] || { id: userId, name: req.user.name || 'Você', avatar: null };

            const [messageRows] = await connection.execute(
                'SELECT id, created_at, status FROM messages WHERE id = ?',
                [messageId]
            );
            const createdAt = messageRows[0]?.created_at || new Date().toISOString();
            const status = messageRows[0]?.status || 'enviada';
            const storyReply = {
                storyId: Number(story.id),
                ownerId,
                ownerName: story.owner_name,
                mediaUrl: story.media_url || null,
                mediaType: story.media_type || null,
                textContent: story.text_content || '',
                backgroundColor: story.background_color || null,
                createdAt: story.created_at,
            };

            await connection.commit();
            transactionStarted = false;

            // The private message is already persisted. Notification failures must not
            // undo a successful story reply or make the client retry and duplicate it.
            try {
                const notificationController = require('./notificationController');
                await notificationController.createNotification(
                    ownerId,
                    'story_reply',
                    userId,
                    'respondeu à sua história.',
                    'story',
                    Number(id),
                    `story_${id}_reply_${replyId}`,
                    { action: 'reply', story_id: Number(id), reply_id: replyId, message_id: messageId }
                );
            } catch (notificationError) {
                console.warn('Falha ao criar notificação de resposta ao story:', notificationError.message);
            }

            const messagePayload = {
                id: messageId,
                conversationId,
                conversation_id: conversationId,
                senderId: userId,
                sender_id: userId,
                receiverId: ownerId,
                receiver_id: ownerId,
                senderName: sender.name,
                sender_name: sender.name,
                senderAvatar: sender.avatar,
                sender_avatar: sender.avatar,
                content,
                type: 'story_reply',
                message_type: 'story_reply',
                status,
                createdAt,
                created_at: createdAt,
                storyReply,
                story_reply: storyReply,
            };

            try {
                socketHelper.sendToUser(ownerId, 'story_reply', {
                    storyId: Number(id),
                    replyId,
                    content,
                    fromUserId: userId,
                    fromUserName: sender.name,
                    messageId,
                    conversationId,
                });
                socketHelper.sendToUser(ownerId, 'new_message', messagePayload);
            } catch (socketError) {
                console.warn('Falha ao emitir resposta de story em tempo real:', socketError.message);
            }

            return res.status(201).json({
                id: replyId,
                replyId,
                messageId,
                conversationId,
                message: messagePayload,
            });
        } catch (error) {
            if (connection && transactionStarted) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('Erro ao reverter resposta de story:', rollbackError);
                }
            }
            console.error('Erro ao responder ao story:', error);
            return res.status(500).json({ error: 'Não foi possível enviar sua resposta. Tente novamente.' });
        } finally {
            connection?.release();
        }
    },

    // Get privacy exceptions for a story (owner only)
    getPrivacyExceptions: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const [story] = await db.query('SELECT user_id FROM stories WHERE id = ?', [id]);
            if (story.length === 0) return res.status(404).json({ error: 'Story não encontrado.' });
            if (story[0].user_id !== userId) return res.status(403).json({ error: 'Apenas o dono pode ver as exceções de privacidade.' });

            const [exceptions] = await db.query(`
                SELECT spe.user_id, spe.exception_type, u.name, u.avatar, u.username
                FROM story_privacy_exceptions spe
                JOIN users u ON spe.user_id = u.id
                WHERE spe.story_id = ?
            `, [id]);

            res.status(200).json(exceptions);
        } catch (error) {
            console.error('Erro ao buscar exceções de privacidade:', error);
            res.status(500).json({ error: 'Erro ao buscar exceções de privacidade.' });
        }
    }
};

module.exports = storyController;