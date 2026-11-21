const db = require('../db');
const fs = require('fs');
const path = require('path');
const socketHelper = require('../socketHelper');
const crypto = require('crypto');
const { buildPrivacyWhereClause } = require('../utils/privacyHelper');

// Import new socket helper functions
const { emitMessageStatus, broadcastToGroup } = require('../socketHelper');

// Simple rate limiter (in production, use Redis)
const messageRateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 messages per minute

function checkRateLimit(userId) {
    const now = Date.now();
    const userRequests = messageRateLimiter.get(userId) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= RATE_LIMIT_MAX) {
        return false;
    }

    recentRequests.push(now);
    messageRateLimiter.set(userId, recentRequests);
    return true;
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/\//g, '&#x2F;');
}

function resolveIndividualPeerId(conversationId, currentUserId) {
    const parts = String(conversationId || '').split('_').map(Number);
    const currentId = Number(currentUserId);
    if (parts.length !== 2 || parts.some(id => !Number.isInteger(id) || id <= 0)) return null;
    if (!parts.includes(currentId)) return null;
    const peerId = parts.find(id => id !== currentId);
    return peerId && peerId !== currentId ? peerId : null;
}

const messageController = {
    // Exact total of unread direct and group messages for the authenticated user.
    getUnreadCount: async (req, res) => {
        try {
            const userId = req.user.id;
            const [rows] = await db.query(`
                SELECT (
                    SELECT COUNT(*)
                    FROM messages
                    WHERE receiver_id = ? AND status = 'enviada'
                ) + (
                    SELECT COUNT(*)
                    FROM group_messages gm
                    WHERE gm.sender_id <> ?
                      AND EXISTS (
                          SELECT 1 FROM group_members member
                          WHERE member.group_id = gm.group_id AND member.user_id = ?
                      )
                      AND gm.id > COALESCE((
                          SELECT gl.last_read_message_id
                          FROM group_last_read gl
                          WHERE gl.group_id = gm.group_id AND gl.user_id = ?
                      ), 0)
                ) AS count
            `, [userId, userId, userId, userId]);

            return res.status(200).json({ count: Number(rows[0]?.count || 0) });
        } catch (error) {
            console.error('Erro ao contar mensagens não lidas:', error);
            return res.status(500).json({ error: 'Erro ao buscar contagem de mensagens.' });
        }
    },

    // Get all conversations (individual + groups)
    getConversations: async (req, res) => {
        try {
            const loggedUserId = req.user.id;

            // Get individual conversations - with privacy filtering
            const individualQuery = `
                SELECT
                    u.id,
                    u.name,
                    u.avatar,
                    u.role,
                    u.is_online,
                    u.last_seen,
                    u.last_seen_privacy,
                    (
                        SELECT m.content FROM messages m
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
                    ) as last_message,
                    (
                        SELECT m.id FROM messages m
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
                    ) as last_message_id,
                    (
                        SELECT m.sender_id FROM messages m
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
                    ) as last_message_sender_id,
                    (
                        SELECT m.message_type FROM messages m
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
                    ) as last_message_type,
                    (
                        SELECT m.status FROM messages m
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
                    ) as last_message_status,
                    (
                        SELECT m.created_at FROM messages m
                        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
                           OR (m.sender_id = ? AND m.receiver_id = u.id)
                        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
                    ) as last_interaction,
                    (
                        SELECT COUNT(*) FROM messages m
                        WHERE m.sender_id = u.id AND m.receiver_id = ? AND m.status = 'enviada'
                    ) as unread_count
                FROM users u
                WHERE u.id != ?
                AND EXISTS (
                    SELECT 1
                    FROM messages thread_message
                    WHERE (thread_message.sender_id = u.id AND thread_message.receiver_id = ?)
                       OR (thread_message.sender_id = ? AND thread_message.receiver_id = u.id)
                )
                AND ${buildPrivacyWhereClause(loggedUserId, 'u')}
                ORDER BY last_interaction DESC, u.name ASC
            `;
            const [individuals] = await db.query(individualQuery, Array(16).fill(loggedUserId));

            // Get group conversations
            const groupQuery = `
                SELECT
                    g.id as conversation_id,
                    g.name,
                    g.description,
                    g.avatar,
                    gm.role,
                    g.created_at,
                    (
                        SELECT m.content FROM group_messages m
                        WHERE m.group_id = g.id
                        ORDER BY m.created_at DESC LIMIT 1
                    ) as last_message,
                    (
                        SELECT m.created_at FROM group_messages m
                        WHERE m.group_id = g.id
                        ORDER BY m.created_at DESC LIMIT 1
                    ) as last_interaction,
                    (
                        SELECT COUNT(*) FROM group_messages m
                        WHERE m.group_id = g.id
                        AND m.sender_id != ?
                        AND m.id > COALESCE((
                            SELECT gl.last_read_message_id
                            FROM group_last_read gl
                            WHERE gl.group_id = g.id AND gl.user_id = ?
                        ), 0)
                    ) as unread_count,
                    EXISTS(SELECT 1 FROM group_muted WHERE group_id = g.id AND user_id = ?) as is_muted,
                    EXISTS(SELECT 1 FROM group_important WHERE group_id = g.id AND user_id = ?) as is_important
                FROM groups_table g
                JOIN group_members gm ON gm.group_id = g.id
                WHERE gm.user_id = ?
                ORDER BY last_interaction DESC
            `;
            const [groups] = await db.query(groupQuery, [loggedUserId, loggedUserId, loggedUserId, loggedUserId, loggedUserId]);

            // Load all group participants/admins in batches instead of running two queries per group.
            const groupIds = groups.map(group => Number(group.conversation_id)).filter(Number.isSafeInteger);
            if (groupIds.length > 0) {
                const placeholders = groupIds.map(() => '?').join(',');
                const [allParticipants] = await db.query(`
                    SELECT gm2.group_id, u2.id, u2.name, u2.avatar, gm2.role, u2.is_online, u2.last_seen
                    FROM group_members gm2
                    JOIN users u2 ON u2.id = gm2.user_id
                    WHERE gm2.group_id IN (${placeholders})
                    ORDER BY gm2.group_id, u2.name
                `, groupIds);
                const [allAdmins] = await db.query(`
                    SELECT group_id, admin_id
                    FROM group_admins
                    WHERE group_id IN (${placeholders})
                `, groupIds);
                const [lastSenders] = await db.query(`
                    SELECT group_id, sender_name
                    FROM (
                        SELECT gm.group_id, u.name AS sender_name,
                               ROW_NUMBER() OVER (
                                   PARTITION BY gm.group_id
                                   ORDER BY gm.created_at DESC, gm.id DESC
                               ) AS row_number
                        FROM group_messages gm
                        JOIN users u ON u.id = gm.sender_id
                        WHERE gm.group_id IN (${placeholders})
                    ) ranked
                    WHERE row_number = 1
                `, groupIds);

                const participantsByGroup = new Map();
                const adminsByGroup = new Map();
                const senderByGroup = new Map();
                for (const participant of allParticipants) {
                    const key = Number(participant.group_id);
                    if (!participantsByGroup.has(key)) participantsByGroup.set(key, []);
                    const { group_id, ...member } = participant;
                    participantsByGroup.get(key).push(member);
                }
                for (const admin of allAdmins) {
                    const key = Number(admin.group_id);
                    if (!adminsByGroup.has(key)) adminsByGroup.set(key, []);
                    adminsByGroup.get(key).push(admin.admin_id);
                }
                for (const row of lastSenders) {
                    senderByGroup.set(Number(row.group_id), row.sender_name);
                }

                for (const group of groups) {
                    const key = Number(group.conversation_id);
                    group.participants = participantsByGroup.get(key) || [];
                    group.admin_ids = adminsByGroup.get(key) || [];
                    group.last_message_sender_name = senderByGroup.get(key) || 'Unknown';
                }
            }

            const conversations = [];

            // Transform individual conversations
            for (const conv of individuals) {
                const otherUser = {
                    id: conv.id,
                    name: conv.name,
                    avatar: conv.avatar,
                    role: conv.role,
                    isOnline: conv.is_online === 1 || conv.is_online === true,
                    lastSeen: conv.last_seen,
                    lastSeenPrivacy: conv.last_seen_privacy,
                };
                // Generate conversation ID for individual chats: sorted user IDs
                const conversationId = [loggedUserId, otherUser.id].sort((a, b) => a - b).join('_');
                conversations.push({
                    conversation_id: conversationId,
                    isGroup: false,
                    participants: [
                        { id: loggedUserId, name: 'Você', avatar: null, isOnline: true },
                        otherUser
                    ],
                    last_message: conv.last_message ? {
                        id: conv.last_message_id,
                        senderId: conv.last_message_sender_id,
                        content: conv.last_message,
                        senderName: Number(conv.last_message_sender_id) === Number(loggedUserId) ? 'Você' : otherUser.name,
                        type: conv.last_message_type || 'text',
                        status: conv.last_message_status || 'enviada',
                        createdAt: conv.last_interaction
                    } : null,
                    unreadCount: conv.unread_count || 0,
                    updatedAt: conv.last_interaction,
                    isPinned: false,
                    isMuted: false,
                    isImportant: false,
                });
            }

            // Transform group conversations
            for (const group of groups) {
                // participants and admin_ids are already arrays from the queries above (lines 123-136)
                const participants = group.participants || [];
                const adminIds = group.admin_ids || [];

                const lastMessageSenderName = group.last_message_sender_name || 'Unknown';

                conversations.push({
                    conversation_id: group.conversation_id,
                    isGroup: true,
                    name: group.name,
                    avatar: group.avatar,
                    description: group.description,
                    participants: participants,
                    adminIds: adminIds,
                    last_message: group.last_message ? {
                        content: group.last_message,
                        senderName: lastMessageSenderName,
                        type: 'text',
                        status: 'read',
                        createdAt: group.last_interaction
                    } : null,
                    unreadCount: group.unread_count || 0,
                    updatedAt: group.last_interaction || group.created_at,
                    isPinned: false,
                    isMuted: group.is_muted === 1 || group.is_muted === true,
                    isImportant: group.is_important === 1 || group.is_important === true,
                });
            }

            res.status(200).json({ data: conversations });
        } catch (error) {
            console.error('Error getting conversations:', error);
            res.status(500).json({ error: 'Erro ao buscar conversas' });
        }
    },

    // Get a specific conversation
    getConversation: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;

            // Check if it's a group
            const [groups] = /^\d+$/.test(String(id))
                ? await db.query('SELECT * FROM groups_table WHERE id = ?', [id])
                : [[]];

            if (groups.length > 0) {
                // It's a group
                const group = groups[0];
                const [members] = await db.query(`
                    SELECT u.id, u.name, u.avatar, gm.role, u.is_online, u.last_seen
                    FROM group_members gm
                    JOIN users u ON u.id = gm.user_id
                    WHERE gm.group_id = ?
                `, [id]);

                const [admins] = await db.query('SELECT admin_id FROM group_admins WHERE group_id = ?', [id]);

                return res.status(200).json({
                    id: group.id,
                    isGroup: true,
                    name: group.name,
                    description: group.description,
                    avatar: group.avatar,
                    participants: members,
                    adminIds: admins.map(a => a.admin_id),
                    createdAt: group.created_at,
                });
            }

            // Individual conversation IDs may be canonical "userA_userB" values.
            const peerId = String(id).includes('_') ? resolveIndividualPeerId(id, loggedUserId) : id;
            if (!Number.isInteger(Number(peerId)) || Number(peerId) <= 0 || Number(peerId) === Number(loggedUserId)) {
                return res.status(400).json({ error: 'Identificador de conversa inválido.' });
            }
            const [user] = await db.query('SELECT id, name, avatar, role, is_online, last_seen, last_seen_privacy FROM users WHERE id = ?', [peerId]);

            if (user.length === 0) {
                return res.status(404).json({ error: 'Conversa não encontrada' });
            }

            const otherUser = user[0];
            const canonicalConversationId = [Number(loggedUserId), Number(otherUser.id)].sort((a, b) => a - b).join('_');
            res.status(200).json({
                id: canonicalConversationId,
                conversationId: canonicalConversationId,
                isGroup: false,
                participants: [
                    { id: loggedUserId, name: 'Você', avatar: null, isOnline: true },
                    {
                        id: otherUser.id,
                        name: otherUser.name,
                        avatar: otherUser.avatar,
                        role: otherUser.role,
                        isOnline: otherUser.is_online === 1 || otherUser.is_online === true,
                        lastSeen: otherUser.last_seen,
                        lastSeenPrivacy: otherUser.last_seen_privacy,
                    }
                ],
            });
        } catch (error) {
            console.error('Error getting conversation:', error);
            res.status(500).json({ error: 'Erro ao buscar conversa' });
        }
    },

    // Create a new individual conversation
    createConversation: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { participantId } = req.body;

            if (!participantId) {
                return res.status(400).json({ error: 'ID do participante é obrigatório.' });
            }

            if (parseInt(participantId) === loggedUserId) {
                return res.status(400).json({ error: 'Não é possível criar conversa consigo mesmo.' });
            }

            // Check if participant exists
            const [user] = await db.query('SELECT id, name, avatar FROM users WHERE id = ?', [participantId]);
            if (user.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            // Check if conversation already exists (using messages table to find existing)
            const [existingMessages] = await db.query(`
                SELECT DISTINCT sender_id, receiver_id FROM messages
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            `, [loggedUserId, participantId, participantId, loggedUserId]);

            // Generate conversation ID in format "userId1_userId2" (sorted)
            const conversationId = [loggedUserId, participantId].sort((a, b) => a - b).join('_');

            res.status(201).json({
                id: conversationId,
                conversationId: conversationId, // For compatibility with frontend URL matching
                isGroup: false,
                participants: [
                    { id: loggedUserId, name: 'Você', avatar: null, isOnline: true },
                    { id: user[0].id, name: user[0].name, avatar: user[0].avatar, isOnline: true }
                ],
                last_message: null,
                unreadCount: 0,
                updatedAt: new Date().toISOString(),
                isPinned: false,
                isMuted: false,
                isImportant: false,
            });
        } catch (error) {
            console.error('Error creating conversation:', error);
            res.status(500).json({ error: 'Erro ao criar conversa' });
        }
    },

    // Get message history for a conversation
    getHistory: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            // Check if it's a group conversation
            const [groups] = /^\d+$/.test(String(id))
                ? await db.query('SELECT * FROM groups_table WHERE id = ?', [id])
                : [[]];

            let messages = [];
            let isGroup = false;
            let contact = null;

            if (groups.length > 0) {
                // Group messages
                isGroup = true;
                const group = groups[0];

                const [groupMessages] = await db.query(`
                    SELECT
                        gm.*,
                        u.name as sender_name,
                        u.avatar as sender_avatar
                    FROM group_messages gm
                    JOIN users u ON u.id = gm.sender_id
                    WHERE gm.group_id = ?
                    ORDER BY gm.created_at DESC
                    LIMIT ? OFFSET ?
                `, [id, limit, offset]);

                const [totalResult] = await db.query('SELECT COUNT(*) as total FROM group_messages WHERE group_id = ?', [id]);

                messages = groupMessages.map(m => ({
                    id: m.id,
                    conversationId: m.group_id,
                    senderId: m.sender_id,
                    senderName: m.sender_name,
                    senderAvatar: m.sender_avatar,
                    content: m.content,
                    type: m.message_type || 'text',
                    message_type: m.message_type || 'text',
                    status: m.status,
                    createdAt: m.created_at,
                    mediaUrl: m.media_url,
                    fileName: m.attachment_name,
                    fileSize: m.attachment_size,
                    fileType: m.attachment_type,
                }));

                contact = {
                    id: group.id,
                    isGroup: true,
                    name: group.name,
                    avatar: group.avatar,
                    description: group.description,
                };

                res.status(200).json({
                    data: messages,
                    contact: contact,
                    isGroup: true,
                    pagination: {
                        page,
                        limit,
                        total: totalResult[0].total,
                        hasMore: offset + limit < totalResult[0].total,
                    }
                });
            } else {
                // Individual messages use the same canonical ID as the conversation list.
                const peerId = String(id).includes('_') ? resolveIndividualPeerId(id, loggedUserId) : id;
                if (!Number.isInteger(Number(peerId)) || Number(peerId) <= 0 || Number(peerId) === Number(loggedUserId)) {
                    return res.status(400).json({ error: 'Identificador de conversa inválido.' });
                }
                const [user] = await db.query('SELECT id, name, avatar, role, is_online, last_seen, last_seen_privacy FROM users WHERE id = ?', [peerId]);

                if (user.length === 0) {
                    return res.status(404).json({ error: 'Conversa não encontrada' });
                }

                const otherUser = user[0];

                const [individualMessages] = await db.query(`
                    SELECT * FROM messages
                    WHERE (sender_id = ? AND receiver_id = ?)
                       OR (sender_id = ? AND receiver_id = ?)
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                `, [loggedUserId, peerId, peerId, loggedUserId, limit, offset]);

                const [totalResult] = await db.query(`
                    SELECT COUNT(*) as total FROM messages
                    WHERE (sender_id = ? AND receiver_id = ?)
                       OR (sender_id = ? AND receiver_id = ?)
                `, [loggedUserId, peerId, peerId, loggedUserId]);

                messages = individualMessages.map(m => ({
                    id: m.id,
                    conversationId: m.sender_id === loggedUserId ? m.receiver_id : m.sender_id,
                    senderId: m.sender_id,
                    senderName: m.sender_id === loggedUserId ? 'Você' : otherUser.name,
                    content: m.content,
                    type: m.message_type || 'text',
                    message_type: m.message_type || 'text',
                    status: m.status,
                    createdAt: m.created_at,
                    mediaUrl: m.media_url,
                    fileName: m.attachment_name,
                    fileSize: m.attachment_size,
                    fileType: m.attachment_type,
                }));

                contact = {
                    id: otherUser.id,
                    isGroup: false,
                    name: otherUser.name,
                    avatar: otherUser.avatar,
                    participants: [
                        { id: loggedUserId, name: 'Você', avatar: null, isOnline: true },
                        {
                            id: otherUser.id,
                            name: otherUser.name,
                            avatar: otherUser.avatar,
                            role: otherUser.role,
                            isOnline: otherUser.is_online === 1 || otherUser.is_online === true,
                            lastSeen: otherUser.last_seen,
                            lastSeenPrivacy: otherUser.last_seen_privacy,
                        }
                    ],
                };

                // Mark messages as read
                await db.query(
                    "UPDATE messages SET status = 'lida' WHERE sender_id = ? AND receiver_id = ? AND status = 'enviada'",
                    [peerId, loggedUserId]
                );

                res.status(200).json({
                    data: messages,
                    contact: contact,
                    isGroup: false,
                    pagination: {
                        page,
                        limit,
                        total: totalResult[0].total,
                        hasMore: offset + limit < totalResult[0].total,
                    }
                });
            }
        } catch (error) {
            console.error('Error getting history:', error);
            res.status(500).json({ error: 'Erro ao buscar histórico de mensagens' });
        }
    },

    // Send a message (individual or group)
    sendMessage: async (req, res) => {
        try {
            // Rate limiting
            if (!checkRateLimit(req.user.id)) {
                return res.status(429).json({ error: 'Muitas mensagens enviadas. Tente novamente em um minuto.' });
            }

            const senderId = req.user.id;
            // Get conversationId from route params (the route is /conversations/:id/messages)
            const conversationId = req.params.id;
            const { content, type, message_type, mediaUrl, media_url, fileName, file_name, fileSize, file_size, fileType, file_type, attachments, receiverId } = req.body;
            // Stable idempotency key reused by automatic retries and offline replay.
            const clientMessageId = String(req.body.clientMessageId || req.body.client_message_id || crypto.randomUUID()).trim().slice(0, 128);

            // Process attachments array if present (frontend sends as attachments[N][mediaUrl] etc.)
            let processedAttachments = [];
            if (attachments && Array.isArray(attachments)) {
                processedAttachments = attachments.filter(a => a && a.mediaUrl);
            }

            // Use first attachment if no flat fields provided
            const finalMediaUrl = mediaUrl || media_url || (processedAttachments[0]?.mediaUrl);
            const finalFileName = fileName || file_name || (processedAttachments[0]?.fileName);
            const finalFileSize = fileSize || file_size || (processedAttachments[0]?.fileSize);
            const finalFileType = fileType || file_type || (processedAttachments[0]?.fileType);
            const finalMessageType = type || message_type || (processedAttachments[0]?.messageType) || 'text';

            if (!conversationId || (!content && !finalMediaUrl && processedAttachments.length === 0)) {
                return res.status(400).json({ error: 'Conversa e conteúdo (ou mídia) são obrigatórios.' });
            }

            // Sanitize content
            const sanitizedContent = sanitizeInput(content || '');

            // Check if it's a group - only if conversationId is a valid integer (not individual format like "1_3")
            const isGroupConversation = Number.isInteger(Number(conversationId)) && !conversationId.includes('_');
            let groups = [];
            if (isGroupConversation) {
                [groups] = await db.query('SELECT * FROM groups_table WHERE id = ?', [conversationId]);
            }

            if (groups.length > 0) {
                // Group message - verify user is member
                const [memberCheck] = await db.query(
                    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                    [conversationId, senderId]
                );
                if (memberCheck.length === 0) {
                    return res.status(403).json({ error: 'Você não é membro deste grupo.' });
                }

                const messageType = finalMessageType;
                const [insertResult] = await db.query(
                    `INSERT INTO group_messages
                        (group_id, sender_id, content, status, message_type, media_url,
                         attachment_name, attachment_size, attachment_type, client_message_id)
                     VALUES (?, ?, ?, 'enviada', ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (client_message_id) DO NOTHING
                     RETURNING id`,
                    [conversationId, senderId, sanitizedContent, messageType, finalMediaUrl || null,
                     finalFileName || null, finalFileSize || null, finalFileType || null, clientMessageId]
                );
                const wasCreated = Boolean(insertResult.insertId);
                const lookupSql = wasCreated
                    ? 'SELECT * FROM group_messages WHERE id = ?'
                    : 'SELECT * FROM group_messages WHERE client_message_id = ? AND sender_id = ? AND group_id = ?';
                const lookupParams = wasCreated
                    ? [insertResult.insertId]
                    : [clientMessageId, senderId, conversationId];
                const [newMessage] = await db.query(lookupSql, lookupParams);
                const message = newMessage[0];
                if (!message) {
                    return res.status(409).json({ error: 'O identificador desta mensagem já foi utilizado em outra conversa.' });
                }

                const [senderRows] = await db.query('SELECT name, avatar FROM users WHERE id = ?', [senderId]);
                const sender = senderRows[0] || { name: req.user.name, avatar: null };

                {
                    const [members] = await db.query(
                        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
                        [conversationId, senderId]
                    );
                    const eventPayload = {
                        id: message.id,
                        clientMessageId,
                        conversationId: message.group_id,
                        senderId: message.sender_id,
                        senderName: sender.name,
                        senderAvatar: sender.avatar,
                        content: message.content,
                        type: message.message_type,
                        message_type: message.message_type,
                        status: message.status,
                        createdAt: message.created_at,
                        mediaUrl: message.media_url,
                        fileName: message.attachment_name,
                        fileSize: message.attachment_size,
                        fileType: message.attachment_type,
                    };
                    for (const member of members) socketHelper.sendToUser(member.user_id, 'new_message', eventPayload);
                }

                return res.status(wasCreated ? 201 : 200).json({
                    id: message.id,
                    clientMessageId,
                    conversationId: message.group_id,
                    senderId: message.sender_id,
                    senderName: sender.name,
                    senderAvatar: sender.avatar,
                    content: message.content,
                    type: message.message_type,
                    message_type: message.message_type,
                    status: message.status,
                    createdAt: message.created_at,
                    mediaUrl: message.media_url,
                    fileName: message.attachment_name,
                    fileSize: message.attachment_size,
                    fileType: message.attachment_type,
                });
            } else {
                // Individual message - parse receiverId from conversationId (format: "userId1_userId2" sorted)
                const participants = String(conversationId).split('_').map(Number);
                if (
                    participants.length !== 2 ||
                    participants.some(id => !Number.isSafeInteger(id) || id <= 0) ||
                    participants[0] === participants[1] ||
                    !participants.includes(Number(senderId))
                ) {
                    return res.status(400).json({ error: 'Identificador de conversa inválido.' });
                }

                const receiverId = participants[0] === Number(senderId) ? participants[1] : participants[0];
                if (req.body.receiverId && Number(req.body.receiverId) !== receiverId) {
                    return res.status(403).json({ error: 'O destinatário não pertence a esta conversa.' });
                }

                // Verify receiver exists
                const [receiver] = await db.query('SELECT id, name FROM users WHERE id = ?', [receiverId]);
                if (receiver.length === 0) {
                    return res.status(404).json({ error: 'Destinatário não encontrado.' });
                }

                const messageType = finalMessageType;
                const [insertResult] = await db.query(
                    `INSERT INTO messages
                        (sender_id, receiver_id, content, status, message_type, media_url,
                         attachment_name, attachment_size, attachment_type, client_message_id)
                     VALUES (?, ?, ?, 'enviada', ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (client_message_id) DO NOTHING
                     RETURNING id`,
                    [senderId, receiverId, sanitizedContent, messageType, finalMediaUrl || null,
                     finalFileName || null, finalFileSize || null, finalFileType || null, clientMessageId]
                );
                const wasCreated = Boolean(insertResult.insertId);
                const lookupSql = wasCreated
                    ? 'SELECT * FROM messages WHERE id = ?'
                    : 'SELECT * FROM messages WHERE client_message_id = ? AND sender_id = ? AND receiver_id = ?';
                const lookupParams = wasCreated
                    ? [insertResult.insertId]
                    : [clientMessageId, senderId, receiverId];
                const [newMessage] = await db.query(lookupSql, lookupParams);
                const message = newMessage[0];
                if (!message) {
                    return res.status(409).json({ error: 'O identificador desta mensagem já foi utilizado em outra conversa.' });
                }

                if (Number(receiverId) !== Number(senderId)) {
                    // Persist the notification once; safely re-emit the same message on idempotent retries.
                    if (wasCreated) {
                        const notificationController = require('./notificationController');
                        await notificationController.createNotification(
                            receiverId,
                            'message',
                            senderId,
                            'enviou uma mensagem.',
                            'message',
                            message.id,
                            `message_${message.id}`,
                            { action: 'message', message_id: message.id, conversation_id: conversationId }
                        );
                    }

                    socketHelper.sendToUser(receiverId, 'new_message', {
                        id: message.id,
                        clientMessageId,
                        conversationId,
                        senderId: message.sender_id,
                        receiverId,
                        senderName: req.user.name,
                        content: message.content,
                        type: message.message_type,
                        message_type: message.message_type,
                        status: message.status,
                        createdAt: message.created_at,
                        mediaUrl: message.media_url,
                        fileName: message.attachment_name,
                        fileSize: message.attachment_size,
                        fileType: message.attachment_type,
                    });
                }

                return res.status(wasCreated ? 201 : 200).json({
                    id: message.id,
                    clientMessageId,
                    conversationId,
                    senderId: message.sender_id,
                    senderName: req.user.name,
                    content: message.content,
                    type: message.message_type,
                    message_type: message.message_type,
                    status: message.status,
                    createdAt: message.created_at,
                    mediaUrl: message.media_url,
                    fileName: message.attachment_name,
                    fileSize: message.attachment_size,
                    fileType: message.attachment_type,
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ error: 'Erro ao enviar mensagem' });
        }
    },

    // Upload media for messages
    uploadMedia: async (req, res) => {
        try {
            // Multer puts file in req.file for single file upload
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const file = req.file;
            const uploadDir = path.join(__dirname, '../uploads/messages');

            // Create directory if it doesn't exist
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const filePath = path.join(uploadDir, fileName);

            // Write file to disk
            fs.writeFileSync(filePath, file.buffer);

            const fileUrl = `/uploads/messages/${fileName}`;

            res.status(200).json({
                url: fileUrl,
                fileName: file.originalname,
                fileSize: file.size,
                fileType: file.mimetype,
            });
        } catch (error) {
            console.error('Error uploading media:', error);
            res.status(500).json({ error: 'Erro ao fazer upload do arquivo' });
        }
    },

    // Mark messages as read
    markAsRead: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;

            // Check if it's a group
            const [groups] = /^\d+$/.test(String(id))
                ? await db.query('SELECT * FROM groups_table WHERE id = ?', [id])
                : [[]];

            if (groups.length > 0) {
                // Group - update last read message
                const [lastMessage] = await db.query(
                    'SELECT id FROM group_messages WHERE group_id = ? ORDER BY created_at DESC LIMIT 1',
                    [id]
                );

                if (lastMessage.length > 0) {
                    await db.query(`
                        INSERT INTO group_last_read (group_id, user_id, last_read_message_id)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE last_read_message_id = ?
                    `, [id, loggedUserId, lastMessage[0].id, lastMessage[0].id]);

                    socketHelper.sendToUser(loggedUserId, 'messages_read', {
                        conversationId: id,
                        byUserId: loggedUserId
                    });
                }
            } else {
                // Individual IDs are canonical "userA_userB" values; resolve and validate the peer.
                const peerId = String(id).includes('_') ? resolveIndividualPeerId(id, loggedUserId) : id;
                if (!Number.isInteger(Number(peerId)) || Number(peerId) <= 0 || Number(peerId) === Number(loggedUserId)) {
                    return res.status(400).json({ error: 'Identificador de conversa inválido.' });
                }

                await db.query(
                    "UPDATE messages SET status = 'lida' WHERE sender_id = ? AND receiver_id = ? AND status = 'enviada'",
                    [peerId, loggedUserId]
                );

                socketHelper.sendToUser(peerId, 'messages_read', {
                    conversationId: id,
                    byUserId: loggedUserId
                });
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error marking as read:', error);
            res.status(500).json({ error: 'Erro ao marcar como lida' });
        }
    },

    // Typing start
    typingStart: async (req, res) => {
        try {
            const { conversationId } = req.body;

            if (conversationId) {
                // Get conversation participants to send typing indicator
                const [groups] = await db.query('SELECT * FROM groups_table WHERE id = ?', [conversationId]);

                if (groups.length > 0) {
                    // Group - send to all members except sender
                    const [members] = await db.query(
                        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
                        [conversationId, req.user.id]
                    );
                    for (const member of members) {
                        socketHelper.sendToUser(member.user_id, 'typing_start', {
                            conversationId,
                            userId: req.user.id,
                            userName: req.user.name,
                        });
                    }
                } else {
                    // Individual - need receiverId from body
                    const { receiverId } = req.body;
                    if (receiverId) {
                        socketHelper.sendToUser(receiverId, 'typing_start', {
                            conversationId,
                            userId: req.user.id,
                            userName: req.user.name,
                        });
                    }
                }
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error sending typing start:', error);
            res.status(500).json({ error: 'Erro ao enviar indicador de digitação' });
        }
    },

    // Typing stop
    typingStop: async (req, res) => {
        try {
            const { conversationId } = req.body;

            if (conversationId) {
                const [groups] = await db.query('SELECT * FROM groups_table WHERE id = ?', [conversationId]);

                if (groups.length > 0) {
                    // Group - send to all members except sender
                    const [members] = await db.query(
                        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
                        [conversationId, req.user.id]
                    );
                    for (const member of members) {
                        socketHelper.sendToUser(member.user_id, 'typing_stop', {
                            conversationId,
                            userId: req.user.id,
                        });
                    }
                } else {
                    // Individual - the frontend handles via socket
                    socketHelper.broadcast('typing_stop', {
                        conversationId,
                        userId: req.user.id,
                    });
                }
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error sending typing stop:', error);
            res.status(500).json({ error: 'Erro ao parar indicador de digitação' });
        }
    },

    // Toggle group mute
    toggleGroupMute: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;
            const { mute } = req.body;

            if (mute) {
                await db.query(
                    'INSERT INTO group_muted (group_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE muted_at = NOW()',
                    [id, loggedUserId]
                );
            } else {
                await db.query(
                    'DELETE FROM group_muted WHERE group_id = ? AND user_id = ?',
                    [id, loggedUserId]
                );
            }

            res.status(200).json({ success: true, muted: mute });
        } catch (error) {
            console.error('Error toggling group mute:', error);
            res.status(500).json({ error: 'Erro ao alterar silenciamento do grupo' });
        }
    },

    // Toggle group important
    toggleGroupImportant: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;
            const { important } = req.body;

            if (important) {
                await db.query(
                    'INSERT INTO group_important (group_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE marked_at = NOW()',
                    [id, loggedUserId]
                );
            } else {
                await db.query(
                    'DELETE FROM group_important WHERE group_id = ? AND user_id = ?',
                    [id, loggedUserId]
                );
            }

            res.status(200).json({ success: true, important });
        } catch (error) {
            console.error('Error toggling group important:', error);
            res.status(500).json({ error: 'Erro ao alterar importância do grupo' });
        }
    },

    // Add member to group
    addGroupMember: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;
            const { userId } = req.body;

            // Verify user is admin
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, loggedUserId]
            );
            if (adminCheck.length === 0) {
                return res.status(403).json({ error: 'Apenas administradores podem adicionar membros.' });
            }

            // Verify user exists
            const [user] = await db.query('SELECT id, name, avatar FROM users WHERE id = ?', [userId]);
            if (user.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            // Check if already member
            const [existing] = await db.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Usuário já é membro do grupo.' });
            }

            // Add member
            await db.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                [id, userId, 'member']
            );

            // Emit group event
            broadcastToGroup(id, 'group_member_joined', {
                groupId: id,
                userId: userId,
                userName: user[0].name,
                timestamp: Date.now()
            }, loggedUserId);

            res.status(201).json({ success: true, message: 'Membro adicionado com sucesso.' });
        } catch (error) {
            console.error('Error adding group member:', error);
            res.status(500).json({ error: 'Erro ao adicionar membro ao grupo' });
        }
    },

    // Remove member from group
    removeGroupMember: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id, userId } = req.params;

            // Verify user is admin or removing themselves
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, loggedUserId]
            );
            const isAdmin = adminCheck.length > 0;
            const isSelf = parseInt(userId) === loggedUserId;

            if (!isAdmin && !isSelf) {
                return res.status(403).json({ error: 'Sem permissão para remover este membro.' });
            }

            // Cannot remove admin unless you're also admin
            if (!isSelf) {
                const [targetAdminCheck] = await db.query(
                    'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                    [id, userId]
                );
                if (targetAdminCheck.length > 0 && !isAdmin) {
                    return res.status(403).json({ error: 'Não é possível remover um administrador.' });
                }
            }

            // Remove member
            await db.query(
                'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );

            // Also remove from admins if they were one
            await db.query(
                'DELETE FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, userId]
            );

            // Emit group event
            broadcastToGroup(id, 'group_member_left', {
                groupId: id,
                userId: parseInt(userId),
                timestamp: Date.now()
            });

            res.status(200).json({ success: true, message: 'Membro removido com sucesso.' });
        } catch (error) {
            console.error('Error removing group member:', error);
            res.status(500).json({ error: 'Erro ao remover membro do grupo' });
        }
    },

    // Change member admin status
    changeGroupAdmin: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;
            const { userId, isAdmin } = req.body;

            // Verify user is admin
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, loggedUserId]
            );
            if (adminCheck.length === 0) {
                return res.status(403).json({ error: 'Apenas administradores podem alterar administradores.' });
            }

            // Verify target user is member
            const [memberCheck] = await db.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );
            if (memberCheck.length === 0) {
                return res.status(404).json({ error: 'Usuário não é membro do grupo.' });
            }

            if (isAdmin) {
                await db.query(
                    'INSERT INTO group_admins (group_id, admin_id, assigned_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE assigned_by = ?',
                    [id, userId, loggedUserId, loggedUserId]
                );
            } else {
                await db.query(
                    'DELETE FROM group_admins WHERE group_id = ? AND admin_id = ?',
                    [id, userId]
                );
            }

            // Emit group event
            broadcastToGroup(id, 'group_admin_changed', {
                groupId: id,
                userId: parseInt(userId),
                isAdmin: isAdmin,
                timestamp: Date.now()
            });

            res.status(200).json({ success: true, message: isAdmin ? 'Administrador adicionado' : 'Administrador removido' });
        } catch (error) {
            console.error('Error changing group admin:', error);
            res.status(500).json({ error: 'Erro ao alterar administrador do grupo' });
        }
    },

    // Update group info
    updateGroup: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;
            const { name, description, avatar } = req.body;

            // Verify user is admin
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, loggedUserId]
            );
            if (adminCheck.length === 0) {
                return res.status(403).json({ error: 'Apenas administradores podem atualizar o grupo.' });
            }

            const updates = [];
            const values = [];

            if (name) {
                updates.push('name = ?');
                values.push(name);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }
            if (avatar !== undefined) {
                updates.push('avatar = ?');
                values.push(avatar);
            }

            if (updates.length > 0) {
                values.push(id);
                await db.query(`UPDATE groups_table SET ${updates.join(', ')} WHERE id = ?`, values);
            }

            // Emit group event
            broadcastToGroup(id, 'group_updated', {
                groupId: id,
                name,
                description,
                avatar,
                timestamp: Date.now()
            });

            res.status(200).json({ success: true, message: 'Grupo atualizado com sucesso.' });
        } catch (error) {
            console.error('Error updating group:', error);
            res.status(500).json({ error: 'Erro ao atualizar grupo' });
        }
    },

    // Delete group
    deleteGroup: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const { id } = req.params;

            // Verify user is admin
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, loggedUserId]
            );
            if (adminCheck.length === 0) {
                return res.status(403).json({ error: 'Apenas administradores podem excluir o grupo.' });
            }

            // Delete group and related data
            await db.query('DELETE FROM group_messages WHERE group_id = ?', [id]);
            await db.query('DELETE FROM group_members WHERE group_id = ?', [id]);
            await db.query('DELETE FROM group_admins WHERE group_id = ?', [id]);
            await db.query('DELETE FROM group_muted WHERE group_id = ?', [id]);
            await db.query('DELETE FROM group_important WHERE group_id = ?', [id]);
            await db.query('DELETE FROM group_last_read WHERE group_id = ?', [id]);
            await db.query('DELETE FROM groups_table WHERE id = ?', [id]);

            // Emit group event
            broadcastToGroup(id, 'group_deleted', {
                groupId: id,
                timestamp: Date.now()
            });

            res.status(200).json({ success: true, message: 'Grupo excluído com sucesso.' });
        } catch (error) {
            console.error('Error deleting group:', error);
            res.status(500).json({ error: 'Erro ao excluir grupo' });
        }
    }
};

module.exports = messageController;