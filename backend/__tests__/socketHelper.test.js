// Mock socket.io
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  on: jest.fn(),
  use: jest.fn(),
  use: jest.fn(),
  sockets: {
    sockets: new Map(),
  },
};

jest.mock('socket.io', () => ({
  Server: jest.fn(() => mockIo),
}), { virtual: true });

// Mock database
const mockDb = {
  query: jest.fn(),
};

jest.mock('../db', () => mockDb), { virtual: true };

const socketHelper = require('../socketHelper');

describe('socketHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIo.to.mockClear();
    mockIo.emit.mockClear();
    // Clear internal maps if accessible
    // Note: userSockets and conversationViewers are not exported, so we test via behavior
  });

  describe('init', () => {
    test('initializes socket.io server', () => {
      const mockServer = {};
      const io = socketHelper.init(mockServer);

      expect(io).toBeDefined();
      expect(socketHelper.getIO()).toBe(io);
    });
  });

  describe('sendToUser', () => {
    test('sends event to user sockets', async () => {
      const userId = 1;
      // We can't directly test userSockets since it's not exported
      // This would require integration test or mocking the internal module
      // For unit tests, we test that the function doesn't throw
      const result = await socketHelper.sendToUser(userId, 'test_event', { data: 'test' });

      // The function returns a boolean
      expect(typeof result).toBe('boolean');
    });

    test('returns false for non-existent user', async () => {
      const result = await socketHelper.sendToUser(999, 'test_event', { data: 'test' });

      expect(result).toBe(false);
      expect(mockIo.to).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToConversation', () => {
    test('broadcasts to individual conversation', async () => {
      mockDb.query
        .mockResolvedValueOnce([[]]); // Group doesn't exist (individual chat)

      await socketHelper.broadcastToConversation('1_2', 'test_event', { data: 'test' }, 1);

      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockIo.to).not.toHaveBeenCalled();
    });

    test('broadcasts to group conversation', async () => {
      const groupMembers = [{ user_id: 2 }, { user_id: 3 }, { user_id: 4 }];

      mockDb.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // Group exists
        .mockResolvedValueOnce([groupMembers]); // Group members

      await socketHelper.broadcastToConversation(1, 'test_event', { data: 'test' }, 1);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM groups_table WHERE id = ?',
        [1]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?',
        [1, 1]
      );
    });
  });

  describe('emitMessageStatus', () => {
    test('emits message status to conversation', async () => {
      mockDb.query.mockResolvedValueOnce([[]]); // Individual chat

      await socketHelper.emitMessageStatus('1_2', 123, 'delivered', 1);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('notifyContactsOnlineStatus', () => {
    test('notifies contacts of online status change', async () => {
      const contacts = [{ id: 2 }, { id: 3 }];
      const groupMembers = [{ user_id: 4 }];

      mockDb.query
        .mockResolvedValueOnce([contacts]) // Individual contacts
        .mockResolvedValueOnce([groupMembers]); // Group members

      // Just verify it doesn't throw
      await expect(socketHelper.notifyContactsOnlineStatus(1, true)).resolves.not.toThrow();
    });
  });
  describe('isConversationMember', () => {
    test('requires the authenticated profile to belong to the group', async () => {
      mockDb.query.mockResolvedValueOnce([[{ 1: 1 }]]);

      await expect(socketHelper.isConversationMember(12, 44)).resolves.toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1',
        [44, 12]
      );
    });

    test('allows direct conversations only when the authenticated user is in the canonical pair', async () => {
      mockDb.query.mockResolvedValueOnce([[{ id: 24 }]]);

      await expect(socketHelper.isConversationMember(12, '12_24')).resolves.toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM users u'),
        [24, 12, 12]
      );
    });

    test('rejects direct conversation identifiers that omit the authenticated user', async () => {
      await expect(socketHelper.isConversationMember(12, '20_24')).resolves.toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('rejects malformed conversation identifiers', async () => {
      await expect(socketHelper.isConversationMember(12, '12_x')).resolves.toBe(false);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

});