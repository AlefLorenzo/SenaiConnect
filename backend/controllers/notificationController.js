const db = require('../db');
const socketHelper = require('../socketHelper');

const notificationController = {
    // Get notifications with filtering, grouping, and chronological sections
    getNotifications: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                filter = 'all',      // all, followers, likes, comments, mentions, stories, others
                limit = 50,
                offset = 0,
                group = 'true'       // enable grouping
            } = req.query;

            // Build WHERE clause based on filter
            let whereClause = 'n.user_id = ?';
            const params = [userId];

            // Map frontend filters to activity_type values
            const filterMap = {
                'followers': "n.activity_type IN ('follow', 'follow_accepted')",
                'likes': "n.activity_type IN ('like', 'post_like')",
                'comments': "n.activity_type IN ('comment', 'post_comment', 'comment_reply')",
                'mentions': "n.activity_type IN ('mention', 'story_mention', 'comment_mention')",
                'stories': "n.activity_type IN ('story_reaction', 'story_reply', 'story_view', 'story_mention')",
                'others': "n.activity_type IN ('group_invite', 'group_post', 'event_reminder', 'notice', 'message')",
            };

            if (filter !== 'all' && filterMap[filter]) {
                whereClause += ` AND (${filterMap[filter]})`;
            }

            // Get total count for pagination
            const [countResult] = await db.query(
                `SELECT COUNT(*) as total FROM notifications n WHERE ${whereClause}`,
                params
            );
            const total = countResult[0].total;

            // Fetch notifications with sender info
            const [notifications] = await db.query(
                `SELECT n.*, u.name as source_user_name, u.avatar as source_user_avatar
                 FROM notifications n
                 LEFT JOIN users u ON n.sender_id = u.id
                 WHERE ${whereClause}
                 ORDER BY n.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, parseInt(limit), parseInt(offset)]
            );

            // Map DB columns to frontend-expected format
            let mapped = notifications.map(n => ({
                ...n,
                source_user_id: n.sender_id,
                post_id: n.reference_id,
                reference_type: n.reference_type,
                reference_id: n.reference_id,
                activity_type: n.activity_type,
                grouping_id: n.grouping_id,
                metadata: n.metadata,
                read: n.status === 'read',
                read_at: n.read_at,
            }));

            // Group repeated activities if requested
            if (group === 'true') {
                mapped = groupActivities(mapped);
            }

            // Organize into chronological sections
            const sections = organizeIntoSections(mapped);

            res.status(200).json({
                sections,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + mapped.length < total
            });
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
            res.status(500).json({ error: 'Erro ao buscar notificações.' });
        }
    },

    // Mark a single notification as read
    markAsRead: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            await db.query(
                "UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = ? AND user_id = ?",
                [id, userId]
            );

            // If this notification has a grouping_id, mark all in group as read
            const [notification] = await db.query(
                'SELECT grouping_id FROM notifications WHERE id = ?', [id]
            );

            if (notification.length > 0 && notification[0].grouping_id) {
                await db.query(
                    "UPDATE notifications SET status = 'read', read_at = NOW() WHERE grouping_id = ? AND user_id = ?",
                    [notification[0].grouping_id, userId]
                );
            }

            res.status(200).json({ message: 'Notificação marcada como lida.' });
        } catch (error) {
            console.error('Erro ao atualizar notificação:', error);
            res.status(500).json({ error: 'Erro ao atualizar notificação.' });
        }
    },

    // Mark all notifications as read (optionally filtered)
    markAllAsRead: async (req, res) => {
        try {
            const userId = req.user.id;
            const { filter = 'all' } = req.body;

            let whereClause = 'user_id = ? AND status = "unread"';
            const params = [userId];

            const filterMap = {
                'followers': "activity_type IN ('follow', 'follow_accepted')",
                'likes': "activity_type IN ('like', 'post_like')",
                'comments': "activity_type IN ('comment', 'post_comment', 'comment_reply')",
                'mentions': "activity_type IN ('mention', 'story_mention', 'comment_mention')",
                'stories': "activity_type IN ('story_reaction', 'story_reply', 'story_view', 'story_mention')",
                'others': "activity_type IN ('group_invite', 'group_post', 'event_reminder', 'notice', 'message')",
            };

            if (filter !== 'all' && filterMap[filter]) {
                whereClause += ` AND (${filterMap[filter]})`;
            }

            const [result] = await db.query(
                `UPDATE notifications SET status = 'read', read_at = NOW() WHERE ${whereClause}`,
                params
            );

            res.status(200).json({
                message: 'Todas as notificações marcadas como lidas.',
                updated: result.affectedRows
            });
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
            res.status(500).json({ error: 'Erro ao marcar todas como lidas.' });
        }
    },

    // Get unread count (for badge)
    getUnreadCount: async (req, res) => {
        try {
            const userId = req.user.id;
            const [result] = await db.query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND status = "unread"',
                [userId]
            );
            res.status(200).json({ count: result[0].count });
        } catch (error) {
            console.error('Erro ao buscar contagem:', error);
            res.status(500).json({ error: 'Erro ao buscar contagem.' });
        }
    },

    // Create notification (enhanced for Activity Center)
    createNotification: async (userId, activityType, senderId, content, referenceType = null, referenceId = null, groupingId = null, metadata = null) => {
        try {
            if (userId === senderId) return; // Don't notify yourself

            // Determine legacy type for backward compatibility
            const legacyTypeMap = {
                'follow': 'follow',
                'follow_accepted': 'follow',
                'like': 'like',
                'post_like': 'like',
                'comment': 'comment',
                'post_comment': 'comment',
                'comment_reply': 'comment',
                'mention': 'mention',
                'story_mention': 'mention',
                'comment_mention': 'mention',
                'story_reaction': 'story_interaction',
                'story_reply': 'story_interaction',
                'story_view': 'story_interaction',
                'group_invite': 'group',
                'group_post': 'group',
                'event_reminder': 'event',
                'notice': 'notice',
                'message': 'message',
            };
            const legacyType = legacyTypeMap[activityType] || 'notification';

            const [result] = await db.query(
                `INSERT INTO notifications
                (user_id, activity_type, type, sender_id, content, reference_type, reference_id, grouping_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, activityType, legacyType, senderId, content, referenceType, referenceId, groupingId, metadata ? JSON.stringify(metadata) : null]
            );

            // Fetch notification details to emit
            const [notifications] = await db.query(
                `SELECT n.*, u.name as source_user_name, u.avatar as source_user_avatar
                 FROM notifications n
                 LEFT JOIN users u ON n.sender_id = u.id
                 WHERE n.id = ?`,
                [result.insertId]
            );

            if (notifications.length > 0) {
                const n = notifications[0];
                socketHelper.sendToUser(userId, 'new_notification', {
                    ...n,
                    source_user_id: n.sender_id,
                    post_id: n.reference_id,
                    reference_type: n.reference_type,
                    reference_id: n.reference_id,
                    activity_type: n.activity_type,
                    grouping_id: n.grouping_id,
                    metadata: n.metadata,
                    read: false
                });
            }

            return result.insertId;
        } catch (error) {
            console.error('Erro ao criar notificação:', error);
        }
    },

    // Create grouped notification (for multiple similar activities)
    createGroupedNotification: async (userId, activityType, senderIds, content, referenceType, referenceId, metadata = null) => {
        try {
            // Filter out self-notifications
            const validSenderIds = senderIds.filter(id => id !== userId);
            if (validSenderIds.length === 0) return;

            // Generate grouping ID based on reference
            const groupingId = `${referenceType}_${referenceId}_${activityType}_${Date.now()}`;

            // Create individual notifications for each sender (for proper sender info)
            // But use same grouping_id for grouping in UI
            for (const senderId of validSenderIds) {
                await notificationController.createNotification(
                    userId, activityType, senderId, content, referenceType, referenceId, groupingId, metadata
                );
            }
        } catch (error) {
            console.error('Erro ao criar notificação agrupada:', error);
        }
    },
};

