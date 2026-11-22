const mockQuery = jest.fn();
const mockSendToUser = jest.fn();

jest.mock('../db', () => ({ query: mockQuery }));
jest.mock('../socketHelper', () => ({
  sendToUser: mockSendToUser,
  broadcastToGroup: jest.fn(),
  emitMessageStatus: jest.fn(),
}));

const messageController = require('../controllers/messageController');

describe('individual conversation IDs', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1, name: 'Usuário atual' },
      params: { id: '1_2' },
      body: {},
      query: { page: '1', limit: '50' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('resolves the other participant when loading a canonical conversation ID', async () => {
    mockQuery.mockResolvedValueOnce([[
      {
        id: 2,
        name: 'Maria Silva',
        avatar: null,
        role: 'aluno',
        is_online: 1,
        last_seen: null,
        last_seen_privacy: 'all',
      },
    ]]);

    await messageController.getConversation(req, res);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM users WHERE id = ?'),
      [2],
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: '1_2',
      conversationId: '1_2',
      isGroup: false,
      participants: expect.arrayContaining([
        expect.objectContaining({ id: 1, name: 'Você' }),
        expect.objectContaining({ id: 2, name: 'Maria Silva' }),
      ]),
    }));
  });

  test('loads history and marks incoming messages as read for a canonical ID', async () => {
    mockQuery.mockImplementation(async (sql, params) => {
      if (sql.includes('FROM users WHERE id = ?')) {
        expect(params).toEqual([2]);
        return [[{
          id: 2,
          name: 'Maria Silva',
          avatar: null,
          role: 'aluno',
          is_online: 1,
          last_seen: null,
          last_seen_privacy: 'all',
        }]];
      }
      if (sql.includes('FROM messages m') && sql.includes('ORDER BY m.created_at DESC, m.id DESC')) {
        expect(params).toEqual([1, 2, 2, 1, 50, 0]);
        return [[{
          id: 10,
          sender_id: 2,
          receiver_id: 1,
          content: 'Olá',
          status: 'enviada',
          message_type: 'text',
          created_at: new Date('2026-11-21T10:00:00.000Z'),
        }]];
      }
      if (sql.includes('COUNT(*) as total FROM messages')) {
        expect(params).toEqual([1, 2, 2, 1]);
        return [[{ total: 1 }]];
      }
      if (sql.includes("UPDATE messages SET status = 'lida'")) {
        expect(params).toEqual([2, 1]);
        return [{ affectedRows: 1 }];
      }
      throw new Error('Consulta SQL inesperada no teste: ' + sql);
    });

    await messageController.getHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ id: 10, content: 'Olá' })],
      isGroup: false,
      contact: expect.objectContaining({ id: 2, name: 'Maria Silva' }),
      pagination: expect.objectContaining({ total: 1, hasMore: false }),
    }));
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  test('marks incoming messages as read and notifies the other participant', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 3 }]);

    await messageController.markAsRead(req, res);

    expect(mockQuery).toHaveBeenCalledWith(
      "UPDATE messages SET status = 'lida' WHERE sender_id = ? AND receiver_id = ? AND status = 'enviada'",
      [2, 1],
    );
    expect(mockSendToUser).toHaveBeenCalledWith(2, 'messages_read', {
      conversationId: '1_2',
      byUserId: 1,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('rejects a canonical ID that does not contain the authenticated user', async () => {
    req.params.id = '2_3';

    await messageController.getConversation(req, res);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
