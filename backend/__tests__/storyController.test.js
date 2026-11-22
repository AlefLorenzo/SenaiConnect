const mockDb = {
  query: jest.fn(),
};

jest.mock('../db', () => mockDb);

jest.mock('../socketHelper', () => ({
  sendToUser: jest.fn(),
  broadcast: jest.fn(),
}), { virtual: true });

jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

const storyController = require('../controllers/storyController');
const notificationController = require('../controllers/notificationController');

describe('storyController.view', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockReset();
    req = {
      params: { id: '10' },
      user: { id: 7, name: 'Viewer' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('creates one view atomically and notifies the owner only for a new view', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ rows: [{ story_id: 10 }], affectedRows: 1 }])
      .mockResolvedValueOnce([[{ user_id: 99 }]]);

    await storyController.view(req, res);

    expect(mockDb.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ON CONFLICT (story_id, user_id) DO NOTHING RETURNING story_id'),
      ['10', 7]
    );
    expect(mockDb.query).toHaveBeenNthCalledWith(
      2,
      'SELECT user_id FROM stories WHERE id = ?',
      ['10']
    );
    expect(notificationController.createNotification).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('does not perform extra reads or notifications for a duplicate view', async () => {
    mockDb.query.mockResolvedValueOnce([{ rows: [], affectedRows: 0 }]);

    await storyController.view(req, res);

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    expect(notificationController.createNotification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('does not notify the owner when viewing the owner\'s own story', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ rows: [{ story_id: 10 }], affectedRows: 1 }])
      .mockResolvedValueOnce([[{ user_id: 7 }]]);

    await storyController.view(req, res);

    expect(notificationController.createNotification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
  test('returns success even if the non-critical notification cannot be created', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ rows: [{ story_id: 10 }], affectedRows: 1 }])
      .mockResolvedValueOnce([[{ user_id: 99 }]]);
    notificationController.createNotification.mockRejectedValueOnce(new Error('notification store unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await storyController.view(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

});
