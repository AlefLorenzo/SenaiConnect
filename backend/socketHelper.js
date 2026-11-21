const { Server } = require('socket.io');
const db = require('./db');

// Map of userId -> Set of socketId
const userSockets = new Map();
// Map of conversationId -> Set of userIds currently viewing
const conversationViewers = new Map();
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

function init(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    },
    // Disable WebSocket transport to avoid upgrade issues through proxy
    // Use only polling for stability
    transports: ['polling'],
    // Enable built-in ping/pong for polling stability
    pingInterval: 25000,
    pingTimeout: 60000
  });

  ioInstance.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);
    console.log(`  Transport: ${socket.conn.transport.name}`);
    console.log(`  Remote address: ${socket.handshake.address}`);
    console.log(`  Origin: ${socket.handshake.headers.origin}`);
    console.log(`  Query: ${JSON.stringify(socket.handshake.query)}`);

    socket.on('register', async (userId) => {
      if (!userId) return;
      const uId = parseInt(userId);
      socket.userId = uId;

      if (!userSockets.has(uId)) {
        userSockets.set(uId, new Set());
      }
      userSockets.get(uId).add(socket.id);
      console.log(`Usuário ${uId} registrado no socket ${socket.id}`);

      // Update user online status in database
      await db.query('UPDATE users SET is_online = 1, last_seen = NOW() WHERE id = ?', [uId]);

      // Notify contacts that user is online
      notifyContactsOnlineStatus(uId, true);
    });

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

    // Typing indicators
    socket.on('typing_start', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        // Broadcast to all in conversation except sender
        const viewers = conversationViewers.get(conversationId);
        if (viewers) {
          viewers.forEach(userId => {
            if (userId !== socket.userId) {
              sendToUser(userId, 'typing_start', {
                conversationId,
                userId: socket.userId,
                userName: data.userName || 'Someone',
              });
            }
          });
        }
      }
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        // Broadcast to all in conversation except sender
        const viewers = conversationViewers.get(conversationId);
        if (viewers) {
          viewers.forEach(userId => {
            if (userId !== socket.userId) {
              sendToUser(userId, 'typing_stop', {
                conversationId,
                userId: socket.userId,
              });
            }
          });
        }
      }
    });

    // Conversation view tracking (for typing indicators)
    socket.on('join_conversation', (conversationId) => {
      if (!conversationViewers.has(conversationId)) {
        conversationViewers.set(conversationId, new Set());
      }
      conversationViewers.get(conversationId).add(socket.userId);
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationViewers.has(conversationId)) {
        conversationViewers.get(conversationId).delete(socket.userId);
        if (conversationViewers.get(conversationId).size === 0) {
          conversationViewers.delete(conversationId);
        }
      }
    });

    // Messages read
    socket.on('messages_read', (data) => {
      const { conversationId, byUserId } = data;
      // Broadcast to conversation participants that messages were read
      broadcastToConversation(conversationId, 'messages_read', {
        conversationId,
        byUserId,
      }, byUserId);
    });

    // Group events
    socket.on('group_member_joined', async (data) => {
      const { groupId, userId, userName } = data;
      // Broadcast to group members
      broadcastToGroup(groupId, 'group_member_joined', {
        groupId,
        userId,
        userName,
        timestamp: Date.now()
      }, socket.userId);
    });

    socket.on('group_member_left', async (data) => {
      const { groupId, userId, userName } = data;
      broadcastToGroup(groupId, 'group_member_left', {
        groupId,
        userId,
        userName,
        timestamp: Date.now()
      }, socket.userId);
    });

    socket.on('group_admin_changed', async (data) => {
      const { groupId, userId, isAdmin } = data;
      broadcastToGroup(groupId, 'group_admin_changed', {
        groupId,
        userId,
        isAdmin,
        timestamp: Date.now()
      });
    });

    socket.on('group_updated', async (data) => {
      const { groupId, name, description, avatar } = data;
      broadcastToGroup(groupId, 'group_updated', {
        groupId,
        name,
        description,
        avatar,
        timestamp: Date.now()
      });
    });

    socket.on('group_deleted', async (data) => {
      const { groupId } = data;
      broadcastToGroup(groupId, 'group_deleted', {
        groupId,
        timestamp: Date.now()
      });
    });
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
      JOIN groups_table g ON g.id = gm.group_id
      WHERE gm.user_id != ?
    `, [userId]);

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
  // This would need group members - for now just broadcast
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

function broadcast(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

// Broadcast to all participants in a conversation (individual or group)
async function broadcastToConversation(conversationId, event, data, excludeUserId = null) {
  try {
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
  emitMessageStatus
};