const { Server } = require('socket.io');
const db = require('./db');
const { getVerifiedIdentity } = require('./services/verifiedIdentity');

// Map of userId -> Set of socketId
const userSockets = new Map();
// Map of conversationId -> Set of userIds currently viewing
const conversationViewers = new Map();
const conversationMembershipCache = new Map();
const MEMBERSHIP_CACHE_TTL_MS = 5000;
const MAX_MEMBERSHIP_CACHE_ENTRIES = 10000;
let ioInstance = null;

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:5180',
  'http://localhost:5181',
  'http://localhost:5182',
  'http://localhost:5183',
  'http://localhost:5184',
  'http://localhost:5185',
  'http://localhost:5186',
  'http://localhost:5187',
  'http://localhost:5188',
  'http://localhost:5189',
  'http://localhost:5190',
  'http://localhost:5191',
  'http://localhost:5192',
  'http://localhost:5193',
  'http://localhost:5194',
  'http://localhost:5195',
  'http://localhost:5196',
  'http://localhost:5197',
  'http://localhost:5198',
  'http://localhost:5199',
  'http://localhost:5200',
  'http://localhost:5201',
  'http://localhost:5202',
  'http://localhost:5203',
  'http://localhost:5204',
  'http://localhost:5205',
  'http://localhost:5206',
  'http://localhost:5207',
  'http://localhost:5208',
  'http://localhost:5209',
];

const configuredOrigins = [
  ...(process.env.FRONTEND_URL || '').split(','),
  ...(process.env.FRONTEND_URLS || '').split(',')
].map((value) => value.trim()).filter(Boolean);
const allowedOriginSet = new Set([...allowedOrigins, ...configuredOrigins]);

function getCachedMembership(cacheKey) {
  const cached = conversationMembershipCache.get(cacheKey);
  if (!cached) return false;
  if (cached.expiresAt <= Date.now()) {
    conversationMembershipCache.delete(cacheKey);
    return false;
  }
  conversationMembershipCache.delete(cacheKey);
  conversationMembershipCache.set(cacheKey, cached);
  return cached.allowed;
}

function rememberMembership(cacheKey) {
  if (!conversationMembershipCache.has(cacheKey) && conversationMembershipCache.size >= MAX_MEMBERSHIP_CACHE_ENTRIES) {
    const oldestKey = conversationMembershipCache.keys().next().value;
    if (oldestKey) conversationMembershipCache.delete(oldestKey);
  }
  conversationMembershipCache.delete(cacheKey);
  conversationMembershipCache.set(cacheKey, {
    allowed: true,
    expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS
  });
}

async function isConversationMember(userId, conversationId) {
  const currentUserId = Number(userId);
  const key = String(conversationId || '').trim();
  if (!Number.isSafeInteger(currentUserId) || currentUserId <= 0 || !key) return false;

  const cacheKey = `${currentUserId}:${key}`;
  if (getCachedMembership(cacheKey)) return true;

  if (/^\\d+$/.test(key)) {
    const groupId = Number(key);
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return false;
    const [members] = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1',
      [groupId, currentUserId]
    );
    const allowed = members.length > 0;
    if (allowed) rememberMembership(cacheKey);
    return allowed;
  }

  const match = key.match(/^(\\d+)_(\\d+)$/);
  if (!match) return false;
  const firstId = Number(match[1]);
  const secondId = Number(match[2]);
  if (
    !Number.isSafeInteger(firstId) || !Number.isSafeInteger(secondId) ||
    firstId <= 0 || secondId <= 0 || firstId === secondId ||
    ![firstId, secondId].includes(currentUserId)
  ) return false;

  const peerId = firstId === currentUserId ? secondId : firstId;
  const [peers] = await db.query(
    'SELECT u.id FROM users u WHERE u.id = ? AND u.is_blocked = FALSE ' +
    'AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = u.id) ' +
    'AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = u.id AND b.blocked_id = ?)',
    [peerId, currentUserId, currentUserId]
  );
  const allowed = peers.length > 0;
  if (allowed) rememberMembership(cacheKey);
  return allowed;
}

function clearMembershipCache() {
  conversationMembershipCache.clear();
}

