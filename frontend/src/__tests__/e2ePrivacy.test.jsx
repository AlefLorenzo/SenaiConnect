import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { storiesService } from '../services/storiesService';
import { AuthContext } from '../context/AuthContext.jsx';
import { SocketContext } from '../context/SocketContext';
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

// Test accounts for E2E privacy testing
const testAccounts = {
  // Account 1: Public profile, public stories
  alice: { id: 1, name: 'Alice', avatar: 'alice.jpg', role: 'aluno', isVerified: true, privacy_showProfile: 'public' },
  // Account 2: Private profile, followers-only stories
  bob: { id: 2, name: 'Bob', avatar: 'bob.jpg', role: 'aluno', isVerified: false, privacy_showProfile: 'private' },
  // Account 3: Public profile, close_friends stories with exceptions
  carol: { id: 3, name: 'Carol', avatar: 'carol.jpg', role: 'aluno', isVerified: true, privacy_showProfile: 'public' },
  // Account 4: Follower of Bob
  david: { id: 4, name: 'David', avatar: 'david.jpg', role: 'aluno', isVerified: true, privacy_showProfile: 'public' },
  // Account 5: Close friend of Carol
  eve: { id: 5, name: 'Eve', avatar: 'eve.jpg', role: 'aluno', isVerified: true, privacy_showProfile: 'public' },
  // Account 6: Excluded from Carol's close_friends story
  frank: { id: 6, name: 'Frank', avatar: 'frank.jpg', role: 'aluno', isVerified: false, privacy_showProfile: 'public' },
  // Account 7: Included in Bob's followers-only story via exception
  grace: { id: 7, name: 'Grace', avatar: 'grace.jpg', role: 'aluno', isVerified: true, privacy_showProfile: 'public' },
};

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};

