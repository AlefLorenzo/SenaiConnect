const mockDb = { query: jest.fn() };

jest.mock('../db', () => mockDb);
jest.mock('../socketHelper', () => ({ sendToUser: jest.fn() }), { virtual: true });

const notificationController = require('../controllers/notificationController');
const messageController = require('../controllers/messageController');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('Unread notification and message counters', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the full unread notification count from the database', async () => {
    const req = { user: { id: 42 } };
    const res = createResponse();
    mockDb.query.mockResolvedValueOnce([[{ count: '127' }]]);

    await notificationController.getUnreadCount(req, res);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'unread'"),
      [42]
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 127 });
  });

  test('counts unread direct and group messages for the authenticated user', async () => {
    const req = { user: { id: 42 } };
    const res = createResponse();
    mockDb.query.mockResolvedValueOnce([[{ count: '8' }]]);

    await messageController.getUnreadCount(req, res);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM group_messages gm'),
      [42, 42, 42, 42]
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 8 });
  });

  test('returns zero when there are no unread messages', async () => {
    const req = { user: { id: 42 } };
    const res = createResponse();
    mockDb.query.mockResolvedValueOnce([[{ count: '0' }]]);

    await messageController.getUnreadCount(req, res);

    expect(res.json).toHaveBeenCalledWith({ count: 0 });
  });
});
