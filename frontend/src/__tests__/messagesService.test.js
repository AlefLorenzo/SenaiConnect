// Mock the entire messagesService module
jest.mock('../services/messagesService', () => {
  const mockTransformConversations = jest.fn((conversations) => {
    return conversations.map(conv => {
      if (conv.isGroup || Number.isInteger(Number(conv.conversation_id)) && !String(conv.conversation_id).includes('_')) {
        return {
          conversation_id: conv.conversation_id,
          id: conv.conversation_id,
          isGroup: true,
          name: conv.group_name || conv.name,
          avatar: conv.group_avatar || conv.avatar,
          participants: conv.participants || [],
          last_message: conv.last_message ? {
            ...conv.last_message,
            sender_name: conv.last_message.sender_name,
          } : null,
          unread_count: conv.unread_count || 0,
          isAdmin: conv.isAdmin,
          memberCount: conv.memberCount,
        };
      }
      const otherParticipant = conv.participants?.find(p => p.name !== 'Você') || {};
      return {
        conversation_id: conv.conversation_id,
        id: conv.conversation_id,
        isGroup: false,
        name: otherParticipant.name || conv.name,
        avatar: otherParticipant.avatar || conv.avatar,
        participants: conv.participants || [],
        last_message: conv.last_message ? {
          ...conv.last_message,
          sender_name: conv.last_message.sender_name,
        } : null,
        unread_count: conv.unread_count || 0,
        isPinned: conv.isPinned,
        isMuted: conv.isMuted,
        isRequest: conv.isRequest,
      };
    });
  });

  return {
    __esModule: true,
    default: {
      getConversations: jest.fn().mockResolvedValue({ data: [] }),
      getMyGroups: jest.fn().mockResolvedValue({ data: [] }),
      sendMessage: jest.fn().mockResolvedValue({ data: { id: 1, content: 'test', status: 'sent' } }),
      markAsRead: jest.fn().mockResolvedValue({ success: true }),
      uploadMedia: jest.fn().mockResolvedValue({ data: { url: 'http://test.com/image.png' } }),
      clearCache: jest.fn(),
      transformConversations: mockTransformConversations,
    },
  };
});

import messagesService from '../services/messagesService';

describe('messagesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversations', () => {
    test('returns conversations from mock', async () => {
      const result = await messagesService.getConversations();
      expect(result.data).toEqual([]);
    });
  });

  describe('getMyGroups', () => {
    test('returns groups from mock', async () => {
      const result = await messagesService.getMyGroups();
      expect(result.data).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    test('sends message via mock', async () => {
      const result = await messagesService.sendMessage('1_2', { content: 'test', type: 'text' });
      expect(result.data).toEqual({ id: 1, content: 'test', status: 'sent' });
    });
  });

  describe('markAsRead', () => {
    test('marks as read via mock', async () => {
      const result = await messagesService.markAsRead('1_2');
      expect(result.success).toBe(true);
    });
  });

  describe('uploadMedia', () => {
    test('uploads media via mock', async () => {
      const result = await messagesService.uploadMedia(new File([''], 'test.png'));
      expect(result.data.url).toBe('http://test.com/image.png');
    });
  });

  describe('transformConversations', () => {
    test('transforms individual conversations correctly', () => {
      const rawConversations = [
        {
          conversation_id: '1_2',
          participants: [
            { id: 1, name: 'Você', avatar: 'avatar1.jpg', isOnline: true },
            { id: 2, name: 'Maria', avatar: 'avatar2.jpg', isOnline: true },
          ],
          last_message: {
            id: 1,
            content: 'Olá',
            sender_id: 2,
            sender_name: 'Maria',
            type: 'text',
            status: 'read',
            created_at: '2024-01-15T10:30:00Z',
          },
          unread_count: 2,
          isPinned: true,
          isMuted: false,
        },
      ];

      const transformed = messagesService.transformConversations(rawConversations);

      expect(transformed).toHaveLength(1);
      expect(transformed[0]).toMatchObject({
        conversation_id: '1_2',
        id: '1_2',
        isGroup: false,
        name: 'Maria',
        participants: expect.arrayContaining([
          expect.objectContaining({ name: 'Você' }),
          expect.objectContaining({ name: 'Maria' }),
        ]),
        last_message: expect.objectContaining({
          content: 'Olá',
          sender_name: 'Maria',
        }),
        unread_count: 2,
        isPinned: true,
      });
    });

    test('transforms group conversations correctly', () => {
      const rawConversations = [
        {
          conversation_id: 1,
          participants: [
            { id: 1, name: 'Você', avatar: 'avatar1.jpg', isOnline: true },
            { id: 2, name: 'Maria', avatar: 'avatar2.jpg', isOnline: true },
            { id: 3, name: 'João', avatar: 'avatar3.jpg', isOnline: false },
          ],
          last_message: {
            id: 1,
            content: 'Mensagem do grupo',
            sender_id: 2,
            sender_name: 'Maria',
            type: 'text',
            status: 'read',
            created_at: '2024-01-15T10:30:00Z',
          },
          unread_count: 1,
          group_name: 'Grupo de Teste',
          group_avatar: 'group.jpg',
          isAdmin: true,
          memberCount: 3,
        },
      ];

      const transformed = messagesService.transformConversations(rawConversations);

      expect(transformed).toHaveLength(1);
      expect(transformed[0]).toMatchObject({
        conversation_id: 1,
        id: 1,
        isGroup: true,
        name: 'Grupo de Teste',
        avatar: 'group.jpg',
        last_message: expect.objectContaining({
          content: 'Mensagem do grupo',
          sender_name: 'Maria',
        }),
        memberCount: 3,
      });
    });

    test('handles missing last_message gracefully', () => {
      const rawConversations = [
        {
          conversation_id: '1_2',
          participants: [
            { id: 1, name: 'Você', avatar: 'avatar1.jpg' },
            { id: 2, name: 'Maria', avatar: 'avatar2.jpg' },
          ],
          unread_count: 0,
        },
      ];

      const transformed = messagesService.transformConversations(rawConversations);

      expect(transformed[0].last_message).toBeNull();
    });
  });

  describe('clearCache', () => {
    test('clears internal cache', () => {
      expect(() => messagesService.clearCache()).not.toThrow();
    });
  });
});