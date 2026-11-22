const mockConnection = {
  execute: jest.fn(),
  beginTransaction: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  release: jest.fn(),
};

const mockDb = {
  query: jest.fn(),
  getConnection: jest.fn(),
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
    mockDb.getConnection.mockReset().mockResolvedValue(mockConnection);
    mockConnection.execute.mockReset();
    mockConnection.beginTransaction.mockClear();
    mockConnection.commit.mockClear();
    mockConnection.rollback.mockClear();
    mockConnection.release.mockClear();
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


describe('storyController.reply', () => {
  let req;
  let res;

  const activeStory = (overrides = {}) => ({
    id: 10,
    user_id: 99,
    media_url: '/uploads/stories/story.jpg',
    media_type: 'image',
    text_content: 'Um dia especial',
    background_color: null,
    created_at: new Date(Date.now() - 60_000).toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    owner_name: 'Story Owner',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockReset();
    mockDb.getConnection.mockReset().mockResolvedValue(mockConnection);
    mockConnection.execute.mockReset();
    mockConnection.beginTransaction.mockClear();
    mockConnection.commit.mockClear();
    mockConnection.rollback.mockClear();
    mockConnection.release.mockClear();

    req = {
      params: { id: '10' },
      body: { content: 'Que lugar lindo!' },
      user: { id: 7, name: 'Viewer' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('saves a story reply as a normal private DM linked to the original story', async () => {
    const createdAt = new Date().toISOString();
    mockConnection.execute
      .mockResolvedValueOnce([[activeStory()]]) // Story and owner
      .mockResolvedValueOnce([[{ id: 10 }]]) // Story visibility
      .mockResolvedValueOnce([{ insertId: 101, rows: [{ id: 101 }] }]) // story_replies
      .mockResolvedValueOnce([{ insertId: 202, rows: [{ id: 202 }] }]) // direct messages
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // Link reply to message
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // Update reply counter
      .mockResolvedValueOnce([[{ id: 7, name: 'Viewer', avatar: 'viewer.jpg' }]]) // Sender
      .mockResolvedValueOnce([[{ id: 202, created_at: createdAt, status: 'enviada' }]]); // Message time/status

    await storyController.reply(req, res);

    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).not.toHaveBeenCalled();

    const messageInsert = mockConnection.execute.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO messages')
    );
    expect(messageInsert[0]).toContain('(sender_id, receiver_id, content, status, message_type, client_message_id)');
    expect(messageInsert[0]).toContain("'story_reply'");
    expect(messageInsert[1]).toEqual([7, 99, 'Que lugar lindo!', 'story_reply_101']);

    expect(mockConnection.execute).toHaveBeenCalledWith(
      'UPDATE story_replies SET message_id = ? WHERE id = ?',
      [202, 101]
    );
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'UPDATE stories SET reply_count = COALESCE(reply_count, 0) + 1 WHERE id = ?',
      ['10']
    );

    expect(notificationController.createNotification).toHaveBeenCalledWith(
      99,
      'story_reply',
      7,
      'respondeu à sua história.',
      'story',
      10,
      'story_10_reply_101',
      { action: 'reply', story_id: 10, reply_id: 101, message_id: 202 }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 101,
      messageId: 202,
      conversationId: '7_99',
      message: expect.objectContaining({
        senderId: 7,
        receiverId: 99,
        message_type: 'story_reply',
        storyReply: expect.objectContaining({
          storyId: 10,
          ownerId: 99,
          ownerName: 'Story Owner',
          mediaUrl: '/uploads/stories/story.jpg',
          textContent: 'Um dia especial',
        }),
      }),
    }));

    const newMessageCall = require('../socketHelper').sendToUser.mock.calls.find(call => call[1] === 'new_message');
    expect(newMessageCall[0]).toBe(99);
    expect(newMessageCall[2].conversationId).toBe('7_99');
    expect(newMessageCall[2].storyReply.storyId).toBe(10);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  test('does not let a user reply to their own story', async () => {
    mockConnection.execute.mockResolvedValueOnce([[activeStory({ user_id: 7 })]]);

    await storyController.reply(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
  });

  test('rejects replies to expired stories', async () => {
    mockConnection.execute.mockResolvedValueOnce([[
      activeStory({ expires_at: new Date(Date.now() - 1000).toISOString() })
    ]]);

    await storyController.reply(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
  });

  test('does not create a DM when the viewer cannot access the story privacy settings', async () => {
    mockConnection.execute
      .mockResolvedValueOnce([[activeStory()]])
      .mockResolvedValueOnce([[]]);

    await storyController.reply(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
  });

  test('enforces the story reply text limit', async () => {
    req.body.content = 'x'.repeat(501);

    await storyController.reply(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDb.getConnection).not.toHaveBeenCalled();
  });
});
