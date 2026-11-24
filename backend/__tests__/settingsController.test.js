const mockDb = { query: jest.fn() };

jest.mock('../db', () => mockDb);
jest.mock('../socketHelper', () => ({ broadcast: jest.fn() }));

const settingsController = require('../controllers/settingsController');
const socketHelper = require('../socketHelper');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('User settings persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  test('preserves previously saved notification and accessibility preferences when updating one option', async () => {
    const req = {
      user: { id: 7 },
      body: { notifications: { likes: false } },
    };
    const res = createResponse();
    mockDb.query
      .mockResolvedValueOnce([[{
        settings: JSON.stringify({ theme: 'dark', language: 'pt-BR' }),
        privacy_showProfile: 'public',
        privacy_showEmail: 0,
        notification_prefs: JSON.stringify({ messages: false, follows: true }),
        accessibility_prefs: JSON.stringify({ highContrast: true, fontSize: 'large' }),
      }]])
      .mockResolvedValueOnce([{}]);

    await settingsController.updateSettings(req, res);

    const updateCall = mockDb.query.mock.calls[1];
    const persistedSettings = JSON.parse(updateCall[1][0]);
    const persistedNotifications = JSON.parse(updateCall[1][1]);
    const persistedAccessibility = JSON.parse(updateCall[1][2]);

    expect(persistedSettings.theme).toBe('dark');
    expect(persistedNotifications).toMatchObject({ likes: false, messages: false, follows: true });
    expect(persistedAccessibility).toMatchObject({ highContrast: true, fontSize: 'large' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(socketHelper.broadcast).toHaveBeenCalledWith('settings_updated', expect.objectContaining({ userId: 7 }));
  });


  test('reads PostgreSQL lowercase privacy column names correctly', async () => {
    const req = { user: { id: 7 } };
    const res = createResponse();
    mockDb.query.mockResolvedValueOnce([[{
      settings: JSON.stringify({ theme: 'dark', privacy: { showLastSeen: 'contacts', readReceipts: false } }),
      privacy_showprofile: 'private',
      privacy_showemail: true,
      notification_prefs: JSON.stringify({}),
      accessibility_prefs: JSON.stringify({})
    }]]);

    await settingsController.getSettings(req, res);

    const returned = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(returned.privacy.profileVisibility).toBe('private');
    expect(returned.privacy.showEmail).toBe(true);
    expect(returned.privacy.showLastSeen).toBe('contacts');
    expect(returned.privacy.readReceipts).toBe(false);
  });

  test('rejects unsupported theme without writing to the database', async () => {
    const req = { user: { id: 7 }, body: { theme: 'neon' } };
    const res = createResponse();

    await settingsController.updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});
