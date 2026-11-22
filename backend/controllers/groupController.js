const db = require('../db');
const socketHelper = require('../socketHelper');
const { getEligibleGroupContacts, getEligibleGroupParticipantIds } = require('../utils/groupEligibility');

const groupController = {
    // Get all public groups (for discovery)
    getAll: async (req, res) => {
        try {
            const loggedUserId = req.user.id;
            const query = `
                SELECT g.*,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count,
                EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
                FROM groups_table g
                ORDER BY g.created_at DESC
            `;
            const [groups] = await db.query(query, [loggedUserId]);
            res.status(200).json(groups);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar grupos' });
        }
    },

    // Get user's groups (my groups)
    getMyGroups: async (req, res) => {
        try {
            const loggedUserId = req.user.id;

            // First, get the basic group info
            const groupQuery = `
                SELECT g.*,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count,
                gm.role,
                EXISTS(SELECT 1 FROM group_muted WHERE group_id = g.id AND user_id = ?) as is_muted,
                EXISTS(SELECT 1 FROM group_important WHERE group_id = g.id AND user_id = ?) as is_important,
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
                ) as unread_count
                FROM groups_table g
                JOIN group_members gm ON gm.group_id = g.id
                WHERE gm.user_id = ?
                ORDER BY last_interaction DESC, g.name ASC
            `;
            const [groups] = await db.query(groupQuery, [loggedUserId, loggedUserId, loggedUserId, loggedUserId, loggedUserId]);

            // For each group, fetch participants and admins separately (avoiding JSON_ARRAYAGG)
            const groupIds = groups.map(g => g.id);

            let participantsByGroup = {};
            let adminsByGroup = {};

            if (groupIds.length > 0) {
                // Fetch all participants for these groups
                const placeholders = groupIds.map(() => '?').join(',');
                const participantsQuery = `
                    SELECT gm.group_id, u.id, u.name, u.avatar, gm.role, u.is_online, u.last_seen
                    FROM group_members gm
                    JOIN users u ON u.id = gm.user_id
                    WHERE gm.group_id IN (${placeholders})
                `;
                const [participants] = await db.query(participantsQuery, groupIds);

                // Group participants by group_id
                participants.forEach(p => {
                    if (!participantsByGroup[p.group_id]) {
                        participantsByGroup[p.group_id] = [];
                    }
                    participantsByGroup[p.group_id].push({
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                        role: p.role,
                        isOnline: p.is_online,
                        lastSeen: p.last_seen
                    });
                });

                // Fetch all admins for these groups
                const adminsQuery = `
                    SELECT group_id, admin_id FROM group_admins WHERE group_id IN (${placeholders})
                `;
                const [admins] = await db.query(adminsQuery, groupIds);

                admins.forEach(a => {
                    if (!adminsByGroup[a.group_id]) {
                        adminsByGroup[a.group_id] = [];
                    }
                    adminsByGroup[a.group_id].push(a.admin_id);
                });
            }

            // Parse JSON fields
            const formattedGroups = groups.map(g => ({
                ...g,
                participants: participantsByGroup[g.id] || [],
                adminIds: adminsByGroup[g.id] || [],
                isMuted: g.is_muted === 1 || g.is_muted === true,
                isImportant: g.is_important === 1 || g.is_important === true,
                last_message: g.last_message ? {
                    content: g.last_message,
                    senderName: 'Unknown',
                    type: 'text',
                    status: 'read',
                    createdAt: g.last_interaction
                } : null,
                unreadCount: g.unread_count || 0,
                updatedAt: g.last_interaction || g.created_at
            }));

            res.status(200).json(formattedGroups);
        } catch (error) {
            console.error('Error getting my groups:', error);
            res.status(500).json({ error: 'Erro ao buscar meus grupos' });
        }
    },

    getEligibleContacts: async (req, res) => {
        try {
            const contacts = await getEligibleGroupContacts(req.user.id);
            return res.status(200).json(contacts);
        } catch (error) {
            console.error('Erro ao buscar contatos elegíveis para grupos:', error);
            return res.status(500).json({ error: 'Erro ao buscar contatos para o grupo.' });
        }
    },

    create: async (req, res) => {
        try {
            const { name, description, icon, participants } = req.body;
            const creatorId = req.user.id;

            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'O nome do grupo é obrigatório.' });
            }

            const requestedParticipantIds = Array.isArray(participants)
                ? [...new Set(participants.map(Number))].filter(id => id !== Number(creatorId))
                : [];
            if (requestedParticipantIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
                return res.status(400).json({ error: 'Um ou mais participantes são inválidos.' });
            }

            const eligibleParticipantIds = await getEligibleGroupParticipantIds(creatorId, requestedParticipantIds);
            if (eligibleParticipantIds.length !== requestedParticipantIds.length) {
                return res.status(403).json({
                    error: 'Só é possível adicionar pessoas com quem você já conversou, segue ou que seguem você.'
                });
            }

            const defaultIcon = icon || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';

            const [result] = await db.query(
                'INSERT INTO groups_table (name, description, creator_id, icon) VALUES (?, ?, ?, ?)',
                [name, description || '', creatorId, defaultIcon]
            );

            const groupId = result.insertId;

            // Criador entra automaticamente no grupo como admin
            await db.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                [groupId, creatorId, 'admin']
            );
            await db.query(
                'INSERT INTO group_admins (group_id, admin_id, assigned_by) VALUES (?, ?, ?)',
                [groupId, creatorId, creatorId]
            );

            // Add only participants validated against existing conversations/follow relationships.
            for (const userId of eligibleParticipantIds) {
                await db.query(
                    'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                    [groupId, userId, 'member']
                );
            }

            if (eligibleParticipantIds.length > 0) {
                const notificationController = require('./notificationController');
                for (const userId of eligibleParticipantIds) {
                    await notificationController.createNotification(
                        userId,
                        'group_invite',
                        creatorId,
                        `adicionou você ao grupo "${name.trim()}".`,
                        'group',
                        Number(groupId),
                        `group_${groupId}_invite`,
                        { action: 'invite', group_id: Number(groupId), group_name: name.trim() }
                    );
                }
            }

            // Emit socket event for conversation_created
            const [newGroup] = await db.query('SELECT * FROM groups_table WHERE id = ?', [groupId]);
            const [members] = await db.query(`
                SELECT u.id, u.name, u.avatar, gm.role, u.is_online, u.last_seen
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = ?
            `, [groupId]);

            socketHelper.sendGroupMessage(groupId, {
                type: 'conversation_created',
                conversation: {
                    id: groupId,
                    isGroup: true,
                    name: newGroup[0].name,
                    description: newGroup[0].description,
                    avatar: newGroup[0].avatar,
                    participants: members,
                    adminIds: [creatorId],
                    createdAt: newGroup[0].created_at
                }
            }, creatorId);

            res.status(201).json({ id: groupId, message: 'Grupo criado com sucesso!' });
        } catch (error) {
            console.error('Error creating group:', error);
            res.status(500).json({ error: 'Erro ao criar grupo' });
        }
    },

    getById: async (req, res) => {
        try {
            const { id } = req.params;
            const loggedUserId = req.user.id;
            const query = `
                SELECT g.*,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count,
                EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
                FROM groups_table g
                WHERE g.id = ?
            `;
            const [groups] = await db.query(query, [loggedUserId, id]);
            if (groups.length === 0) return res.status(404).json({ error: 'Grupo não encontrado.' });
            res.status(200).json(groups[0]);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar detalhes do grupo' });
        }
    },

    join: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const [existing] = await db.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );

            if (existing.length > 0) {
                return res.status(400).json({ error: 'Você já é membro deste grupo.' });
            }

            await db.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                [id, userId, 'member']
            );

            // Emit group_updated event
            const [members] = await db.query(`
                SELECT u.id, u.name, u.avatar, gm.role
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = ?
            `, [id]);

            socketHelper.sendGroupMessage(id, {
                type: 'group_updated',
                groupId: id,
                action: 'member_joined',
                userId,
                members
            });

            res.status(200).json({ message: 'Entrou no grupo com sucesso!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao entrar no grupo' });
        }
    },

    leave: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const [existing] = await db.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );

            if (existing.length === 0) {
                return res.status(400).json({ error: 'Você não é membro deste grupo.' });
            }

            await db.query(
                'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );
            // Also remove from admins if they were an admin
            await db.query(
                'DELETE FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, userId]
            );

            // Emit group_updated event
            const [members] = await db.query(`
                SELECT u.id, u.name, u.avatar, gm.role
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = ?
            `, [id]);

            socketHelper.sendGroupMessage(id, {
                type: 'group_updated',
                groupId: id,
                action: 'member_left',
                userId,
                members
            });

            res.status(200).json({ message: 'Saiu do grupo com sucesso!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao sair do grupo' });
        }
    },

    getMembers: async (req, res) => {
        try {
            const { id } = req.params;
            const query = `
                SELECT u.id, u.name, u.avatar, u.role, gm.role as group_role, u.is_online, u.last_seen
                FROM group_members gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = ?
                ORDER BY u.name ASC
            `;
            const [members] = await db.query(query, [id]);
            res.status(200).json(members);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar membros do grupo' });
        }
    },

    addMembers: async (req, res) => {
        try {
            const { id } = req.params;
            const { userIds } = req.body;
            const requesterId = req.user.id;

            // Check if requester is admin
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, requesterId]
            );
            if (adminCheck.length === 0) {
                return res.status(403).json({ error: 'Apenas administradores podem adicionar membros.' });
            }

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({ error: 'Lista de usuários é obrigatória.' });
            }

            const normalizedUserIds = [...new Set(userIds.map(Number))].filter(userId => userId !== Number(requesterId));
            if (normalizedUserIds.some(userId => !Number.isSafeInteger(userId) || userId <= 0)) {
                return res.status(400).json({ error: 'Um ou mais participantes são inválidos.' });
            }
            const eligibleUserIds = await getEligibleGroupParticipantIds(requesterId, normalizedUserIds);
            if (eligibleUserIds.length !== normalizedUserIds.length) {
                return res.status(403).json({
                    error: 'Só é possível adicionar pessoas com quem você já conversou, segue ou que seguem você.'
                });
            }

            const added = [];
            const groupNameResult = await db.query('SELECT name FROM groups_table WHERE id = ?', [id]);
            const groupName = groupNameResult[0]?.name || 'Grupo';

            for (const userId of normalizedUserIds) {
                const [existing] = await db.query(
                    'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                    [id, userId]
                );
                if (existing.length === 0) {
                    await db.query(
                        'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                        [id, userId, 'member']
                    );
                    added.push(userId);

                    // Create Activity Center notification for group invite
                    const notificationController = require('./notificationController');
                    await notificationController.createNotification(
                        userId,
                        'group_invite',
                        requesterId,
                        `convidou você para o grupo "${groupName}".`,
                        'group',
                        parseInt(id),
                        `group_${id}_invite`,
                        { action: 'invite', group_id: parseInt(id), group_name: groupName }
                    );
                }
            }

            // Emit group_updated event
            const [members] = await db.query(`
                SELECT u.id, u.name, u.avatar, gm.role
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = ?
            `, [id]);

            socketHelper.sendGroupMessage(id, {
                type: 'group_updated',
                groupId: id,
                action: 'members_added',
                addedUserIds: added,
                members
            }, requesterId);

            res.status(200).json({ message: `${added.length} membro(s) adicionado(s) com sucesso!`, added });
        } catch (error) {
            console.error('Error adding members:', error);
            res.status(500).json({ error: 'Erro ao adicionar membros' });
        }
    },

    removeMember: async (req, res) => {
        try {
            const { id, userId } = req.params;
            const requesterId = req.user.id;

            // Check if requester is admin or removing themselves
            const [adminCheck] = await db.query(
                'SELECT * FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, requesterId]
            );
            const isAdmin = adminCheck.length > 0;
            const isSelf = parseInt(userId) === requesterId;

            if (!isAdmin && !isSelf) {
                return res.status(403).json({ error: 'Apenas administradores podem remover outros membros.' });
            }

            const [existing] = await db.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );

            if (existing.length === 0) {
                return res.status(400).json({ error: 'Usuário não é membro deste grupo.' });
            }

            await db.query(
                'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
                [id, userId]
            );
            await db.query(
                'DELETE FROM group_admins WHERE group_id = ? AND admin_id = ?',
                [id, userId]
            );

            // Emit group_updated event
            const [members] = await db.query(`
                SELECT u.id, u.name, u.avatar, gm.role
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
                WHERE gm.group_id = ?
            `, [id]);

            socketHelper.sendGroupMessage(id, {
                type: 'group_updated',
                groupId: id,
                action: 'member_removed',
                removedUserId: parseInt(userId),
                members
            }, requesterId);

            res.status(200).json({ message: 'Membro removido com sucesso!' });
        } catch (error) {
            console.error('Error removing member:', error);
            res.status(500).json({ error: 'Erro ao remover membro' });
        }
    },

    toggleMute: async (req, res) => {
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

    toggleImportant: async (req, res) => {
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

    getPosts: async (req, res) => {
        try {
            const { id } = req.params;
            const loggedUserId = req.user.id;

            const query = `
                SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked,
                EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as saved
                FROM posts p
                JOIN users u ON p.user_id = u.id
                WHERE p.group_id = ?
                ORDER BY p.created_at DESC
            `;
            const [posts] = await db.query(query, [loggedUserId, loggedUserId, id]);
            res.status(200).json(posts);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar posts do grupo' });
        }
    },

    createPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { content, attachment_url, attachment_type, attachment_name } = req.body;
            const userId = req.user.id;

            if (!content) return res.status(400).json({ error: 'O conteúdo do post não pode estar vazio.' });

            const [result] = await db.query(
                'INSERT INTO posts (user_id, content, group_id, attachment_url, attachment_type, attachment_name) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, content, id, attachment_url, attachment_type, attachment_name]
            );

            const postId = result.insertId;

            // Notify group members about new post (Activity Center)
            const [members] = await db.query(
                'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
                [id, userId]
            );

            if (members.length > 0) {
                const notificationController = require('./notificationController');
                const groupNameResult = await db.query('SELECT name FROM groups_table WHERE id = ?', [id]);
                const groupName = groupNameResult[0]?.name || 'Grupo';

                for (const member of members) {
                    await notificationController.createNotification(
                        member.user_id,
                        'group_post',
                        userId,
                        `publicou no grupo "${groupName}".`,
                        'post',
                        postId,
                        `group_${id}_post`,
                        { action: 'group_post', group_id: parseInt(id), group_name: groupName, post_id: postId }
                    );
                }
            }

            res.status(201).json({ id: postId, message: 'Post publicado no grupo!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar post no grupo' });
        }
    }
};

module.exports = groupController;
