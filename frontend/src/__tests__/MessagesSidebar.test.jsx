import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies
jest.mock('../components/Avatar', () => ({
  __esModule: true,
  default: jest.fn(({ user, className, size }) => (
    <div data-testid="avatar" className={className} style={{ width: size, height: size }}>
      {user?.avatar ? `img:${user.avatar}` : user?.name || 'User'}
    </div>
  )),
}));

jest.mock('lucide-react', () => ({
  Send: jest.fn(() => <span data-testid="send-icon" />),
  Plus: jest.fn(() => <span data-testid="plus-icon" />),
  MoreVertical: jest.fn(() => <span data-testid="more-icon" />),
  Search: jest.fn(() => <span data-testid="search-icon" />),
  AlertCircle: jest.fn(() => <span data-testid="alert-circle" />),
  Star: jest.fn(() => <span data-testid="star-icon" />),
  BellOff: jest.fn(() => <span data-testid="bell-off-icon" />),
}));

// Mock messagesService
jest.mock('../services/messagesService', () => ({
  __esModule: true,
  default: {
    getConversations: jest.fn().mockResolvedValue({ data: [] }),
    getMyGroups: jest.fn().mockResolvedValue({ data: [] }),
    sendMessage: jest.fn().mockResolvedValue({ data: { id: 1, content: 'test', status: 'sent' } }),
    markAsRead: jest.fn().mockResolvedValue({ success: true }),
    uploadMedia: jest.fn().mockResolvedValue({ data: { url: 'http://test.com/image.png' } }),
    clearCache: jest.fn(),
  },
}), { virtual: true });

// Mock activityService
jest.mock('../services/activityService', () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn().mockResolvedValue({ data: [] }),
    markAsRead: jest.fn().mockResolvedValue({ success: true }),
  },
}), { virtual: true });

// Mock SocketContext
jest.mock('../context/SocketContext', () => ({
  __esModule: true,
  SocketContext: {
    Provider: ({ children }) => children,
  },
  useSocket: () => ({
    socket: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connected: true,
      disconnect: jest.fn(),
    },
    isConnected: true,
    connectionStatus: 'connected',
    reconnectAttempt: 0,
  }),
}), { virtual: true });

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  __esModule: true,
  AuthContext: {
    Provider: ({ children }) => children,
  },
  useAuth: () => ({
    user: {
      id: 1,
      name: 'Current User',
      avatar: 'current-avatar.jpg',
      role: 'aluno',
      isVerified: true,
    },
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  }),
}), { virtual: true });

// Import the component directly from Messages.jsx
import { MessagesSidebar, getContactName, getOtherParticipant } from '../pages/Messages';

const mockContacts = [
  {
    conversation_id: '1_2',
    id: '1_2',
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: 'current-avatar.jpg', isOnline: true },
      { id: 2, name: 'Maria Silva', avatar: 'maria.jpg', isOnline: true },
    ],
    last_message: {
      id: 1,
      content: 'Olá, tudo bem?',
      sender_id: 2,
      sender_name: 'Maria Silva',
      type: 'text',
      status: 'read',
      created_at: '2024-01-15T10:30:00Z',
    },
    unread_count: 0,
    isPinned: false,
    isMuted: false,
    isRequest: false,
  },
  {
    conversation_id: '1_3',
    id: '1_3',
    isGroup: false,
    participants: [
      { id: 1, name: 'Você', avatar: 'current-avatar.jpg', isOnline: true },
      { id: 3, name: 'João Santos', avatar: 'joao.jpg', isOnline: false },
    ],
    last_message: {
      id: 2,
      content: 'Teste de mensagem',
      sender_id: 1,
      sender_name: 'Você',
      type: 'text',
      status: 'sent',
      created_at: '2024-01-15T11:00:00Z',
    },
    unread_count: 2,
    isPinned: true,
    isMuted: false,
    isRequest: false,
  },
];

const mockGroups = [
  {
    id: 1,
    name: 'Grupo de Estudo',
    description: 'Grupo para estudos',
    avatar: 'group.jpg',
    isAdmin: true,
    memberCount: 5,
    unread_count: 1,
    isMuted: false,
    isImportant: true,
  },
];

const defaultProps = {
  activeTab: 'general',
  setActiveTab: jest.fn(),
  tabs: [
    { id: 'primary', label: 'Principal', icon: () => <span />, count: 1 },
    { id: 'general', label: 'Geral', icon: () => <span />, count: 2 },
    { id: 'requests', label: 'Solicitações', icon: () => <span />, count: 0 },
    { id: 'groups', label: 'Grupos', icon: () => <span />, count: 1 },
  ],
  searchTerm: '',
  setSearchTerm: jest.fn(),
  currentContacts: mockContacts,
  getContactName,
  getContactAvatar: (contact) => contact.isGroup
    ? { name: contact.name, avatar: contact.avatar }
    : contact.participants?.find(p => p.name !== 'Você') || { name: 'Unknown', avatar: null },
  getContactUnread: (contact) => contact.unread_count || 0,
  getOtherParticipant,
  onSelectContact: jest.fn(),
  selectedContactId: null,
  isMobile: false,
  setShowMobileChat: jest.fn(),
  isConnected: true,
  onCreateGroup: jest.fn(),
};

const renderSidebar = (props = {}) => {
  return render(<MessagesSidebar {...defaultProps} {...props} />);
};

describe('MessagesSidebar', () => {
  describe('Group creation', () => {
    test('shows the create group action and invokes its handler on the groups tab', () => {
      const onCreateGroup = jest.fn();
      renderSidebar({ activeTab: 'groups', onCreateGroup });

      fireEvent.click(screen.getByRole('button', { name: /criar grupo/i }));

      expect(onCreateGroup).toHaveBeenCalledTimes(1);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders sidebar header with title and action buttons', () => {
      renderSidebar();

      expect(screen.getByText('Mensagens')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /nova mensagem/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mais opções/i })).toBeInTheDocument();
    });

    test('renders all four tabs', () => {
      renderSidebar();

      expect(screen.getByRole('tab', { name: /principal/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /geral/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /solicitações/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /grupos/i })).toBeInTheDocument();
    });

    test('shows search input with correct placeholder for conversations', () => {
      renderSidebar({ activeTab: 'general' });

      expect(screen.getByPlaceholderText(/pesquisar mensagens/i)).toBeInTheDocument();
    });

    test('shows search input with correct placeholder for groups', () => {
      renderSidebar({ activeTab: 'groups' });

      expect(screen.getByPlaceholderText(/pesquisar grupos/i)).toBeInTheDocument();
    });
  });

  describe('Contact List - Individual Conversations', () => {
    test('displays contact name correctly (not "Você")', () => {
      renderSidebar({ currentContacts: mockContacts });

      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      expect(screen.getByText('João Santos')).toBeInTheDocument();
      expect(screen.queryByText('Você')).not.toBeInTheDocument();
    });

    test('shows last message preview', () => {
      renderSidebar({ currentContacts: mockContacts });

      expect(screen.getByText('Olá, tudo bem?')).toBeInTheDocument();
      expect(screen.getByText('Teste de mensagem')).toBeInTheDocument();
    });

    test('shows unread badge for conversations with unread messages', () => {
      renderSidebar({ currentContacts: mockContacts });

      const joaoItem = screen.getByText('João Santos').closest('.contact-item');
      expect(joaoItem).toHaveClass('unread');
      // Use aria-label to find the specific unread badge
      expect(screen.getByLabelText(/2 mensagens não lidas/)).toBeInTheDocument();
    });

    test('shows online indicator for online contacts', () => {
      renderSidebar({ currentContacts: mockContacts });

      const mariaItem = screen.getByText('Maria Silva').closest('.contact-item');
      expect(mariaItem.querySelector('.online-indicator')).toBeInTheDocument();
    });

    test('does not show online indicator for offline contacts', () => {
      renderSidebar({ currentContacts: mockContacts });

      const joaoItem = screen.getByText('João Santos').closest('.contact-item');
      expect(joaoItem.querySelector('.online-indicator')).not.toBeInTheDocument();
    });

    test('shows muted badge for muted conversations', () => {
      const mutedContacts = [
        {
          ...mockContacts[0],
          isMuted: true,
        },
      ];

      renderSidebar({ currentContacts: mutedContacts });

      const mariaItem = screen.getByText('Maria Silva').closest('.contact-item');
      expect(mariaItem.querySelector('.muted-badge')).toBeInTheDocument();
    });

    test('highlights active conversation', () => {
      renderSidebar({
        currentContacts: mockContacts,
        selectedContactId: '1_2',
      });

      const mariaItem = screen.getByText('Maria Silva').closest('.contact-item');
      expect(mariaItem).toHaveClass('active');
    });
  });

  describe('Contact List - Groups', () => {
    test('displays group name correctly', () => {
      renderSidebar({
        activeTab: 'groups',
        currentContacts: mockGroups,
      });

      expect(screen.getByText('Grupo de Estudo')).toBeInTheDocument();
    });

    test('shows important badge for important groups', () => {
      renderSidebar({
        activeTab: 'groups',
        currentContacts: mockGroups,
      });

      const groupItem = screen.getByText('Grupo de Estudo').closest('.contact-item');
      expect(groupItem.querySelector('.important-badge')).toBeInTheDocument();
    });

    test('shows group name in sidebar', () => {
      renderSidebar({
        activeTab: 'groups',
        currentContacts: mockGroups,
      });

      expect(screen.getByText('Grupo de Estudo')).toBeInTheDocument();
    });
  });

  
  describe('Tab Switching', () => {
    test('calls setActiveTab when tab is clicked', () => {
      renderSidebar();

      fireEvent.click(screen.getByRole('tab', { name: /principal/i }));

      expect(defaultProps.setActiveTab).toHaveBeenCalledWith('primary');
    });

    test('calls onSelectContact with null when switching tabs', () => {
      renderSidebar({ selectedContactId: '1_2' });

      fireEvent.click(screen.getByRole('tab', { name: /geral/i }));

      expect(defaultProps.onSelectContact).toHaveBeenCalledWith(null);
    });
  });

  describe('Conversation Selection', () => {
    test('calls onSelectContact when contact is clicked', () => {
      renderSidebar({ currentContacts: mockContacts });

      fireEvent.click(screen.getByText('Maria Silva'));

      expect(defaultProps.onSelectContact).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: '1_2',
          participants: expect.arrayContaining([
            expect.objectContaining({ name: 'Maria Silva' }),
          ]),
        })
      );
    });
  });

  describe('Connection Status', () => {
    test('shows offline warning when disconnected', () => {
      renderSidebar({ isConnected: false });

      expect(screen.getByText(/offline/i)).toBeInTheDocument();
      expect(screen.getByText(/mensagens serão enviadas quando reconectar/i)).toBeInTheDocument();
    });

    test('does not show offline warning when connected', () => {
      renderSidebar({ isConnected: true });

      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    });
  });
});