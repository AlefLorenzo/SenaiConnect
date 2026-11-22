const mockDb = { query: jest.fn() };

jest.mock('../db', () => mockDb);

const followController = require('../controllers/followController');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('Follow rules', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects self-follow when authenticated and route IDs use different types', async () => {
    const req = { user: { id: '42' }, params: { id: '42' } };
    const res = createResponse();

    await followController.followUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Você não pode seguir a si mesmo.',
    });
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  test.each(['0', '-1', 'abc', '1.5', '9007199254740992'])(
    'rejects invalid target user ID: %s',
    async (targetId) => {
      const req = { user: { id: 42 }, params: { id: targetId } };
      const res = createResponse();

      await followController.followUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Identificador de usuário inválido.',
      });
      expect(mockDb.query).not.toHaveBeenCalled();
    }
  );
});