function init(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOriginSet.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    },
    // Disable WebSocket transport to avoid upgrade issues through proxy
    // Use only polling for stability
    transports: ['websocket', 'polling'],
    // Enable built-in ping/pong for polling stability
    pingInterval: 25000,
    pingTimeout: 60000
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || '').trim();
      if (!token) return next(new Error('unauthorized'));

      const identity = await getVerifiedIdentity(token);
      socket.userId = Number(identity.user.id);
      socket.authUserId = identity.authUser.id;
      socket.userName = identity.user.name;
      return next();
    } catch (error) {
      console.warn('Conexão Socket.IO recusada: autenticação inválida.');
      return next(new Error('unauthorized'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.userId;
    console.log('Socket autenticado:', socket.id, 'usuário:', userId);

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    db.query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?', [userId])
      .then(() => notifyContactsOnlineStatus(userId, true))
      .catch((error) => console.error('Falha ao atualizar presença online:', error));

    socket.on('disconnect', async (reason) => {
      console.log(`Socket desconectado: ${socket.id}, reason: ${reason}, transport: ${socket.conn?.transport?.name}, readyState: ${socket.conn?.transport?.transport?.socket?.readyState}`);
      if (socket.userId && userSockets.has(socket.userId)) {
        const sockets = userSockets.get(socket.userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(socket.userId);

          // Update user offline status in database
          await db.query('UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?', [socket.userId]);

          // Notify contacts that user is offline
          notifyContactsOnlineStatus(socket.userId, false);
        }
        console.log(`Usuário ${socket.userId} removido do socket ${socket.id}`);
      }

      // Remove from conversation viewers
      conversationViewers.forEach((viewers, convId) => {
        viewers.delete(socket.userId);
        if (viewers.size === 0) {
          conversationViewers.delete(convId);
        }
      });
    });

    // Heartbeat
    socket.on('heartbeat', (data) => {
      socket.emit('heartbeat_ack', { timestamp: Date.now(), serverTime: Date.now() });
    });

    // Event handlers trust only the identity established by the Socket.IO middleware.
    socket.on('typing_start', async (data = {}) => {
      const conversationId = String(data.conversationId || '');
      try {
        if (!await isConversationMember(userId, conversationId)) return;
        const viewers = conversationViewers.get(conversationId);
        if (!viewers) return;

        viewers.forEach((viewerId) => {
          if (viewerId !== userId) {
            sendToUser(viewerId, 'typing_start', {
              conversationId,
              userId,
              userName: socket.userName || 'Usuário'
            });
          }
        });
      } catch (error) {
        console.error('Falha ao validar digitação:', error);
      }
    });

    socket.on('typing_stop', async (data = {}) => {
      const conversationId = String(data.conversationId || '');
      try {
        if (!await isConversationMember(userId, conversationId)) return;
        const viewers = conversationViewers.get(conversationId);
        if (!viewers) return;

        viewers.forEach((viewerId) => {
          if (viewerId !== userId) {
            sendToUser(viewerId, 'typing_stop', { conversationId, userId });
          }
        });
      } catch (error) {
        console.error('Falha ao validar fim da digitação:', error);
      }
    });

    socket.on('join_conversation', async (conversationId) => {
      const key = String(conversationId || '');
      try {
        if (!await isConversationMember(userId, key)) return;
        if (!conversationViewers.has(key)) conversationViewers.set(key, new Set());
        conversationViewers.get(key).add(userId);
      } catch (error) {
        console.error('Falha ao validar entrada na conversa:', error);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      const key = String(conversationId || '');
      const viewers = conversationViewers.get(key);
      if (!viewers) return;
      viewers.delete(userId);
      if (viewers.size === 0) conversationViewers.delete(key);
    });

    socket.on('messages_read', async (data = {}) => {
      const conversationId = String(data.conversationId || '');
      try {
        if (!await isConversationMember(userId, conversationId)) return;
        await broadcastToConversation(conversationId, 'messages_read', {
          conversationId,
          byUserId: userId
        }, userId);
      } catch (error) {
        console.error('Falha ao validar confirmação de leitura:', error);
      }
    });

    // Group lifecycle events are emitted by trusted API controllers only.
    // A browser cannot forge membership, administrator, update or deletion events.
  });

  return ioInstance;
}

async function notifyContactsOnlineStatus(userId, isOnline) {
  try {
    // Get all contacts (individual conversations)
    const [contacts] = await db.query(`
      SELECT DISTINCT u.id
      FROM users u
      WHERE u.id != ?
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE (m.sender_id = u.id AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = u.id)
      )
    `, [userId, userId, userId]);

    // Also get group members
    const [groupMembers] = await db.query(`
      SELECT DISTINCT gm.user_id
      FROM group_members gm
      WHERE gm.user_id != ?
        AND gm.group_id IN (
          SELECT own_members.group_id
          FROM group_members own_members
          WHERE own_members.user_id = ?
        )
    `, [userId, userId]);

    const allContactIds = new Set([
      ...contacts.map(c => c.id),
      ...groupMembers.map(m => m.user_id)
    ]);

    // Notify each contact
    for (const contactId of allContactIds) {
      sendToUser(contactId, 'user_online', {
        userId,
        isOnline,
      });
    }
  } catch (error) {
    console.error('Error notifying contacts:', error);
  }
}

function sendToUser(userId, event, data) {
  const uId = parseInt(userId);
  if (userSockets.has(uId)) {
    const sockets = userSockets.get(uId);
    sockets.forEach(socketId => {
      if (ioInstance) {
        ioInstance.to(socketId).emit(event, data);
      }
    });
    return true;
  }
  return false;
}

function sendToGroup(groupId, event, data, excludeUserId = null) {
  // Group events must be delivered only to authenticated members of that group.
  return broadcastToGroup(groupId, event, data, excludeUserId);
}

function broadcast(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

// Broadcast to all participants in a conversation (individual or group)
async function broadcastToConversation(conversationId, event, data, excludeUserId = null) {
  try {
    const conversationKey = String(conversationId || '');
    const directMatch = conversationKey.match(/^(\d+)_(\d+)$/);
    if (directMatch) {
      const firstId = Number(directMatch[1]);
      const secondId = Number(directMatch[2]);
      const excludedId = Number(excludeUserId || 0);
      const peerId = firstId === excludedId ? secondId : secondId === excludedId ? firstId : 0;
      if (peerId > 0) sendToUser(peerId, event, data);
      return;
    }

    // Check if it's a group
    const [groups] = await db.query('SELECT * FROM groups_table WHERE id = ?', [conversationId]);

    if (groups.length > 0) {
      // Group - send to all members except excluded
      const [members] = await db.query(
        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
        [conversationId, excludeUserId || 0]
      );

      for (const member of members) {
        sendToUser(member.user_id, event, data);
      }
    } else {
      // Individual - send to the other participant
      // conversationId is the other user's ID
      if (conversationId !== excludeUserId) {
        sendToUser(conversationId, event, data);
      }
    }
  } catch (error) {
    console.error('Error broadcasting to conversation:', error);
  }
}

// Broadcast to all members of a group
async function broadcastToGroup(groupId, event, data, excludeUserId = null) {
  try {
    const [members] = await db.query(
      'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
      [groupId, excludeUserId || 0]
    );

    for (const member of members) {
      sendToUser(member.user_id, event, data);
    }
  } catch (error) {
    console.error('Error broadcasting to group:', error);
  }
}

// Send new message to group members
async function sendGroupMessage(groupId, message, excludeUserId = null) {
  try {
    const [members] = await db.query(
      'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
      [groupId, excludeUserId || 0]
    );

    for (const member of members) {
      sendToUser(member.user_id, 'new_message', message);
    }
  } catch (error) {
    console.error('Error sending group message:', error);
  }
}

// Send new message to individual conversation
async function sendIndividualMessage(conversationId, message, excludeUserId = null) {
  // conversationId is the other user's ID
  if (conversationId !== excludeUserId) {
    sendToUser(conversationId, 'new_message', message);
  }
}

// Emit message status update (delivered, read)
async function emitMessageStatus(conversationId, messageId, status, excludeUserId = null) {
  const data = {
    messageId,
    status,
    conversationId,
    timestamp: Date.now()
  };
  await broadcastToConversation(conversationId, 'message_status', data, excludeUserId);
}

function getIO() {
  return ioInstance;
}

module.exports = {
  init,
  getIO,
  sendToUser,
  sendToGroup,
  sendGroupMessage,
  sendIndividualMessage,
  broadcast,
  broadcastToConversation,
  broadcastToGroup,
  notifyContactsOnlineStatus,
  emitMessageStatus,
  isConversationMember,
  clearMembershipCache
};