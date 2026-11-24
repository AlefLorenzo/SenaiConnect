const mockQuery = jest.fn();
const mockSendGroupMessage = jest.fn();
const mockCreateNotification = jest.fn().mockResolvedValue(undefined);

jest.mock('../db', () => ({ query: mockQuery }));
jest.mock('../socketHelper', () => ({
    sendGroupMessage: mockSendGroupMessage,
}));
jest.mock('../controllers/notificationController', () => ({
    createNotification: mockCreateNotification,
}));

const {
    getEligibleGroupContacts,
    getEligibleGroupParticipantIds,
} = require('../utils/groupEligibility');
const groupController = require('../controllers/groupController');

describe('group creation contact eligibility', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
        mockCreateNotification.mockResolvedValue(undefined);
        req = {
            user: { id: 1, name: 'Usuário atual' },
            params: {},
            body: {},
            query: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    });

    test('lists contacts with an existing direct chat or either follow direction', async () => {
        const contacts = [
            { id: 2, name: 'Maria', has_conversation: 1, is_following: 0, follows_you: 0 },
            { id: 3, name: 'João', has_conversation: 0, is_following: 1, follows_you: 0 },
            { id: 4, name: 'Ana', has_conversation: 0, is_following: 0, follows_you: 1 },
        ];
        mockQuery.mockResolvedValueOnce([contacts]);

        await groupController.getEligibleContacts(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][0]).toContain('FROM messages');
        expect(mockQuery.mock.calls[0][0]).toContain('FROM follows');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(contacts);
    });

    test('rejects a candidate who has no conversation or follow relationship', async () => {
        mockQuery.mockResolvedValueOnce([[{ id: 2 }]]);

        const eligible = await getEligibleGroupParticipantIds(1, [2, 3]);

        expect(eligible).toEqual([2]);
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][0]).toContain('FROM messages');
        expect(mockQuery.mock.calls[0][0]).toContain('FROM follows');
        expect(mockQuery.mock.calls[0][1]).toEqual([2, 3, 1, 1, 1, 1]);
    });

    test('does not query the database for self, invalid or empty participant selections', async () => {
        await expect(getEligibleGroupParticipantIds(1, [1])).resolves.toEqual([]);
        await expect(getEligibleGroupParticipantIds(1, [0])).resolves.toEqual([]);
        await expect(getEligibleGroupParticipantIds(1, [])).resolves.toEqual([]);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('rejects group creation when any selected participant is not eligible', async () => {
        req.body = { name: 'Grupo de estudo', participants: [2, 3] };
        mockQuery.mockResolvedValueOnce([[{ id: 2 }]]);

        await groupController.create(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('Só é possível adicionar pessoas'),
        }));
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][0]).not.toContain('INSERT INTO groups_table');
    });

    test('creates a group with the creator and selected eligible participants', async () => {
        req.body = {
            name: 'Projeto de Robótica',
            description: 'Equipe de projeto',
            participants: [2],
        };

        mockQuery
            .mockResolvedValueOnce([[{ id: 2 }]]) // eligible contacts
            .mockResolvedValueOnce([{ insertId: 42 }]) // create group
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // creator membership
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // creator admin
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // selected participant
            .mockResolvedValueOnce([[
                { id: 42, name: 'Projeto de Robótica', description: 'Equipe de projeto', avatar: null, created_at: new Date() },
            ]]) // group snapshot
            .mockResolvedValueOnce([[
                { id: 1, name: 'Usuário atual', role: 'admin' },
                { id: 2, name: 'Maria', role: 'member' },
            ]]); // participants

        await groupController.create(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(7);
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [42, 1, 'admin'],
        );
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [42, 2, 'member'],
        );
        expect(mockCreateNotification).toHaveBeenCalledWith(
            2,
            'group_invite',
            1,
            'adicionou você ao grupo "Projeto de Robótica".',
            'group',
            42,
            'group_42_invite',
            expect.objectContaining({ group_id: 42 }),
        );
        expect(mockSendGroupMessage).toHaveBeenCalledWith(42, expect.objectContaining({
            type: 'conversation_created',
        }), 1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    });
});
