import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import Avatar from './Avatar';
import './MobileStories.css';

const MobileStories = ({ stories = [], onStoryClick, onAddStory, isLoading = false, hasMore = false, onLoadMore }) => {
  const { user } = useContext(AuthContext);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const storiesRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Build display stories: always include "Add Story" button first, then real stories from API
  const displayStories = useMemo(() => [
    { id: 'add', user_id: user?.id, user_name: 'Sua história', user_avatar: user?.avatar, isAdd: true, hasUnviewed: false },
    ...stories
  ], [stories, user]);

  const handleScroll = useCallback((e) => {
    setScrollPosition(e.target.scrollLeft);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);

      // Check if we need to load more (near end of scroll)
      const { scrollLeft, scrollWidth: sw, clientWidth } = e.target;
      if (onLoadMore && hasMore && scrollLeft + clientWidth >= sw - 100) {
        onLoadMore();
      }
    }, 150);
  }, [onLoadMore, hasMore]);

  const scrollLeft = useCallback(() => {
    if (storiesRef.current) {
      storiesRef.current.scrollBy({ left: -80, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (storiesRef.current) {
      storiesRef.current.scrollBy({ left: 80, behavior: 'smooth' });
    }
  }, []);

  const handleStoryClick = useCallback((story) => {
    console.log('[MobileStories] handleStoryClick called, story:', story);
    if (story.isAdd) {
      console.log('[MobileStories] Calling onAddStory');
      onAddStory?.();
    } else if (onStoryClick) {
      onStoryClick(story);
    }
  }, [onAddStory, onStoryClick]);

  const handleKeyDown = useCallback((e, story) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStoryClick(story);
    }
  }, [handleStoryClick]);

  // Update dimensions on mount and when stories change
  useEffect(() => {
    const container = storiesRef.current;
    if (container) {
      setContainerWidth(container.clientWidth);
      setScrollWidth(container.scrollWidth);
    }
  }, [stories]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // WhatsApp-style status: green for unseen, grey for seen, segmented when mixed.
  const getStoryViewState = useCallback((story) => {
    const items = Array.isArray(story.stories) ? story.stories : [];
    const hasExplicitReadState = items.some((item) => typeof item.viewed === 'boolean');

    if (!items.length || !hasExplicitReadState) {
      return story.hasUnviewed ? 'unviewed' : 'viewed';
    }

    const viewed = items.map((item) => item.viewed === true);
    if (viewed.every(Boolean)) return 'viewed';
    if (viewed.some(Boolean)) return 'mixed';
    return 'unviewed';
  }, []);

  const getStoryRingBackground = useCallback((story) => {
    const items = Array.isArray(story.stories) ? story.stories : [];
    const hasExplicitReadState = items.some((item) => typeof item.viewed === 'boolean');

    if (!items.length || !hasExplicitReadState) {
      return story.hasUnviewed ? '#25D366' : '#89969F';
    }

    const viewed = items.map((item) => item.viewed === true);
    if (viewed.every(Boolean)) return '#89969F';
    if (viewed.every((isViewed) => !isViewed)) return '#25D366';

    const segmentSize = 360 / viewed.length;
    const gap = Math.min(5, segmentSize * 0.12);
    const stops = viewed.flatMap((isViewed, index) => {
      const start = index * segmentSize;
      const end = (index + 1) * segmentSize;
      const colorEnd = end - gap;
      const color = isViewed ? '#89969F' : '#25D366';
      return [
        `${color} ${start}deg ${colorEnd}deg`,
        `transparent ${colorEnd}deg ${end}deg`,
      ];
    });

    return `conic-gradient(${stops.join(', ')})`;
  }, []);

  const canScrollRight = scrollPosition < scrollWidth - containerWidth - 10;
  const canScrollLeft = scrollPosition > 10;

  // Render skeleton loader for loading state
  const renderSkeleton = (index) => (
    <div key={`skeleton-${index}`} className="story-item skeleton" role="listitem" aria-label="Carregando história">
      <div className="story-ring-container">
        <div className="story-avatar skeleton-avatar" />
        <div className="story-status-ring skeleton-ring" aria-hidden="true" />
      </div>
      <span className="story-username skeleton-text" />
    </div>
  );

  return (
    <>
      <div className="mobile-stories" role="region" aria-label="Histórias" aria-busy={isLoading}>
        <div className="mobile-stories-container">
          {/* Left scroll indicator */}
          {canScrollLeft && (
            <button
              className="stories-scroll-btn stories-scroll-left"
              onClick={scrollLeft}
              aria-label="Rolar histórias para a esquerda"
              disabled={isScrolling}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          <div
            className="mobile-stories-list"
            ref={storiesRef}
            onScroll={handleScroll}
            role="list"
            aria-label="Lista de histórias"
            aria-busy={isLoading}
          >
            {isLoading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 5 }, (_, i) => renderSkeleton(i))
            ) : (
              displayStories.map((story, index) => (
                <div
                  key={story.id ?? `story-${index}`}
                  className={`story-item ${story.isAdd ? 'add' : getStoryViewState(story)} ${isScrolling ? 'scrolling' : ''}`}
                  role="listitem"
                  onClick={() => handleStoryClick(story)}
                  onKeyDown={(e) => handleKeyDown(e, story)}
                  tabIndex={0}
                  style={{
                    '--story-ring-background': getStoryRingBackground(story),
                    '--has-unviewed': story.hasUnviewed ? '1' : '0'
                  }}
                  aria-label={story.isAdd ? 'Adicionar história' : `${story.user_name}, ${getStoryViewState(story) === 'unviewed' ? 'status não visualizado' : getStoryViewState(story) === 'viewed' ? 'status visualizado' : 'status parcialmente visualizado'}${story.storyCount ? `, ${story.storyCount} histórias` : ''}`}
                >
                  <div className="story-ring-container">
                    {story.isAdd ? (
                      <button
                        className="story-add-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStoryClick(story);
                        }}
                        aria-label="Adicionar história"
                        disabled={isLoading}
                      >
                        <Plus size={20} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <>
                        <Avatar
                          user={{ avatar: story.user_avatar, name: story.user_name }}
                          className="story-avatar"
                          size={64}
                        />
                        <div
                          className="story-status-ring"
                          data-view-state={getStoryViewState(story)}
                          aria-hidden="true"
                        />
                      </>
                    )}

                    {!story.isAdd && story.storyCount > 1 && (
                      <span className="story-count-badge" aria-label={`${story.storyCount} histórias`}>
                        {story.storyCount}
                      </span>
                    )}
                  </div>

                  <span className="story-username">{story.user_name}</span>

                  {!story.isAdd && (
                    <span className="sr-only">
                      {getStoryViewState(story) === 'unviewed'
                        ? 'Status não visualizado'
                        : getStoryViewState(story) === 'viewed'
                          ? 'Status visualizado'
                          : 'Status parcialmente visualizado'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right scroll indicator */}
          {canScrollRight && (
            <button
              className="stories-scroll-btn stories-scroll-right"
              onClick={scrollRight}
              aria-label="Rolar histórias para a direita"
              disabled={isScrolling}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Load more indicator */}
          {hasMore && !isLoading && (
            <div className="stories-load-more" role="status" aria-label="Carregar mais histórias">
              <span className="load-more-text">Carregar mais</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileStories;