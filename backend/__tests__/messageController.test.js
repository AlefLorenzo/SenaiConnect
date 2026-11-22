// Mock database
const mockDb = {
  query: jest.fn(),
  execute: jest.fn(),
};

jest.mock('../db', () => mockDb);

// Mock socketHelper
jest.mock('../socketHelper', () => ({
  sendToUser: jest.fn(),
  broadcastToConversation: jest.fn(),
  emitMessageStatus: jest.fn(),
  sendToGroup: jest.fn(),
  broadcastToGroup: jest.fn(),
}), { virtual: true });

const { sendToUser, broadcastToConversation, emitMessageStatus, sendToGroup, broadcastToGroup } = require('../socketHelper');

// Mock notificationController
jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

// Mock fs for uploadMedia
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}), { virtual: true });

const messageController = require('../controllers/messageController');
const notificationController = require('../controllers/notificationController');

describe('messageController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockReset();

    mockReq = {
      user: { id: 1, name: 'Test User' },
      params: {},
      body: {},
      query: {},
      file: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('sendMessage', () => {
    test('sends individual message successfully', async () => {
      mockReq.params.id = '1_2';
      mockReq.body = {
        content: 'Teste de mensagem',
        type: 'text',
      };

      // Setup mock implementation to handle queries in order
      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group (groups_table)
        if (sql.includes('groups_table')) {
          return Promise.resolve([[]]);
        }
        // Query 2: Check receiver exists
        if (sql.includes('users WHERE id')) {
          return Promise.resolve([[{ id: 2, name: 'Receiver' }]]);
        }
        // Query 3: Insert message
        if (sql.includes('INSERT INTO messages')) {
          return Promise.resolve([{ insertId: 1 }]);
        }
        // Query 4: Get new message
        if (sql.includes('SELECT * FROM messages WHERE id')) {
          return Promise.resolve([ [{
            id: 1,
            content: 'Teste de mensagem',
            sender_id: 1,
            receiver_id: 2,
            status: 'enviada',
            message_type: 'text',
            media_url: null,
            attachment_name: null,
            attachment_size: null,
            attachment_type: null,
            created_at: new Date()
          } ]]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Teste de mensagem',
          senderId: 1,
          status: 'enviada',
          conversationId: '1_2',
        })
      );
    });

    test('re-emits an existing direct message on an idempotent retry without duplicating notifications', async () => {
      mockReq.params.id = '1_2';
      mockReq.body = {
        content: 'Mensagem que já foi gravada',
        type: 'text',
        clientMessageId: 'stable-message-123',
      };

      mockDb.query.mockImplementation((sql) => {
        if (sql.includes('SELECT id, name FROM users WHERE id = ?')) {
          return Promise.resolve([[{ id: 2, name: 'Receiver' }]]);
        }
        if (sql.includes('INSERT INTO messages')) {
          return Promise.resolve([{ insertId: undefined, affectedRows: 0 }]);
        }
        if (sql.includes('SELECT * FROM messages WHERE client_message_id')) {
          return Promise.resolve([[
            {
              id: 77,
              client_message_id: 'stable-message-123',
              content: 'Mensagem que já foi gravada',
              sender_id: 1,
              receiver_id: 2,
              status: 'enviada',
              message_type: 'text',
              created_at: new Date(),
            },
          ]]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 77,
        conversationId: '1_2',
      }));
      expect(sendToUser).toHaveBeenCalledWith(2, 'new_message', expect.objectContaining({
        id: 77,
        clientMessageId: 'stable-message-123',
        conversationId: '1_2',
      }));
      expect(notificationController.createNotification).not.toHaveBeenCalled();
    });

    test('rejects a receiver that does not belong to the canonical direct conversation', async () => {
      mockReq.params.id = '1_2';
      mockReq.body = {
        content: 'Mensagem',
        type: 'text',
        receiverId: '99',
      };

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(sendToUser).not.toHaveBeenCalled();
    });

    test('returns 400 for missing conversationId', async () => {
      mockReq.params.id = '';
      mockReq.body = { content: 'Teste' };

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Conversa e conteúdo'),
        })
      );
    });

    test('returns 400 for missing content', async () => {
      mockReq.params.id = '1_2';
      mockReq.body = { type: 'text' };

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('parses receiverId from conversationId for individual chats', async () => {
      mockReq.params.id = '2_5'; // Sorted: 2_5 means users 2 and 5
      mockReq.body = { content: 'Teste', type: 'text' };
      mockReq.user.id = 2; // Current user is 2

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group (groups_table) - '2_5' is not integer
        if (sql.includes('groups_table')) {
          return Promise.resolve([[]]);
        }
        // Query 2: Check receiver exists (user 5)
        if (sql.includes('users WHERE id')) {
          return Promise.resolve([[{ id: 5, name: 'User 5' }]]);
        }
        // Query 3: Insert message
        if (sql.includes('INSERT INTO messages')) {
          return Promise.resolve([{ insertId: 1 }]);
        }
        // Query 4: Get new message
        if (sql.includes('SELECT * FROM messages WHERE id')) {
          return Promise.resolve([ [{
            id: 1,
            content: 'Teste',
            sender_id: 2,
            receiver_id: 5,
            status: 'enviada',
            message_type: 'text',
            media_url: null,
            attachment_name: null,
            attachment_size: null,
            attachment_type: null,
            created_at: new Date()
          } ]]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      // Should send to user 5 (the other participant)
      expect(sendToUser).toHaveBeenCalledWith(5, 'new_message', expect.any(Object));
    });

    test('sends group message to all members', async () => {
      mockReq.params.id = '1'; // Group ID
      mockReq.body = { content: 'Mensagem do grupo', type: 'text' };
      mockReq.user.id = 1;

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group
        if (sql.includes('groups_table') && sql.includes('id = ?')) {
          return Promise.resolve([[{ id: 1, name: 'Test Group' }]]);
        }
        // Query 2: Check membership
        if (sql.includes('group_members') && sql.includes('user_id = ?')) {
          return Promise.resolve([[{ user_id: 1 }]]);
        }
        // Query 3: Insert group message
        if (sql.includes('INSERT INTO group_messages')) {
          return Promise.resolve([{ insertId: 1 }]);
        }
        // Query 4: Read inserted message by its ID (idempotent insert flow).
        if (sql.includes('SELECT * FROM group_messages WHERE id = ?')) {
          return Promise.resolve([[{
            id: 1,
            group_id: 1,
            sender_id: 1,
            content: 'Mensagem do grupo',
            status: 'enviada',
            message_type: 'text',
            media_url: null,
            attachment_name: null,
            attachment_size: null,
            attachment_type: null,
            created_at: new Date(),
          }]]);
        }
        // Query 5: Load sender details after reading the inserted message.
        if (sql.includes('SELECT name, avatar FROM users WHERE id = ?')) {
          return Promise.resolve([[{ name: 'Test User', avatar: null }]]);
        }
        // Query 6: Get group members (excluding sender)
        if (sql.includes('group_members') && sql.includes('user_id != ?')) {
          return Promise.resolve([[{ user_id: 2 }, { user_id: 3 }, { user_id: 4 }]]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.sendMessage(mockReq, mockRes, mockNext);

      // Should send to all members except sender (2, 3, 4)
      expect(sendToUser).toHaveBeenCalledTimes(3);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getConversations', () => {
    test('returns user conversations', async () => {
      const mockIndividuals = [
        { id: 2, name: 'User 2', avatar: null, role: 'aluno', is_online: 1, last_seen: null, last_seen_privacy: 'all', last_message: 'Olá', last_message_id: 81, last_message_sender_id: 1, last_message_type: 'image', last_message_status: 'enviada', last_interaction: '2024-01-15T10:30:00Z', unread_count: 0 },
        { id: 3, name: 'User 3', avatar: null, role: 'aluno', is_online: 0, last_seen: null, last_seen_privacy: 'all', last_message: 'Oi', last_interaction: '2024-01-15T11:00:00Z', unread_count: 1 },
      ];

      const mockGroups = [
        { conversation_id: 1, name: 'Group 1', description: 'Desc', avatar: null, role: 'admin', created_at: '2024-01-01', last_message: 'Group msg', last_message_sender_id: 1, last_message_sender_name: 'Test User', last_interaction: '2024-01-15T12:00:00Z', unread_count: 2, is_muted: 0, is_important: 1 },
        { conversation_id: 2, name: 'Group 2', description: 'Desc', avatar: null, role: 'member', created_at: '2024-01-02', last_message: 'Reply from Maria', last_message_sender_id: 2, last_message_sender_name: 'Participant', last_interaction: '2024-01-15T13:00:00Z', unread_count: 0, is_muted: 0, is_important: 0 },
      ];

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Individual conversations
        if (sql.includes('SELECT') && sql.includes('users u') && sql.includes('u.id !=')) {
          return Promise.resolve([mockIndividuals]);
        }
        // Query 2: Group conversations
        if (sql.includes('groups_table g') && sql.includes('JOIN group_members')) {
          return Promise.resolve([mockGroups]);
        }
        // Query 3: Participants for group
        if (sql.includes('group_members gm2') && sql.includes('JOIN users u2')) {
          return Promise.resolve([[
            { group_id: 1, id: 1, name: 'Test User', avatar: null, role: 'admin', is_online: 1, last_seen: null },
            { group_id: 2, id: 2, name: 'Maria Silva', avatar: null, role: 'member', is_online: 1, last_seen: null },
          ]]);
        }
        // Query 4: Admins for group
        if (sql.includes('group_admins') && sql.includes('group_id = ?')) {
          return Promise.resolve([[{ admin_id: 1 }]]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.getConversations(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              conversation_id: '1_2',
              last_message: expect.objectContaining({
                id: 81,
                senderId: 1,
                senderName: 'Você',
                type: 'image',
                status: 'enviada',
              }),
            }),
            expect.objectContaining({ conversation_id: '1_3' }),
            expect.objectContaining({
              conversation_id: 1,
              name: 'Group 1',
              last_message: expect.objectContaining({
                content: 'Group msg',
                senderName: 'You',
              }),
            }),
            expect.objectContaining({
              conversation_id: 2,
              name: 'Group 2',
              last_message: expect.objectContaining({
                content: 'Reply from Maria',
                senderName: 'Maria Silva',
              }),
            }),
          ]),
        })
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(1, expect.any(String), Array(16).fill(1));
      expect(mockDb.query).toHaveBeenNthCalledWith(2, expect.stringContaining('last_message_sender_name'), Array(6).fill(1));
    });
  });

  describe('getHistory', () => {
    test('returns messages with pagination for individual chat', async () => {
      mockReq.params.id = '2'; // Other user ID
      mockReq.query = { page: '1', limit: '50' };

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group
        if (sql.includes('groups_table') && sql.includes('id = ?')) {
          return Promise.resolve([[]]);
        }
        // Query 2: Get other user info
        if (sql.includes('users WHERE id = ?') && !sql.includes('sender_id')) {
          return Promise.resolve([[{ id: 2, name: 'User 2', avatar: null, role: 'aluno', is_online: 1, last_seen: null, last_seen_privacy: 'all' }]]);
        }
        // Query 3: Get messages
        if (sql.includes('SELECT * FROM messages') && sql.includes('ORDER BY created_at DESC')) {
          const mockMessages = [
            { id: 1, content: 'Msg 1', sender_id: 1, receiver_id: 2, status: 'lida', message_type: 'text', media_url: null, attachment_name: null, attachment_size: null, attachment_type: null, created_at: '2024-01-15T10:30:00Z' },
            { id: 2, content: 'Msg 2', sender_id: 2, receiver_id: 1, status: 'enviada', message_type: 'text', media_url: null, attachment_name: null, attachment_size: null, attachment_type: null, created_at: '2024-01-15T11:00:00Z' },
          ];
          return Promise.resolve([mockMessages]);
        }
        // Query 4: Get total count
        if (sql.includes('COUNT(*) as total FROM messages')) {
          return Promise.resolve([[{ total: 2 }]]);
        }
        // Query 5: Mark as read
        if (sql.includes("UPDATE messages SET status = 'lida'")) {
          return Promise.resolve([{ affectedRows: 1 }]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.getHistory(mockReq, mockRes, mockNext);

      expect(mockDb.query.mock.calls.some(([sql]) => sql.includes('ORDER BY created_at DESC, id DESC'))).toBe(true);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ content: 'Msg 1' }),
            expect.objectContaining({ content: 'Msg 2' }),
          ]),
          contact: expect.objectContaining({ name: 'User 2' }),
          isGroup: false,
          pagination: expect.objectContaining({
            page: 1,
            limit: 50,
            total: 2,
          }),
        })
      );
    });

    test('returns messages with pagination for group chat', async () => {
      mockReq.params.id = '1'; // Group ID
      mockReq.query = { page: '1', limit: '50' };

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group
        if (sql.includes('groups_table') && sql.includes('id = ?')) {
          return Promise.resolve([[{ id: 1, name: 'Group 1', avatar: null, description: 'Desc' }]]);
        }
        // Query 2: Get group messages
        if (sql.includes('group_messages gm') && sql.includes('JOIN users')) {
          const mockGroupMessages = [
            { id: 1, group_id: 1, sender_id: 2, content: 'Group msg 1', message_type: 'text', media_url: null, attachment_name: null, attachment_size: null, attachment_type: null, created_at: '2024-01-15T10:30:00Z', sender_name: 'User 2', sender_avatar: null },
            { id: 2, group_id: 1, sender_id: 3, content: 'Group msg 2', message_type: 'text', media_url: null, attachment_name: null, attachment_size: null, attachment_type: null, created_at: '2024-01-15T11:00:00Z', sender_name: 'User 3', sender_avatar: null },
            { id: 3, group_id: 1, sender_id: 1, content: 'My group message', message_type: 'text', media_url: null, attachment_name: null, attachment_size: null, attachment_type: null, created_at: '2024-01-15T11:01:00Z', sender_name: 'Test User', sender_avatar: null },
          ];
          return Promise.resolve([mockGroupMessages]);
        }
        // Query 3: Get total count
        if (sql.includes('COUNT(*) as total FROM group_messages')) {
          return Promise.resolve([[{ total: 3 }]]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.getHistory(mockReq, mockRes, mockNext);

      expect(mockDb.query.mock.calls.some(([sql]) => sql.includes('ORDER BY gm.created_at DESC, gm.id DESC'))).toBe(true);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ content: 'Group msg 1' }),
            expect.objectContaining({ content: 'Group msg 2' }),
            expect.objectContaining({ content: 'My group message', senderName: 'You' }),
          ]),
          contact: expect.objectContaining({ name: 'Group 1' }),
          isGroup: true,
          pagination: expect.objectContaining({
            page: 1,
            limit: 50,
            total: 3,
          }),
        })
      );
    });
  });

  describe('markAsRead', () => {
    test('marks messages as read for individual chat', async () => {
      mockReq.params.id = '2'; // Other user ID (receiver_id)
      mockReq.user.id = 1; // logged user

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group
        if (sql.includes('groups_table') && sql.includes('id = ?')) {
          return Promise.resolve([[]]);
        }
        // Query 2: Update messages
        if (sql.includes("UPDATE messages SET status = 'lida'")) {
          return Promise.resolve([{ affectedRows: 5 }]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.markAsRead(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      // The query receives params as strings from req.params
      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE messages SET status = 'lida' WHERE sender_id = ? AND receiver_id = ? AND status = 'enviada'",
        ["2", 1]
      );
    });

    test('marks messages as read for group chat', async () => {
      mockReq.params.id = '1'; // Group ID
      mockReq.user.id = 1;

      let callCount = 0;
      mockDb.query.mockImplementation((sql, params) => {
        callCount++;
        // Query 1: Check if group exists
        if (sql.includes('groups_table') && sql.includes('id = ?')) {
          return Promise.resolve([[{ id: 1 }]]);
        }
        // Query 2: Get last message
        if (sql.includes('group_messages') && sql.includes('ORDER BY created_at DESC')) {
          return Promise.resolve([[{ id: 10 }]]);
        }
        // Query 3: Update last read
        if (sql.includes('group_last_read') && sql.includes('INSERT')) {
          return Promise.resolve([{ affectedRows: 1 }]);
        }
        return Promise.resolve([[]]);
      });

      await messageController.markAsRead(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('uploadMedia', () => {
    test('uploads file successfully', async () => {
      mockReq.file = {
        filename: 'test-image.png',
        originalname: 'image.png',
        mimetype: 'image/png',
        size: 102400,
        buffer: Buffer.from('test'),
        path: '/uploads/test-image.png',
      };

      await messageController.uploadMedia(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/uploads/messages/'),
          fileName: 'image.png',
          fileSize: 102400,
        })
      );
    });

    test('returns 400 if no file', async () => {
      mockReq.file = null;

      await messageController.uploadMedia(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});