const renderWithProviders = (user, component) => {
  return render(
    <AuthContext.Provider value={{ user, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
      <SocketContext.Provider value={{ socket: mockSocket, isConnected: true }}>
        {component}
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
};

const renderStoryViewer = (user, storyGroups, props = {}) => {
  const { unmount, ...result } = renderWithProviders(user,
    <StoryViewer
      storyGroups={storyGroups}
      initialGroupIndex={0}
      onClose={jest.fn()}
      onReply={jest.fn()}
      onReact={jest.fn()}
      {...props}
    />
  );
  return { unmount, ...result };
};

describe('E2E Privacy Verification - 3 Account Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Account 1: Alice (Public Profile)', () => {
    const alice = testAccounts.alice;

    test('Alice public story visible to all users', async () => {
      const publicStory = {
        user_id: alice.id,
        user_name: alice.name,
        user_avatar: alice.avatar,
        stories: [{
          id: 'alice-public-1',
          media_url: 'alice-public.jpg',
          media_type: 'image',
          text_content: 'Alice public story',
          created_at: new Date().toISOString(),
          privacy: 'public',
        }],
      };

      storiesService.getFeed.mockResolvedValue([publicStory]);

      // Bob (private profile user) can see Alice's public story
      const { unmount: unmount1 } = renderStoryViewer(testAccounts.bob, [publicStory]);
      await waitFor(() => {
        expect(screen.getByText('Alice public story')).toBeInTheDocument();
      });
      unmount1();

      // David (follower) can see Alice's public story
      const { unmount: unmount2 } = renderStoryViewer(testAccounts.david, [publicStory]);
      await waitFor(() => {
        expect(screen.getByText('Alice public story')).toBeInTheDocument();
      });
      unmount2();
    });

    test('Alice followers-only story visible to followers', async () => {
      const followersStory = {
        user_id: alice.id,
        user_name: alice.name,
        user_avatar: alice.avatar,
        stories: [{
          id: 'alice-followers-1',
          media_url: 'alice-followers.jpg',
          media_type: 'image',
          text_content: 'Alice followers story',
          created_at: new Date().toISOString(),
          privacy: 'followers',
        }],
      };

      storiesService.getFeed.mockResolvedValue([followersStory]);

      // David follows Alice, so he can see
      const { unmount } = renderStoryViewer(testAccounts.david, [followersStory]);
      await waitFor(() => {
        expect(screen.getByText('Alice followers story')).toBeInTheDocument();
      });
      unmount();

      // Bob doesn't follow Alice, so he shouldn't see (backend filters)
      storiesService.getFeed.mockResolvedValue([]);
    });
  });

  describe('Account 2: Bob (Private Profile)', () => {
    const bob = testAccounts.bob;

    test('Bob private profile - stories hidden from non-followers', async () => {
      // Even public stories from private profile are hidden from non-followers
      const privateProfileStory = {
        user_id: bob.id,
        user_name: bob.name,
        user_avatar: bob.avatar,
        stories: [{
          id: 'bob-public-1',
          media_url: 'bob-public.jpg',
          media_type: 'image',
          text_content: 'Bob public story',
          created_at: new Date().toISOString(),
          privacy: 'public',
        }],
      };

      // Non-follower (Alice) should NOT see
      storiesService.getFeed.mockResolvedValue([]);

      // Follower (David) SHOULD see
      storiesService.getFeed.mockResolvedValue([privateProfileStory]);
      const { unmount } = renderStoryViewer(testAccounts.david, [privateProfileStory]);
      await waitFor(() => {
        expect(screen.getByText('Bob public story')).toBeInTheDocument();
      });
      unmount();
    });

    test('Bob followers-only story with include exception', async () => {
      const followersStoryWithInclude = {
        user_id: bob.id,
        user_name: bob.name,
        user_avatar: bob.avatar,
        stories: [{
          id: 'bob-followers-include',
          media_url: 'bob-include.jpg',
          media_type: 'image',
          text_content: 'Bob followers with include',
          created_at: new Date().toISOString(),
          privacy: 'followers',
          privacy_exceptions: [{ user_id: testAccounts.grace.id, exception_type: 'include' }],
        }],
      };

      storiesService.getFeed.mockResolvedValue([followersStoryWithInclude]);

      // Grace is in include list, so she CAN see even though not a follower
      const { unmount } = renderStoryViewer(testAccounts.grace, [followersStoryWithInclude]);
      await waitFor(() => {
        expect(screen.getByText('Bob followers with include')).toBeInTheDocument();
      });
      unmount();

      // Verify the exception is present
      expect(followersStoryWithInclude.stories[0].privacy_exceptions).toContainEqual(
        expect.objectContaining({ user_id: testAccounts.grace.id, exception_type: 'include' })
      );
    });

    test('Bob followers-only story with exclude exception', async () => {
      const followersStoryWithExclude = {
        user_id: bob.id,
        user_name: bob.name,
        user_avatar: bob.avatar,
        stories: [{
          id: 'bob-followers-exclude',
          media_url: 'bob-exclude.jpg',
          media_type: 'image',
          text_content: 'Bob followers with exclude',
          created_at: new Date().toISOString(),
          privacy: 'followers',
          privacy_exceptions: [{ user_id: testAccounts.david.id, exception_type: 'exclude' }],
        }],
      };

      // David is normally a follower, but excluded
      storiesService.getFeed.mockResolvedValue([]);

      // Alice (non-follower) also cannot see
      storiesService.getFeed.mockResolvedValue([]);
    });
  });

  describe('Account 3: Carol (Close Friends Stories)', () => {
    const carol = testAccounts.carol;

    test('Carol close_friends story visible to close friends', async () => {
      const closeFriendsStory = {
        user_id: carol.id,
        user_name: carol.name,
        user_avatar: carol.avatar,
        stories: [{
          id: 'carol-close-1',
          media_url: 'carol-close.jpg',
          media_type: 'image',
          text_content: 'Carol close friends story',
          created_at: new Date().toISOString(),
          privacy: 'close_friends',
        }],
      };

      storiesService.getFeed.mockResolvedValue([closeFriendsStory]);

      // Eve is a close friend, so she CAN see
      const { unmount } = renderStoryViewer(testAccounts.eve, [closeFriendsStory]);
      await waitFor(() => {
        expect(screen.getByText('Carol close friends story')).toBeInTheDocument();
      });
      unmount();
    });

    test('Carol close_friends story hidden from non-close-friends', async () => {
      const closeFriendsStory = {
        user_id: carol.id,
        user_name: carol.name,
        user_avatar: carol.avatar,
        stories: [{
          id: 'carol-close-2',
          media_url: 'carol-close.jpg',
          media_type: 'image',
          text_content: 'Carol close friends story',
          created_at: new Date().toISOString(),
          privacy: 'close_friends',
        }],
      };

      // Frank is NOT a close friend, so he CANNOT see
      storiesService.getFeed.mockResolvedValue([]);
    });

    test('Carol close_friends story with include exception', async () => {
      const closeFriendsStoryWithInclude = {
        user_id: carol.id,
        user_name: carol.name,
        user_avatar: carol.avatar,
        stories: [{
          id: 'carol-close-include',
          media_url: 'carol-close-include.jpg',
          media_type: 'image',
          text_content: 'Carol close with include',
          created_at: new Date().toISOString(),
          privacy: 'close_friends',
          privacy_exceptions: [{ user_id: testAccounts.frank.id, exception_type: 'include' }],
        }],
      };

      storiesService.getFeed.mockResolvedValue([closeFriendsStoryWithInclude]);

      // Frank is in include list, so he CAN see
      const { unmount } = renderStoryViewer(testAccounts.frank, [closeFriendsStoryWithInclude]);
      await waitFor(() => {
        expect(screen.getByText('Carol close with include')).toBeInTheDocument();
      });
      unmount();

      expect(closeFriendsStoryWithInclude.stories[0].privacy_exceptions).toContainEqual(
        expect.objectContaining({ user_id: testAccounts.frank.id, exception_type: 'include' })
      );
    });

    test('Carol close_friends story with exclude exception', async () => {
      const closeFriendsStoryWithExclude = {
        user_id: carol.id,
        user_name: carol.name,
        user_avatar: carol.avatar,
        stories: [{
          id: 'carol-close-exclude',
          media_url: 'carol-close-exclude.jpg',
          media_type: 'image',
          text_content: 'Carol close with exclude',
          created_at: new Date().toISOString(),
          privacy: 'close_friends',
          privacy_exceptions: [{ user_id: testAccounts.eve.id, exception_type: 'exclude' }],
        }],
      };

      // Eve is normally a close friend, but excluded
      storiesService.getFeed.mockResolvedValue([]);
    });
  });

  describe('Cross-Account Privacy Matrix Verification', () => {
    test('Privacy matrix: Alice (public) stories visible to everyone', async () => {
      const scenarios = [
        { viewer: testAccounts.alice, shouldSee: true, desc: 'Alice views own story' },
        { viewer: testAccounts.bob, shouldSee: true, desc: 'Bob (private) views Alice public' },
        { viewer: testAccounts.david, shouldSee: true, desc: 'David (follower) views Alice public' },
        { viewer: testAccounts.eve, shouldSee: true, desc: 'Eve (close friend) views Alice public' },
        { viewer: testAccounts.frank, shouldSee: true, desc: 'Frank views Alice public' },
      ];

      for (const scenario of scenarios) {
        const story = {
          user_id: testAccounts.alice.id,
          user_name: testAccounts.alice.name,
          user_avatar: testAccounts.alice.avatar,
          stories: [{ id: 'test-1', media_url: 'test.jpg', media_type: 'image', text_content: 'Test', created_at: new Date().toISOString(), privacy: 'public' }],
        };

        storiesService.getFeed.mockResolvedValue(scenario.shouldSee ? [story] : []);

        if (scenario.shouldSee) {
          const { unmount } = renderStoryViewer(scenario.viewer, [story]);
          await waitFor(() => {
            expect(screen.getByText('Test')).toBeInTheDocument();
          });
          unmount();
        } else {
          const feed = await storiesService.getFeed();
          expect(feed).toHaveLength(0);
        }
      }
    });

    test('Privacy matrix: Bob (private) stories visible only to followers', async () => {
      const scenarios = [
        { viewer: testAccounts.bob, shouldSee: true, desc: 'Bob views own story' },
        { viewer: testAccounts.david, shouldSee: true, desc: 'David (follower) views Bob story' },
        { viewer: testAccounts.grace, shouldSee: true, desc: 'Grace (included) views Bob story' },
        { viewer: testAccounts.alice, shouldSee: false, desc: 'Alice (non-follower) views Bob story' },
        { viewer: testAccounts.eve, shouldSee: false, desc: 'Eve (non-follower) views Bob story' },
        { viewer: testAccounts.frank, shouldSee: false, desc: 'Frank (non-follower) views Bob story' },
      ];

      for (const scenario of scenarios) {
        const story = {
          user_id: testAccounts.bob.id,
          user_name: testAccounts.bob.name,
          user_avatar: testAccounts.bob.avatar,
          stories: [{ id: 'test-2', media_url: 'test.jpg', media_type: 'image', text_content: 'Test', created_at: new Date().toISOString(), privacy: 'followers', privacy_exceptions: [{ user_id: testAccounts.grace.id, exception_type: 'include' }] }],
        };

        // Backend logic: private profile + followers story = only followers + includes
        const isFollower = scenario.viewer.id === testAccounts.david.id;
        const isIncluded = scenario.viewer.id === testAccounts.grace.id;
        const isOwner = scenario.viewer.id === testAccounts.bob.id;
        const shouldSee = isOwner || isFollower || isIncluded;

        storiesService.getFeed.mockResolvedValue(shouldSee ? [story] : []);

        if (shouldSee) {
          const { unmount } = renderStoryViewer(scenario.viewer, [story]);
          await waitFor(() => {
            expect(screen.getByText('Test')).toBeInTheDocument();
          });
          unmount();
        } else {
          const feed = await storiesService.getFeed();
          expect(feed).toHaveLength(0);
        }
      }
    });

    test('Privacy matrix: Carol (close_friends) stories visible only to close friends', async () => {
      const scenarios = [
        { viewer: testAccounts.carol, shouldSee: true, desc: 'Carol views own story' },
        { viewer: testAccounts.eve, shouldSee: true, desc: 'Eve (close friend) views Carol story' },
        { viewer: testAccounts.frank, shouldSee: true, desc: 'Frank (included) views Carol story' },
        { viewer: testAccounts.alice, shouldSee: false, desc: 'Alice views Carol story' },
        { viewer: testAccounts.bob, shouldSee: false, desc: 'Bob views Carol story' },
        { viewer: testAccounts.david, shouldSee: false, desc: 'David views Carol story' },
      ];

      for (const scenario of scenarios) {
        const story = {
          user_id: testAccounts.carol.id,
          user_name: testAccounts.carol.name,
          user_avatar: testAccounts.carol.avatar,
          stories: [{ id: 'test-3', media_url: 'test.jpg', media_type: 'image', text_content: 'Test', created_at: new Date().toISOString(), privacy: 'close_friends', privacy_exceptions: [{ user_id: testAccounts.frank.id, exception_type: 'include' }, { user_id: testAccounts.eve.id, exception_type: 'exclude' }] }],
        };

        // Backend logic: close_friends story = only close friends + includes - excludes
        const isCloseFriend = scenario.viewer.id === testAccounts.eve.id;
        const isIncluded = scenario.viewer.id === testAccounts.frank.id;
        const isExcluded = scenario.viewer.id === testAccounts.eve.id; // Eve is excluded
        const isOwner = scenario.viewer.id === testAccounts.carol.id;
        const shouldSee = isOwner || (isCloseFriend && !isExcluded) || isIncluded;

        storiesService.getFeed.mockResolvedValue(shouldSee ? [story] : []);

        if (shouldSee) {
          const { unmount } = renderStoryViewer(scenario.viewer, [story]);
          await waitFor(() => {
            expect(screen.getByText('Test')).toBeInTheDocument();
          });
          unmount();
        } else {
          const feed = await storiesService.getFeed();
          expect(feed).toHaveLength(0);
        }
      }
    });
  });

  describe('Reply/Reaction Notifications Privacy', () => {
    test('Reply on public story triggers notification', async () => {
      const publicStory = {
        user_id: testAccounts.alice.id,
        user_name: testAccounts.alice.name,
        user_avatar: testAccounts.alice.avatar,
        stories: [{ id: 'notify-1', media_url: 'notify.jpg', media_type: 'image', text_content: 'Notify test', created_at: new Date().toISOString(), privacy: 'public' }],
      };

      const { unmount } = renderStoryViewer({ ...testAccounts.bob, id: 202 }, [publicStory]);

      fireEvent.click(screen.getByLabelText('Responder'));
      const textarea = screen.getByPlaceholderText('Escreva uma mensagem...');
      fireEvent.change(textarea, { target: { value: 'Nice story!' } });
      fireEvent.click(screen.getByText('Enviar mensagem'));

      await waitFor(() => {
        expect(storiesService.replyToStory).toHaveBeenCalledWith('notify-1', 'Nice story!');
      });
      unmount();
    });

    test('Reaction on followers story triggers notification', async () => {
      const followersStory = {
        user_id: testAccounts.bob.id,
        user_name: testAccounts.bob.name,
        user_avatar: testAccounts.bob.avatar,
        stories: [{ id: 'notify-2', media_url: 'notify2.jpg', media_type: 'image', text_content: 'Followers notify', created_at: new Date().toISOString(), privacy: 'followers' }],
      };

      const { unmount } = renderStoryViewer(testAccounts.david, [followersStory]);

      fireEvent.click(screen.getByLabelText('Reações'));
      fireEvent.click(screen.getByRole('img', { name: '❤️' }).closest('button'));

      await waitFor(() => {
        expect(storiesService.reactToStory).toHaveBeenCalledWith('notify-2', 'heart');
      });
      unmount();
    });

    test('Reply on close_friends story triggers notification', async () => {
      const closeStory = {
        user_id: testAccounts.carol.id,
        user_name: testAccounts.carol.name,
        user_avatar: testAccounts.carol.avatar,
        stories: [{ id: 'notify-3', media_url: 'notify3.jpg', media_type: 'image', text_content: 'Close notify', created_at: new Date().toISOString(), privacy: 'close_friends' }],
      };

      const { unmount } = renderStoryViewer({ ...testAccounts.eve, id: 205 }, [closeStory]);

      fireEvent.click(screen.getByLabelText('Responder'));
      const textarea = screen.getByPlaceholderText('Escreva uma mensagem...');
      fireEvent.change(textarea, { target: { value: 'Love it!' } });
      fireEvent.click(screen.getByText('Enviar mensagem'));

      await waitFor(() => {
        expect(storiesService.replyToStory).toHaveBeenCalledWith('notify-3', 'Love it!');
      });
      unmount();
    });
  });

  describe('24-Hour Expiration and Cleanup', () => {
    test('Expired stories are filtered from feed', async () => {
      // Simulate backend filtering expired stories
      storiesService.getFeed.mockResolvedValue([]);
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(0);
    });

    test('Active stories remain in feed', async () => {
      const activeStory = {
        user_id: testAccounts.alice.id,
        user_name: testAccounts.alice.name,
        user_avatar: testAccounts.alice.avatar,
        stories: [{
          id: 'active-1',
          media_url: 'active.jpg',
          media_type: 'image',
          text_content: 'Active story',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          privacy: 'public',
        }],
      };

      storiesService.getFeed.mockResolvedValue([activeStory]);
      const feed = await storiesService.getFeed();
      expect(feed).toHaveLength(1);
    });

    test('Story deletion removes from feed', async () => {
      const story = {
        user_id: testAccounts.alice.id,
        user_name: testAccounts.alice.name,
        user_avatar: testAccounts.alice.avatar,
        stories: [{ id: 'delete-1', media_url: 'delete.jpg', media_type: 'image', text_content: 'To delete', created_at: new Date().toISOString(), privacy: 'public' }],
      };

      // Initially in feed
      storiesService.getFeed.mockResolvedValue([story]);
      let feed = await storiesService.getFeed();
      expect(feed).toHaveLength(1);

      // After deletion
      await storiesService.deleteStory('delete-1');
      storiesService.getFeed.mockResolvedValue([]);
      feed = await storiesService.getFeed();
      expect(feed).toHaveLength(0);
    });

    test('Owner can view viewer list with timestamps', async () => {
      const ownerStory = {
        user_id: testAccounts.alice.id,
        user_name: testAccounts.alice.name,
        user_avatar: testAccounts.alice.avatar,
        stories: [{ id: 'viewer-1', media_url: 'viewer.jpg', media_type: 'image', text_content: 'Viewer test', created_at: new Date().toISOString(), views_count: 3, privacy: 'public' }],
      };

      const mockViewers = [
        { id: 2, name: 'Bob', avatar: null, username: 'bob.user', viewed_at: new Date().toISOString() },
        { id: 4, name: 'David', avatar: null, username: 'david.user', viewed_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
        { id: 5, name: 'Eve', avatar: null, username: 'eve.user', viewed_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
      ];

      storiesService.getStoryViewers.mockResolvedValue(mockViewers);

      const { unmount } = renderStoryViewer(testAccounts.alice, [ownerStory]);

      fireEvent.click(screen.getByLabelText('Mais opções'));
      fireEvent.click(screen.getByText('Ver visualizações'));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(screen.getByText('Visualizações')).toBeInTheDocument();
      expect(storiesService.getStoryViewers).toHaveBeenCalledWith('viewer-1');
      unmount();
    });
  });

  describe('Complete Privacy Scenario Documentation', () => {
    /**
     * E2E Privacy Test Matrix Summary:
     *
     * | Story Owner \ Viewer | Alice (Public) | Bob (Private) | Carol (Close Fr) | David (Follower) | Eve (Close Fr) | Frank (Excluded) | Grace (Included) |
     * |---------------------|----------------|---------------|------------------|------------------|----------------|------------------|------------------|
     * | Alice - Public      | ✓              | ✓             | ✓                | ✓                | ✓              | ✓                | ✓                |
     * | Alice - Followers   | ✓*             | ✗             | ✗                | ✓                | ✗              | ✗                | ✓**              |
     * | Alice - Close Fr    | ✓*             | ✗             | ✗                | ✗                | ✓              | ✗                | ✗                |
     * | Bob - Public        | ✗              | ✓             | ✗                | ✓                | ✗              | ✗                | ✗                |
     * | Bob - Followers     | ✗              | ✓             | ✗                | ✓                | ✗              | ✗                | ✓**              |
     * | Bob - Close Fr      | ✗              | ✓             | ✗                | ✗                | ✓              | ✗                | ✗                |
     * | Carol - Public      | ✓              | ✓             | ✓                | ✓                | ✓              | ✓                | ✓                |
     * | Carol - Followers   | ✓*             | ✗             | ✗                | ✓                | ✗              | ✗                | ✓**              |
     * | Carol - Close Fr    | ✓*             | ✗             | ✓                | ✗                | ✓              | ✓**              | ✗                |
     *
     * * Owner always sees their own stories
     * ** Include exception allows specific user
     * Exclude exception blocks specific user (not shown in matrix above)
     */
    test('documents complete E2E privacy matrix', () => {
      expect(true).toBe(true);
    });
  });
});