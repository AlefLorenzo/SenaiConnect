import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateStory from '../components/CreateStory';
import { AuthContext } from '../context/AuthContext';

// Mock dependencies
jest.mock('../components/Avatar', () => ({ __esModule: true, default: ({ user, className }) => (
  <div data-testid="avatar" className={className}>{user?.name}</div>
)}));

jest.mock('../services/storiesService', () => ({
  storiesService: {
    createStory: jest.fn().mockResolvedValue({
      id: 1,
      stories: [{
        id: 1,
        media_url: 'test.jpg',
        media_type: 'image',
        text_content: 'Test story',
        created_at: new Date().toISOString(),
      }],
    }),
    searchUsersForMentions: jest.fn().mockResolvedValue([]),
  },
}));

const mockUser = {
  id: 1,
  name: 'Current User',
  avatar: 'current-avatar.jpg',
  role: 'aluno',
  isVerified: true,
};

const renderCreateStory = (props = {}) => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onStoryCreated: jest.fn(),
    ...props,
  };

  return render(
    <AuthContext.Provider value={{ user: mockUser, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
      <CreateStory {...defaultProps} />
    </AuthContext.Provider>
  );
};

describe('CreateStory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when isOpen is true', () => {
    renderCreateStory();
    expect(screen.getByRole('dialog', { name: /criar história/i })).toBeInTheDocument();
    expect(screen.getByText('Criar história')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    renderCreateStory({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('closes on close button click', () => {
    const onClose = jest.fn();
    renderCreateStory({ onClose });
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });

  test('shows privacy selector when lock icon clicked', () => {
    renderCreateStory();
    // Privacy is a Lock icon button with aria-label "Privacidade"
    fireEvent.click(screen.getByLabelText('Privacidade'));
    // Modal should open with privacy options
    expect(screen.getByText('Quem pode ver')).toBeInTheDocument();
    expect(screen.getByText('Público')).toBeInTheDocument();
    expect(screen.getByText('Meus contatos')).toBeInTheDocument();
    expect(screen.getByText('Melhores amigos')).toBeInTheDocument();
  });

  test('shows text input for text stories when Texto tab is active', () => {
    renderCreateStory();
    // Default tab is 'camera', need to click 'Texto' tab
    fireEvent.click(screen.getByText('Texto'));
    const textArea = screen.getByPlaceholderText(/escreva algo/i);
    expect(textArea).toBeInTheDocument();
  });

  test('handles text input change', () => {
    renderCreateStory();
    fireEvent.click(screen.getByText('Texto'));
    const textArea = screen.getByPlaceholderText(/escreva algo/i);
    fireEvent.change(textArea, { target: { value: 'Hello world' } });
    expect(textArea).toHaveValue('Hello world');
  });

  test('shows background color options for text stories', () => {
    renderCreateStory();
    fireEvent.click(screen.getByText('Texto'));
    const textArea = screen.getByPlaceholderText(/escreva algo/i);
    fireEvent.change(textArea, { target: { value: 'Test' } });
    // Background color options are color buttons - check for first color option
    expect(screen.getByLabelText('Cor de fundo #0D8ABC')).toBeInTheDocument();
  });

  test('shows media upload options in camera tab', () => {
    renderCreateStory();
    // Camera tab is active by default
    expect(screen.getByText('Escolher arquivo')).toBeInTheDocument();
  });

  test('handles image file selection', () => {
    const { container } = renderCreateStory();
    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    // Should show preview - component uses "Prévia da imagem" as alt text
    expect(container.querySelector('img[alt="Prévia da imagem"]')).toBeInTheDocument();
  });

  test('handles video file selection', () => {
    const { container } = renderCreateStory();
    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    // Should show video preview - video element doesn't have alt, check for video tag
    expect(container.querySelector('video')).toBeInTheDocument();
  });

  test('shows drawing tools for image stories', () => {
    renderCreateStory();
    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    // Drawing tools appear in header when media is selected
    expect(screen.getByLabelText('Adicionar texto')).toBeInTheDocument();
    expect(screen.getByLabelText('Adicionar emoji')).toBeInTheDocument();
    expect(screen.getByLabelText('Desenhar')).toBeInTheDocument();
    expect(screen.getByLabelText('Recortar')).toBeInTheDocument();
  });

  test('shows privacy exceptions for "Meus contatos, exceto..."', () => {
    renderCreateStory();
    fireEvent.click(screen.getByLabelText('Privacidade'));
    // Select "Meus contatos" (followers)
    fireEvent.click(screen.getByText('Meus contatos'));
    // Should show exception search
    expect(screen.getByPlaceholderText('Digite para excluir contatos...')).toBeInTheDocument();
  });

  test('shows privacy exceptions for "Compartilhar apenas com..."', () => {
    renderCreateStory();
    fireEvent.click(screen.getByLabelText('Privacidade'));
    // Select "Melhores amigos" (close_friends)
    fireEvent.click(screen.getByText('Melhores amigos'));
    // Should show exception search
    expect(screen.getByPlaceholderText('Digite para selecionar contatos...')).toBeInTheDocument();
  });

  test('calls createStory on submit', async () => {
    const onStoryCreated = jest.fn();
    renderCreateStory({ onStoryCreated });

    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    fireEvent.click(screen.getByText('Compartilhar'));

    await waitFor(() => {
      expect(onStoryCreated).toHaveBeenCalled();
    });
  });

  test('disables share button when no content', () => {
    renderCreateStory();
    const shareButton = screen.getByText('Compartilhar');
    expect(shareButton).toBeDisabled();
  });

  test('enables share button when text is entered in text tab', () => {
    renderCreateStory();
    fireEvent.click(screen.getByText('Texto'));
    const textArea = screen.getByPlaceholderText(/escreva algo/i);
    fireEvent.change(textArea, { target: { value: 'Test story' } });
    const shareButton = screen.getByText('Compartilhar');
    expect(shareButton).not.toBeDisabled();
  });

  test('shows emoji picker when emoji button clicked', () => {
    renderCreateStory();
    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    fireEvent.click(screen.getByLabelText('Adicionar emoji'));
    // Category tabs are "Smileys", "Gestos", "Corações", "Objetos"
    expect(screen.getByText('Smileys')).toBeInTheDocument();
    // Emoji buttons have aria-label with the emoji character
    expect(screen.getByLabelText('😀')).toBeInTheDocument();
  });

  test('shows color picker for drawing', () => {
    renderCreateStory();
    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    fireEvent.click(screen.getByLabelText('Desenhar'));
    // Labels in component are "Cor:" and "Espessura:"
    expect(screen.getByLabelText(/cor:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/espessura:/i)).toBeInTheDocument();
  });

  test('shows crop tool', async () => {
    renderCreateStory();
    const fileInput = screen.getByLabelText(/escolher arquivo/i);
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Find and click the Recortar button in the header
    const recortarButton = screen.getByLabelText('Recortar');
    fireEvent.click(recortarButton);

    // Wait for crop toolbar to appear - Aplicar is unique to crop toolbar
    await waitFor(() => {
      expect(screen.getByText('Aplicar')).toBeInTheDocument();
    });
  });
});