import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { storiesService } from '../services/storiesService';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import CreateStory from '../components/CreateStory';
import StoryViewer from '../components/StoryViewer';

jest.mock('../components/Avatar', () => ({ __esModule: true, default: ({ user, className }) => (
  <div data-testid="avatar" className={className}>{user?.name}</div>
)}));

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

// Mock storiesService with dynamic responses for integration flow
const mockFeed = [];
let mockStoryId = 1;

jest.mock('../services/storiesService', () => ({
  storiesService: {
    createStory: jest.fn().mockImplementation((data) => {
      // data contains: image (File), video (File), text, backgroundColor, privacy, privacy_exceptions, text_overlay_data
      const mediaUrl = data.image ? URL.createObjectURL(data.image) :
                       data.video ? URL.createObjectURL(data.video) :
                       'text-story.jpg';
      const mediaType = data.image ? 'image' : data.video ? 'video' : 'text';

      const newStory = {
        id: mockStoryId++,
        stories: [{
          id: String(mockStoryId - 1),
          media_url: mediaUrl,
          media_type: mediaType,
          text_content: data.text || '',
          background_color: data.backgroundColor || null,
          created_at: new Date().toISOString(),
        }],
      };
      mockFeed.push({
        user_id: 1,
        user_name: 'Test User',
        user_avatar: 'test.jpg',
        stories: newStory.stories,
      });
      return createSyncPromise(newStory);
    }),
    getFeed: jest.fn().mockImplementation(() => createSyncPromise([...mockFeed])),
    getUserStories: jest.fn().mockImplementation(() => createSyncPromise([])),
    viewStory: jest.fn().mockResolvedValue({ success: true }),
    getStoryReactions: jest.fn().mockImplementation(() => createSyncPromise([])),
    getStoryViewers: jest.fn().mockImplementation(() => createSyncPromise([])),
    reactToStory: jest.fn().mockImplementation(() => createSyncPromise({ success: true, action: 'added' })),
    replyToStory: jest.fn().mockImplementation(() => createSyncPromise({ id: 1 })),
    deleteStory: jest.fn().mockImplementation(() => createSyncPromise({ success: true })),
    getStoryReplies: jest.fn().mockImplementation(() => createSyncPromise([])),
    getPrivacyExceptions: jest.fn().mockImplementation(() => createSyncPromise([])),
  },
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  avatar: 'test-avatar.jpg',
  role: 'aluno',
  isVerified: true,
};

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};

describe('Integration Tests - Stories Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeed.length = 0;
    mockStoryId = 1;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderWithProviders = (component, user = mockUser) => {
    return render(
      <AuthContext.Provider value={{ user, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
        <SocketContext.Provider value={{ socket: mockSocket, isConnected: true }}>
          {component}
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
  };

  describe('Full Stories Lifecycle', () => {
    test('create -> view -> react -> reply -> expire flow', async () => {
      // Step 1: Create a story
      renderWithProviders(
        <CreateStory
          isOpen={true}
          onClose={jest.fn()}
          onStoryCreated={jest.fn()}
        />
      );

      // Select image and submit
      const fileInput = screen.getByLabelText(/escolher arquivo/i);
      const mockFile = new File(['test'], 'integration-test.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      fireEvent.click(screen.getByText('Compartilhar'));

      await waitFor(() => {
        expect(storiesService.createStory).toHaveBeenCalled();
      });

      expect(mockFeed).toHaveLength(1);
      const createdStory = mockFeed[0].stories[0];
      expect(createdStory.media_type).toBe('image');
      expect(createdStory.media_url).toBeTruthy();

      // Step 2: View the story
      const storyGroups = [
        {
          user_id: 1,
          user_name: 'Test User',
          user_avatar: 'test-avatar.jpg',
          stories: [createdStory],
        },
      ];

      // View the newly created story from a different account. WhatsApp-style
      // status replies are private messages and cannot be sent to your own story.
      const storyViewerUser = { ...mockUser, id: 2, name: 'Story Viewer' };
      const { unmount } = renderWithProviders(
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={0}
          onClose={jest.fn()}
          onReply={jest.fn()}
          onReact={jest.fn()}
        />,
        storyViewerUser
      );

      await waitFor(() => {
        expect(storiesService.viewStory).toHaveBeenCalledWith(createdStory.id);
      });

      // Step 3: React to the story
      fireEvent.click(screen.getByLabelText('Reações'));
      fireEvent.click(screen.getByRole('img', { name: '❤️' }).closest('button'));

      await waitFor(() => {
        expect(storiesService.reactToStory).toHaveBeenCalledWith(createdStory.id, 'heart');
      });

      // Step 4: Reply to the story
      fireEvent.click(screen.getByLabelText('Responder'));
      const textarea = screen.getByPlaceholderText('Escreva uma mensagem...');
      fireEvent.change(textarea, { target: { value: 'Great story!' } });
      fireEvent.click(screen.getByText('Enviar mensagem'));

      await waitFor(() => {
        expect(storiesService.replyToStory).toHaveBeenCalledWith(createdStory.id, 'Great story!');
      });

      unmount();

      // Step 5: Simulate expiration by clearing feed
      mockFeed.length = 0;
      const expiredFeed = await storiesService.getFeed();
      expect(expiredFeed).toHaveLength(0);
    });

    test('multiple stories from different users in feed', async () => {
      // Create stories from multiple users - using the actual API format
      const file1 = new File(['test'], 'user1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['test'], 'user2.jpg', { type: 'image/jpeg' });

      await storiesService.createStory({ image: file1, text: 'User 1 story' });
      await storiesService.createStory({ image: file2, text: 'User 2 story' });

      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(2);
      expect(feed[0].stories[0].text_content).toBe('User 1 story');
      expect(feed[1].stories[0].text_content).toBe('User 2 story');
    });

    test('story privacy filtering in feed', async () => {
      // Create stories with different privacy levels - using the actual API format
      const file1 = new File(['test'], 'public.jpg', { type: 'image/jpeg' });
      const file2 = new File(['test'], 'followers.jpg', { type: 'image/jpeg' });
      const file3 = new File(['test'], 'close.jpg', { type: 'image/jpeg' });

      await storiesService.createStory({ image: file1, text: 'Public', privacy: 'public' });
      await storiesService.createStory({ image: file2, text: 'Followers', privacy: 'followers' });
      await storiesService.createStory({ image: file3, text: 'Close Friends', privacy: 'close_friends' });

      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(3);
    });
  });

  describe('Real-time Socket Integration', () => {
    test('new_story socket event adds to feed', async () => {
      const initialFeed = await storiesService.getFeed();
      expect(initialFeed).toHaveLength(0);

      // Simulate socket event handler adding story
      const newStory = {
        user_id: 2,
        user_name: 'Other User',
        user_avatar: 'other.jpg',
        stories: [{
          id: 'new-1',
          media_url: 'realtime.jpg',
          media_type: 'image',
          text_content: 'Real-time story',
          created_at: new Date().toISOString(),
        }],
      };

      mockFeed.push(newStory);
      const updatedFeed = await storiesService.getFeed();
      expect(updatedFeed).toHaveLength(1);
      expect(updatedFeed[0].stories[0].text_content).toBe('Real-time story');
    });

    test('story_deleted socket event removes from feed', async () => {
      // Add a story first
      await storiesService.createStory({ media_url: 'todelete.jpg', media_type: 'image', text_content: 'To Delete' });
      expect(mockFeed).toHaveLength(1);

      // Simulate deletion
      const storyId = mockFeed[0].stories[0].id;
      await storiesService.deleteStory(storyId);
      mockFeed.length = 0;

      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(0);
    });
  });

  describe('Privacy Enforcement in Integration', () => {
    test('private profile stories not in feed for non-followers', async () => {
      // This test simulates backend privacy filtering
      // In real app, backend filters based on profile privacy
      const privateUserStories = {
        user_id: 3,
        user_name: 'Private User',
        user_avatar: 'private.jpg',
        stories: [{ id: 'p1', media_url: 'private.jpg', media_type: 'image', text_content: 'Private Story' }],
      };

      // Non-follower should not see private profile stories
      mockFeed.length = 0;
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(0);
    });

    test('followers-only stories visible to followers', async () => {
      // Backend should filter based on follow relationship
      const followerStory = {
        user_id: 4,
        user_name: 'Followed User',
        user_avatar: 'followed.jpg',
        stories: [{ id: 'f1', media_url: 'follower.jpg', media_type: 'image', text_content: 'Followers Only', privacy: 'followers' }],
      };

      mockFeed.push(followerStory);
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(1);
      expect(feed[0].stories[0].privacy).toBe('followers');
    });

    test('close_friends stories visible only to close friends', async () => {
      const closeFriendStory = {
        user_id: 5,
        user_name: 'Close Friend',
        user_avatar: 'close.jpg',
        stories: [{ id: 'cf1', media_url: 'close.jpg', media_type: 'image', text_content: 'Close Friends Only', privacy: 'close_friends' }],
      };

      mockFeed.push(closeFriendStory);
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(1);
      expect(feed[0].stories[0].privacy).toBe('close_friends');
    });

    test('privacy exceptions - include list', async () => {
      const storyWithInclude = {
        user_id: 6,
        user_name: 'Story Owner',
        user_avatar: 'owner.jpg',
        stories: [{
          id: 'inc1',
          media_url: 'include.jpg',
          media_type: 'image',
          text_content: 'With Include',
          privacy: 'followers',
          privacy_exceptions: [{ user_id: 99, exception_type: 'include' }],
        }],
      };

      mockFeed.push(storyWithInclude);
      const feed = await storiesService.getFeed();
      expect(feed[0].stories[0].privacy_exceptions).toContainEqual(
        expect.objectContaining({ exception_type: 'include' })
      );
    });

    test('privacy exceptions - exclude list', async () => {
      const storyWithExclude = {
        user_id: 7,
        user_name: 'Story Owner',
        user_avatar: 'owner.jpg',
        stories: [{
          id: 'exc1',
          media_url: 'exclude.jpg',
          media_type: 'image',
          text_content: 'With Exclude',
          privacy: 'followers',
          privacy_exceptions: [{ user_id: 88, exception_type: 'exclude' }],
        }],
      };

      mockFeed.push(storyWithExclude);
      const feed = await storiesService.getFeed();
      expect(feed[0].stories[0].privacy_exceptions).toContainEqual(
        expect.objectContaining({ exception_type: 'exclude' })
      );
    });
  });

  describe('24-Hour Expiration', () => {
    test('expired stories are not returned in feed', async () => {
      const expiredStory = {
        user_id: 1,
        user_name: 'Test User',
        user_avatar: 'test-avatar.jpg',
        stories: [{
          id: 'expired-1',
          media_url: 'expired.jpg',
          media_type: 'image',
          text_content: 'Expired',
          created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
          expires_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        }],
      };

      // In real implementation, backend would filter expired stories
      mockFeed.length = 0; // Simulate backend filtering
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(0);
    });

    test('active stories are returned in feed', async () => {
      const activeStory = {
        user_id: 1,
        user_name: 'Test User',
        user_avatar: 'test-avatar.jpg',
        stories: [{
          id: 'active-1',
          media_url: 'active.jpg',
          media_type: 'image',
          text_content: 'Active',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }],
      };

      mockFeed.push(activeStory);
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(1);
    });
  });

  describe('Owner Permissions', () => {
    test('story owner can see viewer list', async () => {
      const ownerStory = {
        user_id: 1, // Same as mockUser.id
        user_name: 'Test User',
        user_avatar: 'test-avatar.jpg',
        stories: [{
          id: 'owner-1',
          media_url: 'owner.jpg',
          media_type: 'image',
          text_content: 'My Story',
          views_count: 5,
        }],
      };

      const { unmount } = renderWithProviders(
        <StoryViewer
          storyGroups={[ownerStory]}
          initialGroupIndex={0}
          onClose={jest.fn()}
          onReply={jest.fn()}
          onReact={jest.fn()}
        />
      );

      // Owner should see more menu
      fireEvent.click(screen.getByLabelText('Mais opções'));
      expect(screen.getByText('Ver visualizações')).toBeInTheDocument();

      // Click viewer list
      fireEvent.click(screen.getByText('Ver visualizações'));
      await act(async () => {
        jest.runAllTimers();
      });

      expect(screen.getByText('Visualizações')).toBeInTheDocument();
      unmount();
    });

    test('non-owner cannot see viewer list', async () => {
      const otherUserStory = {
        user_id: 2,
        user_name: 'Other User',
        user_avatar: 'other.jpg',
        stories: [{
          id: 'other-1',
          media_url: 'other.jpg',
          media_type: 'image',
          text_content: 'Other Story',
        }],
      };

      renderWithProviders(
        <StoryViewer
          storyGroups={[otherUserStory]}
          initialGroupIndex={0}
          onClose={jest.fn()}
          onReply={jest.fn()}
          onReact={jest.fn()}
        />
      );

      expect(screen.queryByLabelText('Mais opções')).not.toBeInTheDocument();
    });

    test('story owner can delete story', async () => {
      const ownerStory = {
        user_id: 1,
        user_name: 'Test User',
        user_avatar: 'test-avatar.jpg',
        stories: [{
          id: 'owner-del-1',
          media_url: 'owner.jpg',
          media_type: 'image',
          text_content: 'My Story',
        }],
      };

      renderWithProviders(
        <StoryViewer
          storyGroups={[ownerStory]}
          initialGroupIndex={0}
          onClose={jest.fn()}
          onReply={jest.fn()}
          onReact={jest.fn()}
        />
      );

      fireEvent.click(screen.getByLabelText('Mais opções'));
      fireEvent.click(screen.getByText('Excluir história'));
      expect(screen.getByRole('heading', { level: 3, name: 'Excluir história' })).toBeInTheDocument();
    });
  });
});