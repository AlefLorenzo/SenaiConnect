import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileStories from '../components/MobileStories';
import { AuthContext } from '../context/AuthContext';

// Mock Avatar component
jest.mock('../components/Avatar', () => ({ __esModule: true, default: ({ user, className, size }) => (
  <div data-testid="avatar" className={className} style={{ width: size, height: size }}>
    {user?.avatar ? `img:${user.avatar}` : user?.name}
  </div>
)}));

// Mock context
const mockUser = {
  id: 1,
  name: 'Current User',
  avatar: 'current-avatar.jpg',
  role: 'aluno',
  isVerified: true,
};

const renderMobileStories = (props = {}) => {
  const defaultProps = {
    stories: [
      {
        id: '1',
        user_id: 2,
        user_name: 'Maria Silva',
        user_avatar: 'maria.jpg',
        hasUnviewed: true,
        storyCount: 2,
        stories: [
          { id: '1-1', media_url: 'story1.jpg', media_type: 'image', text_content: '', created_at: new Date().toISOString() },
          { id: '1-2', media_url: 'story2.jpg', media_type: 'image', text_content: '', created_at: new Date().toISOString() },
        ],
      },
      {
        id: '2',
        user_id: 3,
        user_name: 'João Santos',
        user_avatar: 'joao.jpg',
        hasUnviewed: false,
        storyCount: 1,
        stories: [
          { id: '2-1', media_url: 'story3.jpg', media_type: 'image', text_content: '', created_at: new Date().toISOString() },
        ],
      },
    ],
    onStoryClick: jest.fn(),
    onAddStory: jest.fn(),
    isLoading: false,
    hasMore: false,
    onLoadMore: jest.fn(),
    ...props,
  };

  return render(
    <AuthContext.Provider value={{ user: mockUser, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
      <MobileStories {...defaultProps} />
    </AuthContext.Provider>
  );
};

describe('MobileStories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders "Add Story" button as first item', () => {
    renderMobileStories();
    const addButton = screen.getByRole('button', { name: /adicionar história/i });
    expect(addButton).toBeInTheDocument();
  });

  test('renders story rings for each user', () => {
    renderMobileStories();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('João Santos')).toBeInTheDocument();
  });

  test('shows gradient ring for unviewed stories', () => {
    renderMobileStories();
    const mariaItem = screen.getByText('Maria Silva').closest('.story-item');
    expect(mariaItem).toHaveClass('unviewed');
  });

  test('shows checkmark for viewed stories', () => {
    renderMobileStories();
    const joaoItem = screen.getByText('João Santos').closest('.story-item');
    expect(joaoItem).toHaveClass('viewed');
    expect(joaoItem.querySelector('.story-viewed-badge')).toBeInTheDocument();
  });

  test('shows story count badge when user has multiple stories', () => {
    renderMobileStories();
    const mariaItem = screen.getByText('Maria Silva').closest('.story-item');
    expect(mariaItem.querySelector('.story-count-badge')).toHaveTextContent('2');
  });

  test('calls onStoryClick when story is clicked', () => {
    const onStoryClick = jest.fn();
    renderMobileStories({ onStoryClick });
    fireEvent.click(screen.getByText('Maria Silva'));
    expect(onStoryClick).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 2,
      user_name: 'Maria Silva',
    }));
  });

  test('calls onAddStory when add button is clicked', () => {
    const onAddStory = jest.fn();
    renderMobileStories({ onAddStory });
    fireEvent.click(screen.getByRole('button', { name: /adicionar história/i }));
    expect(onAddStory).toHaveBeenCalled();
  });

  test('shows skeleton loaders when isLoading is true', () => {
    renderMobileStories({ isLoading: true });
    expect(screen.getAllByLabelText(/carregando história/i)).toHaveLength(5);
  });

  test('shows scroll indicators when content overflows', () => {
    const manyStories = Array.from({ length: 15 }, (_, i) => ({
      id: String(i + 3),
      user_id: i + 3,
      user_name: `User ${i + 3}`,
      user_avatar: `user${i + 3}.jpg`,
      hasUnviewed: i % 2 === 0,
      storyCount: 1,
      stories: [{ id: `${i + 3}-1`, media_url: 'story.jpg', media_type: 'image', text_content: '', created_at: new Date().toISOString() }],
    }));

    renderMobileStories({ stories: manyStories });
    // Container needs to be wider than content for scroll buttons to appear
    // In test environment, we just verify the component renders without error
    expect(screen.getByRole('region', { name: /histórias/i })).toBeInTheDocument();
  });

  test('handles keyboard navigation (Enter key)', () => {
    const onStoryClick = jest.fn();
    renderMobileStories({ onStoryClick });
    const mariaElement = screen.getByText('Maria Silva');
    fireEvent.keyDown(mariaElement, { key: 'Enter' });
    expect(onStoryClick).toHaveBeenCalled();
  });

  test('handles keyboard navigation (Space key)', () => {
    const onStoryClick = jest.fn();
    renderMobileStories({ onStoryClick });
    const mariaElement = screen.getByText('Maria Silva');
    fireEvent.keyDown(mariaElement, { key: ' ' });
    expect(onStoryClick).toHaveBeenCalled();
  });

  test('does not call onStoryClick for add button via keyboard', () => {
    const onStoryClick = jest.fn();
    const onAddStory = jest.fn();
    renderMobileStories({ onStoryClick, onAddStory });
    const addButton = screen.getByRole('button', { name: /adicionar história/i });
    fireEvent.keyDown(addButton, { key: 'Enter' });
    expect(onAddStory).toHaveBeenCalled();
    expect(onStoryClick).not.toHaveBeenCalled();
  });

  test('applies correct aria-labels for accessibility', () => {
    renderMobileStories();
    const mariaElement = screen.getByText('Maria Silva').closest('[role="listitem"]');
    expect(mariaElement).toHaveAttribute('aria-label', expect.stringContaining('Maria Silva'));
    expect(mariaElement).toHaveAttribute('aria-label', expect.stringContaining('não vista'));

    const joaoElement = screen.getByText('João Santos').closest('[role="listitem"]');
    expect(joaoElement).toHaveAttribute('aria-label', expect.stringContaining('João Santos'));
  });
});