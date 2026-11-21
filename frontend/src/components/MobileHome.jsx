import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';
import MobileFeed from './MobileFeed';
import MobileStories from './MobileStories';
import StoryViewer from './StoryViewer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MobileHome = () => {
  const { socket } = useContext(SocketContext);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedType] = useState('algo');

  const [storyGroups, setStoryGroups] = useState([]);
  const [viewingStoryIndex, setViewingStoryIndex] = useState(null);

  const prevPostsRef = useRef(posts);
  const prevStoryGroupsRef = useRef(storyGroups);

  const fetchPosts = useCallback(async (pageNum, currentFeedType) => {
    const isInitial = pageNum === 1;
    if (isInitial) setLoadingMore(true);

    try {
      const res = await fetch(`${API_URL}/api/posts?page=${pageNum}&limit=10&sort=${currentFeedType}`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          setHasMore(false);
          if (isInitial) setPosts([]);
        } else {
          setPosts(prev => isInitial ? data : [...prev, ...data]);
          if (data.length < 10) setHasMore(false);
        }
      }
    } catch (err) {
      console.log('Erro ao buscar posts', err);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (prevPostsRef.current !== posts) return;
    fetchPosts(page, feedType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, feedType, fetchPosts]);

  useEffect(() => {
    const refresh = () => {
      setPage(1);
      setHasMore(true);
      fetchPosts(1, feedType);
    };
    window.addEventListener('feed_refresh', refresh);
    return () => window.removeEventListener('feed_refresh', refresh);
  }, [feedType, fetchPosts]);

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/stories`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStoryGroups(data);
      }
    } catch (err) {
      console.log('Erro ao buscar stories', err);
    }
  }, []);

  useEffect(() => {
    if (prevStoryGroupsRef.current !== storyGroups) return;
    fetchStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStories]);

  // Update refs when state changes
  useEffect(() => {
    prevPostsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    prevStoryGroupsRef.current = storyGroups;
  }, [storyGroups]);

  // Listen for new stories via socket
  useEffect(() => {
    if (!socket) return;
    const handleNewStory = () => {
      fetchStories();
    };
    socket.on('new_story', handleNewStory);
    return () => socket.off('new_story', handleNewStory);
  }, [socket, fetchStories]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loadingMore, hasMore]);

  const handleRefresh = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    await fetchPosts(1, feedType);
  }, [feedType, fetchPosts]);

  const handleStoryClick = useCallback((group, index) => {
    setViewingStoryIndex(index);
  }, []);

  return (
    <div className="mobile-home">
      <MobileStories stories={storyGroups} onStoryClick={handleStoryClick} />

      {viewingStoryIndex !== null && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={viewingStoryIndex}
          onClose={() => setViewingStoryIndex(null)}
        />
      )}

      <MobileFeed
        posts={posts}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        isLoading={loadingMore}
        hasMore={hasMore}
      />
    </div>
  );
};

export default MobileHome;