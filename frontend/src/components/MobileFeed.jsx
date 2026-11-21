import { useState, useEffect, useCallback, useRef } from 'react';
import Post from './Post';
import CreatePostCard from './CreatePostCard';
import './MobileFeed.css';

const MobileFeed = ({ posts = [], onLoadMore, onRefresh, isLoading = false, hasMore = true }) => {
  const [feedPosts, setFeedPosts] = useState(posts);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const prevPostsRef = useRef(posts);
  const pullStartY = useRef(0);
  const feedRef = useRef(null);

  // Update feed posts when props change
  useEffect(() => {
    if (prevPostsRef.current !== posts) {
      prevPostsRef.current = posts;
      setFeedPosts(posts);
    }
  }, [posts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoading && onLoadMore) {
          onLoadMore();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, onLoadMore]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Pull to refresh handlers
  const handleTouchStart = useCallback((e) => {
    if (refreshing || !onRefresh) return;
    // Only allow pull to refresh when at top of feed
    const feed = feedRef.current;
    if (feed && feed.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [refreshing, onRefresh]);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - pullStartY.current;
    if (delta > 0) {
      e.preventDefault(); // Prevent scroll
      const distance = Math.min(delta * 0.5, 80); // Resistance
      setPullDistance(distance);
    }
  }, [isPulling, refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling || refreshing) return;
    setIsPulling(false);
    if (pullDistance > 60) {
      handleRefresh();
    }
    setPullDistance(0);
  }, [isPulling, refreshing, pullDistance, handleRefresh]);

  const handlePostDeleted = useCallback((postId) => {
    setFeedPosts(prev => prev.filter(post => post.id !== postId));
  }, []);

  const handleFeedRefresh = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  // Listen for feed refresh events
  useEffect(() => {
    window.addEventListener('feed_refresh', handleFeedRefresh);
    return () => window.removeEventListener('feed_refresh', handleFeedRefresh);
  }, [handleFeedRefresh]);

  if (feedPosts.length === 0 && !isLoading) {
    return (
      <div className="mobile-feed-empty" role="status">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          <h3>Nenhuma publicação ainda</h3>
          <p>Seja o primeiro a criar uma publicação!</p>
        </div>
      </div>
    );
  }

  const pullIndicatorStyle = {
    transform: `translateY(${pullDistance - 48}px)`,
    opacity: isPulling ? Math.min(pullDistance / 60, 1) : 0,
    pointerEvents: 'none',
  };

  const refreshingStyle = {
    transform: 'translateY(0)',
    opacity: 1,
  };

  return (
    <div
      ref={feedRef}
      className="mobile-feed"
      role="feed"
      aria-label="Feed de publicações"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div
        className="pull-refresh-indicator"
        aria-live="polite"
        style={refreshing ? refreshingStyle : pullIndicatorStyle}
      >
        <div className="spinner" aria-hidden="true"></div>
        <span>{refreshing ? 'Atualizando...' : isPulling && pullDistance > 30 ? 'Solte para atualizar' : 'Puxe para atualizar'}</span>
      </div>

      {/* Create Post Card at top */}
      <CreatePostCard className="mobile-create-post" />

      {/* Posts List - No card wrappers, full width */}
      <div className="mobile-posts-list">
        {feedPosts.map((post, index) => (
          <div key={post.id} className="mobile-post-wrapper">
            {post.is_sponsored && (
              <div className="sponsored-separator" aria-hidden="true"></div>
            )}
            <article className="mobile-post-item" data-post-id={post.id}>
              <Post post={post} onDeleted={handlePostDeleted} isMobile={true} />
            </article>

            {/* Discrete separator between posts (not after last) */}
            {index < feedPosts.length - 1 && (
              <div className="post-separator" aria-hidden="true"></div>
            )}
          </div>
        ))}

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="load-more-trigger" aria-hidden="true">
          {isLoading && hasMore && (
            <div className="load-more-spinner" aria-label="Carregando mais publicações">
              <div className="spinner"></div>
            </div>
          )}
          {!hasMore && feedPosts.length > 0 && (
            <div className="end-of-feed" aria-label="Fim do feed">
              <span>Você viu todas as publicações</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileFeed;