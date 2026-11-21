import React from 'react';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
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
  Check: jest.fn(() => <span data-testid="check-icon" />),
  CheckCheck: jest.fn(() => <span data-testid="double-check-icon" />),
  Clock: jest.fn(() => <span data-testid="clock-icon" />),
  Trash2: jest.fn(() => <span data-testid="trash-icon" />),
  Flag: jest.fn(() => <span data-testid="flag-icon" />),
  RotateCcw: jest.fn(() => <span data-testid="retry-icon" />),
  Image: jest.fn(() => <span data-testid="image-icon" />),
  FileText: jest.fn(() => <span data-testid="file-icon" />),
  Loader2: jest.fn(() => <span data-testid="loader" />),
  AlertCircle: jest.fn(() => <span data-testid="alert-icon" />),
  Shield: jest.fn(() => <span data-testid="shield-icon" />),
  FileImage: jest.fn(() => <span data-testid="file-image-icon" />),
  FileSpreadsheet: jest.fn(() => <span data-testid="file-spreadsheet-icon" />),
  FileArchive: jest.fn(() => <span data-testid="file-archive-icon" />),
  Music: jest.fn(() => <span data-testid="music-icon" />),
  Video: jest.fn(() => <span data-testid="video-icon" />),
  FileCode: jest.fn(() => <span data-testid="file-code-icon" />),
  Maximize2: jest.fn(() => <span data-testid="maximize-icon" />),
  Download: jest.fn(() => <span data-testid="download-icon" />),
  X: jest.fn(() => <span data-testid="x-icon" />),
  RotateCw: jest.fn(() => <span data-testid="rotate-icon" />),
  ZoomIn: jest.fn(() => <span data-testid="zoom-in-icon" />),
  ZoomOut: jest.fn(() => <span data-testid="zoom-out-icon" />),
}));

// Import the component
import MessageBubble from '../components/MessageBubble';

const defaultProps = {
  message: {
    id: 1,
    tempId: null,
    content: 'Mensagem de teste',
    sender_id: 2,
    sender_name: 'Maria Silva',
    type: 'text',
    status: 'read',
    created_at: '2024-01-15T10:30:00Z',
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    attachment_size: null,
    isPending: false,
    isFailed: false,
  },
  index: 0,
  messages: [],
  currentUserId: 1,
  isGroup: false,
  participants: [
    { id: 1, name: 'Você', avatar: 'current-avatar.jpg' },
    { id: 2, name: 'Maria Silva', avatar: 'maria.jpg' },
  ],
  adminIds: [],
  onRetry: jest.fn(),
  onImageClick: jest.fn(),
  showDateSeparator: true,
};

const renderMessageBubble = (props = {}) => {
  return render(<MessageBubble {...defaultProps} {...props} />);
};

describe('MessageBubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - Sent Messages (current user)', () => {
    test('renders sent message with correct alignment (right)', () => {
      const sentMessage = {
        ...defaultProps.message,
        sender_id: 1,
        sender_name: 'Você',
      };

      renderMessageBubble({ message: sentMessage });

      const bubble = screen.getByText('Mensagem de teste').closest('.message-bubble');
      expect(bubble).toHaveClass('sent');
    });

    test('does not show sender name for own messages in groups', () => {
      const sentMessage = {
        ...defaultProps.message,
        sender_id: 1,
        sender_name: 'Você',
      };

      renderMessageBubble({
        message: sentMessage,
        isGroup: true,
      });

      // Component does not show sender header for sent messages (isSent returns false for shouldShowSenderHeader)
      expect(screen.queryByText('Você')).not.toBeInTheDocument();
    });

    test('does not show sender name for own messages in individual chats', () => {
      const sentMessage = {
        ...defaultProps.message,
        sender_id: 1,
        sender_name: 'Você',
      };

      renderMessageBubble({
        message: sentMessage,
        isGroup: false,
      });

      expect(screen.queryByText('Você')).not.toBeInTheDocument();
    });
  });

  describe('Rendering - Received Messages (other users)', () => {
    test('renders received message with correct alignment (left)', () => {
      renderMessageBubble();

      const bubble = screen.getByText('Mensagem de teste').closest('.message-bubble');
      expect(bubble).toHaveClass('received');
    });

    test('shows sender name for received messages in groups', () => {
      renderMessageBubble({
        isGroup: true,
      });

      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    });

    test('shows sender avatar for received messages in groups', () => {
      renderMessageBubble({
        isGroup: true,
      });

      // Avatar is shown in group sender header for received messages
      expect(screen.getByTestId('avatar')).toBeInTheDocument();
    });

    test('does not show sender avatar for individual chats', () => {
      renderMessageBubble({
        isGroup: false,
      });

      // Individual chats don't show avatar in message bubble
      expect(screen.queryByTestId('avatar')).not.toBeInTheDocument();
    });
  });

  describe('Message Status Icons', () => {
    test('shows sending spinner (⏳) for sending status', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'sending',
          sender_id: 1,
        },
      });

      // Component uses ⏳ emoji with class sending-spinner
      expect(screen.getByText('⏳')).toBeInTheDocument();
    });

    test('shows single check for sent status (enviada)', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'enviada',
          sender_id: 1,
        },
      });

      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    test('shows double check for delivered status (entregue)', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'entregue',
          sender_id: 1,
        },
      });

      expect(screen.getByTestId('double-check-icon')).toBeInTheDocument();
    });

    test('shows double check (blue/read) for read status (lida)', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'lida',
          sender_id: 1,
        },
      });

      expect(screen.getByTestId('double-check-icon')).toBeInTheDocument();
    });

    test('shows error icon (⚠) for failed messages (erro)', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'erro',
          sender_id: 1,
        },
      });

      expect(screen.getByText('⚠')).toBeInTheDocument();
    });
  });

  describe('Attachments', () => {
    test('renders image attachment', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          message_type: 'image',
          mediaUrl: 'http://test.com/image.png',
          fileName: 'foto.png',
          fileSize: 102400,
          content: 'Mensagem de teste',
        },
      });

      // For images, the component renders an img tag with alt text from content
      const img = screen.getByAltText('Mensagem de teste');
      expect(img).toBeInTheDocument();
      expect(img.src).toBe('http://test.com/image.png');
    });

    test('renders file attachment', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          message_type: 'file',
          mediaUrl: 'http://test.com/doc.pdf',
          fileName: 'documento.pdf',
          fileSize: 204800,
          fileType: 'application/pdf',
        },
      });

      expect(screen.getByText('documento.pdf')).toBeInTheDocument();
      // File size is displayed as "200.0 KB" (with one decimal)
      expect(screen.getByText(/200\.0 KB/)).toBeInTheDocument();
    });

    test('calls onImageClick when image attachment clicked', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          message_type: 'image',
          mediaUrl: 'http://test.com/image.png',
          content: 'Mensagem de teste',
        },
      });

      // Click on the image
      const img = screen.getByAltText('Mensagem de teste');
      fireEvent.click(img);

      expect(defaultProps.onImageClick).toHaveBeenCalledWith('http://test.com/image.png');
    });
  });

  describe('Retry Functionality', () => {
    test('shows retry button for failed messages (erro status)', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'erro',
          sender_id: 1,
        },
      });

      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });

    test('calls onRetry when retry button clicked', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'erro',
          sender_id: 1,
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

      // onRetry is called with the message ID directly
      expect(defaultProps.onRetry).toHaveBeenCalledWith(1);
    });
  });

  describe('Date Separator', () => {
    test('shows date separator when showDateSeparator is true and first message', () => {
      renderMessageBubble({
        index: 0,
        showDateSeparator: true,
      });

      // Component returns "Hoje" (capitalized) for today, or full date for past dates
      // The test runs in 2026, so 2024 dates will show full format
      const separator = screen.getByRole('separator');
      expect(separator).toBeInTheDocument();
      // Check it has a date-like format
      expect(separator.textContent).toMatch(/hoje|ontem|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo/i);
    });

    test('shows date separator when date changes', () => {
      const messages = [
        {
          ...defaultProps.message,
          id: 1,
          created_at: '2024-01-15T10:30:00Z',
        },
        {
          ...defaultProps.message,
          id: 2,
          created_at: '2024-01-16T10:30:00Z',
        },
      ];

      renderMessageBubble({
        message: messages[1],
        index: 1,
        messages,
        showDateSeparator: true,
      });

      // Since 2024 dates are in the past, component shows full date format
      const separator = screen.getByRole('separator');
      expect(separator).toBeInTheDocument();
      // Check it shows a full date format (weekday, day month)
      expect(separator.textContent).toMatch(/segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo/i);
    });

    test('does not show date separator when showDateSeparator is false', () => {
      renderMessageBubble({
        showDateSeparator: false,
      });

      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });

  describe('Sending Messages', () => {
    test('shows sending spinner (⏳) for sending status', () => {
      renderMessageBubble({
        message: {
          ...defaultProps.message,
          status: 'sending',
          sender_id: 1,
        },
      });

      // Component shows ⏳ emoji with aria-label="Enviando..."
      expect(screen.getByText('⏳')).toBeInTheDocument();
    });
  });

  describe('Time Display', () => {
    test('shows formatted time for message', () => {
      renderMessageBubble();

      // Component uses locale time format (pt-BR) - time may vary by timezone
      // Just verify a time format is present (HH:MM)
      const timeElement = screen.getByRole('time');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement.textContent).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('Group Message Grouping', () => {
    test('shows sender header only for first message in sequence', () => {
      const messages = [
        { ...defaultProps.message, id: 1, sender_id: 2, created_at: '2024-01-15T10:30:00Z' },
        { ...defaultProps.message, id: 2, sender_id: 2, created_at: '2024-01-15T10:31:00Z' },
        { ...defaultProps.message, id: 3, sender_id: 3, created_at: '2024-01-15T10:32:00Z' },
      ];

      // Participants include sender_id 3 with name "Maria Silva" for the third message
      const participants = [
        { id: 1, name: 'Você', avatar: 'current-avatar.jpg' },
        { id: 2, name: 'Maria Silva', avatar: 'maria.jpg' },
        { id: 3, name: 'João Santos', avatar: 'joao.jpg' },
      ];

      // First message from sender 2 - should show header
      let result = renderMessageBubble({
        message: messages[0],
        index: 0,
        messages,
        isGroup: true,
        participants,
      });
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();

      // Clean up before next render
      result.unmount();
      cleanup();

      // Second message from same sender - should NOT show header
      result = renderMessageBubble({
        message: messages[1],
        index: 1,
        messages,
        isGroup: true,
        participants,
      });
      expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();

      // Clean up before next render
      result.unmount();
      cleanup();

      // Third message from different sender (id 3 = João Santos) - should show header
      renderMessageBubble({
        message: messages[2],
        index: 2,
        messages,
        isGroup: true,
        participants,
      });
      expect(screen.getByText('João Santos')).toBeInTheDocument();
    });
  });
});