const mockQuery = jest.fn();

jest.mock('../db', () => ({ query: mockQuery }));
jest.mock('../socketHelper', () => ({
  sendToUser: jest.fn(),
  sendGroupMessage: jest.fn(),
  broadcast: jest.fn(),
}));
jest.mock('../utils/groupEligibility', () => ({
  getEligibleGroupContacts: jest.fn(),
  getEligibleGroupParticipantIds: jest.fn(),
}));

const groupController = require('../controllers/groupController');

describe('groupController.getMyGroups', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 'uuid-current-user' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('returns You for own messages and the member name for messages from others', async () => {
    mockQuery
      .mockResolvedValueOnce([[
        {
          id: 10,
          name: 'Desenvolvimento de Sistemas',
          created_at: '2026-11-22T18:00:00.000Z',
          last_message: 'opa',
          last_message_sender_id: 'uuid-current-user',
          last_message_sender_name: 'Unknown',
          last_interaction: '2026-11-22T18:26:00.000Z',
          is_muted: 0,
          is_important: 0,
          unread_count: 0,
        },
        {
          id: 11,
          name: 'Projeto SENAI',
          created_at: '2026-11-22T17:00:00.000Z',
          last_message: 'Bom dia',
          last_message_sender_id: 'uuid-maria',
          last_message_sender_name: 'Unknown',
          last_interaction: '2026-11-22T18:20:00.000Z',
          is_muted: 0,
          is_important: 0,
          unread_count: 1,
        },
      ]])
      .mockResolvedValueOnce([[
        { group_id: 10, id: 'uuid-current-user', name: 'Usuário atual', avatar: null, role: 'admin', is_online: 1, last_seen: null },
        { group_id: 11, id: 'uuid-current-user', name: 'Usuário atual', avatar: null, role: 'admin', is_online: 1, last_seen: null },
        { group_id: 11, id: 'uuid-maria', name: 'Maria Silva', avatar: 'maria.jpg', role: 'member', is_online: 1, last_seen: null },
      ]])
      .mockResolvedValueOnce([[
        { group_id: 10, admin_id: 'uuid-current-user' },
        { group_id: 11, admin_id: 'uuid-current-user' },
      ]]);

    await groupController.getMyGroups(req, res);

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHEN latest.sender_id = ? THEN 'You'"),
      Array(6).fill('uuid-current-user')
    );

    const [groups] = res.json.mock.calls[0];
    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 10,
        last_message: expect.objectContaining({
          senderId: 'uuid-current-user',
          senderName: 'You',
          content: 'opa',
        }),
      }),
      expect.objectContaining({
        id: 11,
        last_message: expect.objectContaining({
          senderId: 'uuid-maria',
          senderName: 'Maria Silva',
          content: 'Bom dia',
        }),
      }),
    ]));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
