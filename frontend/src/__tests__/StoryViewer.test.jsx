import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StoryViewer from '../components/StoryViewer';
import { AuthContext } from '../context/AuthContext';
import { storiesService } from '../services/storiesService';

// Mock dependencies
jest.mock('../components/Avatar', () => ({ __esModule: true, default: ({ user, className }) => (
  <div data-testid="avatar" className={className}>{user?.name}</div>
)}));

// Mock storiesService with synchronous mocks to avoid act() warnings with fake timers
// Create a thenable that resolves synchronously when awaited
const createSyncPromise = (value) => ({
  then(resolve) {
    resolve(value);
    return createSyncPromise(value);
  },
  catch() {
    return createSyncPromise(value);
  },
  finally(fn) {
    fn();
    return createSyncPromise(value);
  },
  [Symbol.toStringTag]: 'Promise',
});

jest.mock('../services/storiesService', () => ({
  storiesService: {
    viewStory: jest.fn().mockResolvedValue({ success: true }),
    // Return a synchronous thenable to avoid act() warnings with fake timers
    getStoryReactions: jest.fn().mockImplementation(() => createSyncPromise([])),
    getStoryViewers: jest.fn().mockImplementation(() => createSyncPromise([])),
    reactToStory: jest.fn().mockResolvedValue({ success: true, action: 'added' }),
    replyToStory: jest.fn().mockResolvedValue({ id: 1 }),
    deleteStory: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const mockUser = {
  id: 1,
  name: 'Current User',
  avatar: 'current-avatar.jpg',
  role: 'aluno',
  isVerified: true,
};

const mockStoryGroups = [
  {
    user_id: 2,
    user_name: 'Maria Silva',
    user_avatar: 'maria.jpg',
    stories: [
      {
        id: '1',
        media_url: 'story1.jpg',
        media_type: 'image',
        text_content: 'First story',
        created_at: new Date().toISOString(),
        views_count: 5,
        background_color: null,
      },
      {
        id: '2',
        media_url: 'story2.jpg',
        media_type: 'image',
        text_content: 'Second story',
        created_at: new Date().toISOString(),
        views_count: 3,
        background_color: null,
      },
    ],
  },
  {
    user_id: 3,
    user_name: 'João Santos',
    user_avatar: 'joao.jpg',
    stories: [
      {
        id: '3',
        media_url: 'story3.jpg',
        media_type: 'video',
        text_content: 'Video story',
        created_at: new Date().toISOString(),
        views_count: 10,
        background_color: null,
      },
    ],
  },
];

const renderStoryViewer = (props = {}) => {
  const defaultProps = {
    storyGroups: mockStoryGroups,
    initialGroupIndex: 0,
    onClose: jest.fn(),
    onReply: jest.fn(),
    onReact: jest.fn(),
    ...props,
  };

  return render(
    <AuthContext.Provider value={{ user: mockUser, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
      <StoryViewer {...defaultProps} />
    </AuthContext.Provider>
  );
};

describe('StoryViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('locks document and feed scrolling while the story viewer is open', () => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalRootOverflow = document.documentElement.style.overflow;

    const { unmount } = renderStoryViewer();

    expect(document.documentElement).toHaveClass('story-viewer-open');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('hidden');

    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);

    unmount();

    expect(document.documentElement).not.toHaveClass('story-viewer-open');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe(originalBodyOverflow);
    expect(document.documentElement.style.overflow).toBe(originalRootOverflow);
  });

  test('renders story viewer with first story', () => {
    renderStoryViewer();
    // Use more specific selector - the user name appears in both Avatar and header
    expect(screen.getByTestId('avatar')).toHaveTextContent('Maria Silva');
    expect(screen.getByText('First story')).toBeInTheDocument();
    expect(screen.getByAltText('Story')).toHaveAttribute('src', 'story1.jpg');
  });

  test('shows progress bars for each story in group', () => {
    renderStoryViewer();
    const progressBars = screen.getAllByRole('progressbar');
    // Group progress + 2 individual story progress bars
    expect(progressBars).toHaveLength(3);
  });

  test('displays story media (image)', () => {
    renderStoryViewer();
    const img = screen.getByAltText('Story');
    expect(img).toHaveAttribute('src', 'story1.jpg');
  });

  test('displays text-only story with background', () => {
    const textOnlyGroups = [
      {
        user_id: 2,
        user_name: 'Maria Silva',
        user_avatar: 'maria.jpg',
        stories: [
          {
            id: '1',
            media_url: null,
            media_type: 'text',
            text_content: 'Text only story',
            created_at: new Date().toISOString(),
            views_count: 0,
            background_color: 'linear-gradient(135deg, #0D8ABC, #0056D2)',
          },
        ],
      },
    ];
    renderStoryViewer({ storyGroups: textOnlyGroups });
    expect(screen.getByText('Text only story')).toBeInTheDocument();
    // Component uses className="story-text-only" - find parent with this class
    const textArea = screen.getByText('Text only story').closest('.story-text-only');
    expect(textArea).toBeInTheDocument();
    expect(textArea).toHaveStyle({ background: 'linear-gradient(135deg, #0D8ABC, #0056D2)' });
  });

  test('shows view count for owner', () => {
    // Current user (id: 1) owns the first group (user_id: 2) - wait, they don't match
    // Let's make the current user the owner
    const ownerGroups = [
      {
        user_id: 1, // Same as mockUser.id
        user_name: 'Current User',
        user_avatar: 'current-avatar.jpg',
        stories: [
          {
            id: '1',
            media_url: 'story1.jpg',
            media_type: 'image',
            text_content: 'My story',
            created_at: new Date().toISOString(),
            views_count: 5,
            background_color: null,
          },
        ],
      },
    ];
    renderStoryViewer({ storyGroups: ownerGroups });
    expect(screen.getByText('5')).toBeInTheDocument(); // views count
  });

  test('calls viewStory when story mounts', () => {
    renderStoryViewer();
    expect(storiesService.viewStory).toHaveBeenCalledWith('1');
  });

  test('navigates to next story on right click', () => {
    renderStoryViewer();
    const nextButton = screen.getByLabelText('Próxima história');
    fireEvent.click(nextButton);
    expect(screen.getByText('Second story')).toBeInTheDocument();
  });

  test('navigates to next group when current group ends', () => {
    renderStoryViewer();
    // Click next twice to go to next group
    const nextButton = screen.getByLabelText('Próxima história');
    fireEvent.click(nextButton); // Second story
    fireEvent.click(nextButton); // Next group (João Santos)
    // User name appears in both Avatar and header - use header text
    expect(screen.getByText('Video story')).toBeInTheDocument();
    // Check for the user name in the header (story-viewer-name class)
    const userNameElement = screen.getByText('Video story').closest('.story-viewer-container').querySelector('.story-viewer-name');
    expect(userNameElement).toHaveTextContent('João Santos');
  });

  test('navigates to previous story on left click', () => {
    renderStoryViewer({ initialGroupIndex: 0 });
    const nextButton = screen.getByLabelText('Próxima história');
    fireEvent.click(nextButton); // Go to second story
    const prevButton = screen.getByLabelText('História anterior');
    fireEvent.click(prevButton); // Go back to first
    expect(screen.getByText('First story')).toBeInTheDocument();
  });

  test('closes on close button click', () => {
    const onClose = jest.fn();
    renderStoryViewer({ onClose });
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });

  test('opens reactions panel on heart button click', () => {
    renderStoryViewer();
    fireEvent.click(screen.getByLabelText('Reações'));
    expect(screen.getByText('Reagir a esta história')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '❤️' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '😂' })).toBeInTheDocument();
  });

  test('opens replies panel on message button click', () => {
    renderStoryViewer();
    fireEvent.click(screen.getByLabelText('Responder'));
    expect(screen.getByText('Responder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escreva uma resposta...')).toBeInTheDocument();
  });

  test('submits reply on form submit', async () => {
    const onReply = jest.fn();
    renderStoryViewer({ onReply });
    fireEvent.click(screen.getByLabelText('Responder'));
    const textarea = screen.getByPlaceholderText('Escreva uma resposta...');
    fireEvent.change(textarea, { target: { value: 'Test reply' } });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => {
      expect(onReply).toHaveBeenCalledWith('1', 'Test reply');
      expect(storiesService.replyToStory).toHaveBeenCalledWith('1', 'Test reply');
    });
  });

  test('adds reaction on reaction button click', async () => {
    const onReact = jest.fn();
    renderStoryViewer({ onReact });
    fireEvent.click(screen.getByLabelText('Reações'));
    fireEvent.click(screen.getByRole('img', { name: '❤️' }).closest('button'));
    await waitFor(() => {
      expect(onReact).toHaveBeenCalledWith('1', 'heart');
      expect(storiesService.reactToStory).toHaveBeenCalledWith('1', 'heart');
    });
  });

  test('shows pause indicator on pointer hold', () => {
    renderStoryViewer();
    // Component uses className="story-content-area" not data-testid
    const contentArea = document.querySelector('.story-content-area');
    fireEvent.pointerDown(contentArea);
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(screen.getByText('Pausado')).toBeInTheDocument();
  });

  test('removes pause indicator on pointer up', () => {
    renderStoryViewer();
    const contentArea = document.querySelector('.story-content-area');
    fireEvent.pointerDown(contentArea);
    act(() => {
      jest.advanceTimersByTime(150);
    });
    fireEvent.pointerUp(contentArea);
    expect(screen.queryByText('Pausado')).not.toBeInTheDocument();
  });

  test('shows more menu for owner', () => {
    const ownerGroups = [
      {
        user_id: 1,
        user_name: 'Current User',
        user_avatar: 'current-avatar.jpg',
        stories: [
          {
            id: '1',
            media_url: 'story1.jpg',
            media_type: 'image',
            text_content: 'My story',
            created_at: new Date().toISOString(),
            views_count: 5,
            background_color: null,
          },
        ],
      },
    ];
    renderStoryViewer({ storyGroups: ownerGroups });
    fireEvent.click(screen.getByLabelText('Mais opções'));
    expect(screen.getByText('Ver visualizações')).toBeInTheDocument();
    expect(screen.getByText('Copiar link')).toBeInTheDocument();
    expect(screen.getByText('Excluir história')).toBeInTheDocument();
    expect(screen.getByText('Denunciar')).toBeInTheDocument();
  });

  test('does not show more menu for non-owner', () => {
    renderStoryViewer();
    expect(screen.queryByLabelText('Mais opções')).not.toBeInTheDocument();
  });

  test('opens viewer list on "Ver visualizações" click', async () => {
    // Use fake timers but flush microtasks to allow promise resolution
    const mockViewers = [
      { id: 2, name: 'Maria Silva', avatar: null, username: 'maria.silva', viewed_at: new Date().toISOString() },
    ];
    storiesService.getStoryViewers.mockResolvedValue(mockViewers);

    const ownerGroups = [
      {
        user_id: 1,
        user_name: 'Current User',
        user_avatar: 'current-avatar.jpg',
        stories: [
          {
            id: '1',
            media_url: 'story1.jpg',
            media_type: 'image',
            text_content: 'My story',
            created_at: new Date().toISOString(),
            views_count: 5,
            background_color: null,
          },
        ],
      },
    ];
    renderStoryViewer({ storyGroups: ownerGroups });
    // Open more menu
    fireEvent.click(screen.getByLabelText('Mais opções'));
    // Wait for menu to appear and click viewer list
    await waitFor(() => {
      expect(screen.getByText('Ver visualizações')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Ver visualizações'));
    // Flush microtasks to resolve the promise in loadViewers
    await act(async () => {
      jest.runAllTimers();
    });
    // Check for modal content - use more specific selectors
    expect(screen.getByText('Visualizações')).toBeInTheDocument();
    // Maria Silva appears in both Avatar and viewer list - check viewer list item
    const viewerItem = document.querySelector('.viewer-item');
    expect(viewerItem).toBeInTheDocument();
    expect(viewerItem).toHaveTextContent('Maria Silva');
  });

  test('confirms deletion before deleting', () => {
    const ownerGroups = [
      {
        user_id: 1,
        user_name: 'Current User',
        user_avatar: 'current-avatar.jpg',
        stories: [
          {
            id: '1',
            media_url: 'story1.jpg',
            media_type: 'image',
            text_content: 'My story',
            created_at: new Date().toISOString(),
            views_count: 5,
            background_color: null,
          },
        ],
      },
    ];
    renderStoryViewer({ storyGroups: ownerGroups });
    fireEvent.click(screen.getByLabelText('Mais opções'));
    fireEvent.click(screen.getByText('Excluir história'));
    // Modal title is an h3 with id="delete-title" - use role heading
    expect(screen.getByRole('heading', { level: 3, name: 'Excluir história' })).toBeInTheDocument();
    expect(screen.getByText('Esta ação não pode ser desfeita. Tem certeza?')).toBeInTheDocument();
  });

  test('closes on invalid story groups (defensive guard)', () => {
    const onClose = jest.fn();
    renderStoryViewer({ storyGroups: [], onClose });
    // Should call onClose due to useEffect guard
    expect(onClose).toHaveBeenCalled();
  });

  test('closes on invalid initialGroupIndex (defensive guard)', () => {
    const onClose = jest.fn();
    renderStoryViewer({ storyGroups: mockStoryGroups, initialGroupIndex: 10, onClose });
    expect(onClose).toHaveBeenCalled();
  });

  test('renders video story correctly', () => {
    const videoGroups = [
      {
        user_id: 2,
        user_name: 'Maria Silva',
        user_avatar: 'maria.jpg',
        stories: [
          {
            id: '1',
            media_url: 'video.mp4',
            media_type: 'video',
            text_content: '',
            created_at: new Date().toISOString(),
            views_count: 0,
            background_color: null,
          },
        ],
      },
    ];
    renderStoryViewer({ storyGroups: videoGroups });
    // Video stories render as img tag with video src in this implementation
    expect(screen.getByAltText('Story')).toHaveAttribute('src', 'video.mp4');
  });
});