// Helper: Group repeated activities
function groupActivities(notifications) {
    const groups = new Map();
    const ungrouped = [];

    for (const n of notifications) {
        if (n.grouping_id) {
            if (!groups.has(n.grouping_id)) {
                groups.set(n.grouping_id, {
                    ...n,
                    isGrouped: true,
                    groupCount: 1,
                    groupMembers: [n],
                    // Use the latest timestamp for sorting
                    created_at: n.created_at,
                });
            } else {
                const group = groups.get(n.grouping_id);
                group.groupCount++;
                group.groupMembers.push(n);
                // Update content to show count
                if (group.groupCount === 2) {
                    // Modify first member's content to indicate grouping
                    group.content = `${group.source_user_name} e mais ${group.groupCount - 1} pessoa(s) ${getActivityVerb(group.activity_type)}`;
                } else {
                    group.content = `${group.source_user_name} e mais ${group.groupCount - 1} pessoa(s) ${getActivityVerb(group.activity_type)}`;
                }
                // Keep the latest timestamp
                if (new Date(n.created_at) > new Date(group.created_at)) {
                    group.created_at = n.created_at;
                }
            }
        } else {
            ungrouped.push(n);
        }
    }

    // Combine grouped and ungrouped, sort by created_at
    const allActivities = [...groups.values(), ...ungrouped];
    allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return allActivities;
}

// Helper: Get activity verb for grouped content
function getActivityVerb(activityType) {
    const verbs = {
        'follow': 'começaram a seguir você',
        'follow_accepted': 'aceitaram seu pedido',
        'like': 'curtiram sua publicação',
        'post_like': 'curtiram sua publicação',
        'comment': 'comentaram na sua publicação',
        'post_comment': 'comentaram na sua publicação',
        'comment_reply': 'responderam ao seu comentário',
        'mention': 'mencionaram você',
        'story_mention': 'mencionaram você em uma história',
        'comment_mention': 'mencionaram você em um comentário',
        'story_reaction': 'reagiram à sua história',
        'story_reply': 'responderam à sua história',
        'story_view': 'visualizaram sua história',
        'group_invite': 'convidaram você para um grupo',
        'group_post': 'publicaram no grupo',
        'event_reminder': 'lembrete de evento',
        'notice': 'novo aviso institucional',
        'message': 'nova mensagem',
    };
    return verbs[activityType] || 'interagiram';
}

// Helper: Organize activities into chronological sections
function organizeIntoSections(activities) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

    const sections = {
        today: { label: 'Hoje', activities: [] },
        yesterday: { label: 'Ontem', activities: [] },
        thisWeek: { label: 'Esta semana', activities: [] },
        earlier: { label: 'Anteriores', activities: [] },
    };

    for (const activity of activities) {
        const createdAt = new Date(activity.created_at);

        if (createdAt >= today) {
            sections.today.activities.push(activity);
        } else if (createdAt >= yesterday) {
            sections.yesterday.activities.push(activity);
        } else if (createdAt >= thisWeekStart) {
            sections.thisWeek.activities.push(activity);
        } else {
            sections.earlier.activities.push(activity);
        }
    }

    // Remove empty sections
    return Object.entries(sections)
        .filter(([, section]) => section.activities.length > 0)
        .map(([key, section]) => ({ key, ...section }));
}

module.exports = notificationController;