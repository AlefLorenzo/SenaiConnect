import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/useSocket';
import { activityService } from '../../services/activityService';
import ActivityItem from './ActivityItem';
import ActivitySection from './ActivitySection';
import FilterTabs from './FilterTabs';
import './ActivityCenter.css';

/**
 * Activity Center - Central de Atividades
 * Instagram-like UX with chronological sections, filters, grouping, and real-time updates
 */
const ActivityCenter = () => {
  const navigate = useNavigate();
  const { socket, registerEventHandler, isConnected } = useSocket();

  // State
  const [sections, setSections] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(null);
  const [showMarkAllRead, setShowMarkAllRead] = useState(false);

  // Refs
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const mountedRef = useRef(true);
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(async (reset = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      if (reset) {
        offsetRef.current = 0;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const data = await activityService.getActivities({
        filter: activeFilter,
        limit: 50,
        offset: offsetRef.current,
        group: true
      });

      if (!mountedRef.current) return;

      if (reset) {
        setSections(data.sections || []);
      } else if (data.sections && data.sections.length > 0) {
        // Merge new sections with existing ones
        setSections(prev => {
          const newSections = [...prev];
          data.sections.forEach(newSection => {
            const existingIdx = newSections.findIndex(s => s.title === newSection.title);
            if (existingIdx >= 0) {
              newSections[existingIdx] = {
                ...newSections[existingIdx],
                activities: [...newSections[existingIdx].activities, ...newSection.activities]
              };
            } else {
              newSections.push(newSection);
            }
          });
          // Sort sections chronologically
          return newSections.sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
        });
      }

      offsetRef.current += data.limit || 50;
      setHasMore(data.hasMore || false);
      isLoadingRef.current = false;
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Error fetching activities:', err);
      setError(err.message || 'Erro ao carregar atividades');
      isLoadingRef.current = false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeFilter]);

  /**
   * Load more activities (pagination)
   */
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !isLoadingRef.current) {
      fetchActivities(false);
    }
  }, [loadingMore, hasMore, fetchActivities]);

  /**
   * Setup Intersection Observer for infinite scroll
   */
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loadingMore && !isLoadingRef.current) {
        loadMore();
      }
    }, { rootMargin: '200px', threshold: 0 });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loadMore]);

  /**
   * Fetch unread count
   */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await activityService.getUnreadCount();
      if (mountedRef.current) {
        setUnreadCount(data.count || 0);
        setShowMarkAllRead(data.count > 0);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, []);

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter);
  }, []);

  /**
   * Handle real-time notification
   */
  const handleNewNotification = useCallback((notification) => {
    if (!mountedRef.current) return;

    // Add to the top of Today section
    setSections(prev => {
      const newSections = [...prev];
      let todaySection = newSections.find(s => s.title === 'Hoje');

      if (!todaySection) {
        todaySection = {
          title: 'Hoje',
          date: new Date().toISOString().split('T')[0],
          latestDate: new Date().toISOString(),
          activities: []
        };
        newSections.unshift(todaySection);
      }

      // Check if already exists (prevent duplicates)
      const exists = todaySection.activities.some(a => a.id === notification.id);
      if (!exists) {
        todaySection.activities = [notification, ...todaySection.activities];
        todaySection.latestDate = new Date().toISOString();
      }

      setShowMarkAllRead(true);
      setUnreadCount(prev => prev + 1);

      return newSections;
    });
  }, []);

  /**
   * Handle activity read
   */
  const handleActivityRead = useCallback(async (activityId) => {
    try {
      await activityService.markAsRead(activityId);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setShowMarkAllRead(prev => prev > 1);

      // Update local state
      setSections(prev => prev.map(section => ({
        ...section,
        activities: section.activities.map(activity =>
          activity.id === activityId ? { ...activity, read: true, read_at: new Date().toISOString() } : activity
        )
      })));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, []);

  /**
   * Handle mark all as read
   */
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await activityService.markAllAsRead(activeFilter);
      setUnreadCount(0);
      setShowMarkAllRead(false);

      setSections(prev => prev.map(section => ({
        ...section,
        activities: section.activities.map(activity => ({
          ...activity,
          read: true,
          read_at: new Date().toISOString()
        }))
      })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [activeFilter]);

  /**
   * Handle activity click (navigate to content)
   */
  const handleActivityClick = useCallback((activity) => {
    if (activity.read_at) return; // Already read, still navigate

    // Mark as read on click
    if (!activity.read) {
      handleActivityRead(activity.id);
    }

    // Navigate based on activity type
    const metadata = activity.metadata || {};
    const action = metadata.action;

    switch (action) {
      case 'follow':
      case 'follow_accepted':
        if (metadata.user_id) {
          navigate(`/profile/${metadata.user_id}`);
        }
        break;
      case 'post_like':
      case 'post_comment':
      case 'comment':
      case 'comment_reply':
      case 'comment_mention':
        if (metadata.post_id) {
          navigate(`/post/${metadata.post_id}`);
        }
        break;
      case 'mention':
      case 'story_mention':
        if (metadata.post_id) {
          navigate(`/post/${metadata.post_id}`);
        } else if (metadata.story_id) {
          navigate(`/stories/${metadata.user_id}`);
        }
        break;
      case 'story_reaction':
      case 'story_reply':
      case 'story_view':
        if (metadata.story_id && metadata.user_id) {
          navigate(`/stories/${metadata.user_id}`);
        }
        break;
      case 'group_invite':
      case 'group_post':
        if (metadata.group_id) {
          navigate(`/groups/${metadata.group_id}`);
        }
        break;
      case 'event_reminder':
        if (metadata.event_id) {
          navigate(`/events/${metadata.event_id}`);
        }
        break;
      case 'notice':
        if (metadata.notice_id) {
          navigate(`/notices/${metadata.notice_id}`);
        }
        break;
      case 'message':
        if (metadata.conversation_id) {
          navigate(`/messages/${metadata.conversation_id}`);
        }
        break;
      default:
        // Default navigation based on reference_type
        if (activity.reference_type && activity.reference_id) {
          switch (activity.reference_type) {
            case 'user':
              navigate(`/profile/${activity.reference_id}`);
              break;
            case 'post':
              navigate(`/post/${activity.reference_id}`);
              break;
            case 'group':
              navigate(`/groups/${activity.reference_id}`);
              break;
            case 'event':
              navigate(`/events/${activity.reference_id}`);
              break;
            case 'notice':
              navigate(`/notices/${activity.reference_id}`);
              break;
            case 'conversation':
              navigate(`/messages/${activity.reference_id}`);
              break;
          }
        }
    }
  }, [navigate, handleActivityRead]);

  // Initial load
  useEffect(() => {
    fetchActivities(true);
    fetchUnreadCount();
  }, [fetchActivities, fetchUnreadCount]);

  // Reload when filter changes
  useEffect(() => {
    fetchActivities(true);
  }, [activeFilter, fetchActivities]);

  // Register real-time handler
  useEffect(() => {
    const unregister = registerEventHandler('new_notification', handleNewNotification);
    return unregister;
  }, [registerEventHandler, handleNewNotification]);

  // Render empty state
  if (loading && sections.length === 0) {
    return (
      <div className="activity-center loading">
        <div className="activity-center__loader">
          <div className="spinner"></div>
          <p>Carregando atividades...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && sections.length === 0) {
    return (
      <div className="activity-center error">
        <div className="activity-center__error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={() => fetchActivities(true)} className="btn-retry">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Check if all sections are empty
  const hasActivities = sections.some(section => section.activities && section.activities.length > 0);

  return (
    <div className="activity-center">
      {/* Header */}
      <header className="activity-center__header">
        <h1 className="activity-center__title">Central de Atividades</h1>
        {showMarkAllRead && (
          <button
            onClick={handleMarkAllAsRead}
            className="activity-center__mark-all-read"
            aria-label="Marcar todas como lidas"
          >
            Marcar todas como lidas
          </button>
        )}
      </header>

      {/* Filter Tabs */}
      <FilterTabs
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        unreadCount={unreadCount}
      />

      {/* Activity Sections */}
      <div className="activity-center__content" role="feed" aria-label="Atividades">
        {hasActivities ? (
          sections.map((section, sectionIndex) => (
            <ActivitySection
              key={section.title}
              section={section}
              sectionIndex={sectionIndex}
              onActivityClick={handleActivityClick}
              onActivityRead={handleActivityRead}
            />
          ))
        ) : (
          <div className="activity-center__empty">
            <div className="empty-icon">🔔</div>
            <h2 className="empty-title">Nenhuma atividade</h2>
            <p className="empty-message">
              {activeFilter === 'all'
                ? 'Suas atividades aparecerão aqui quando alguém interagir com você.'
                : `Nenhuma atividade em "${activityService.filterOptions.find(f => f.value === activeFilter)?.label || activeFilter}" por enquanto.`}
            </p>
          </div>
        )}

        {/* Load More Trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="activity-center__load-more">
            {loadingMore && <div className="spinner-small"></div>}
          </div>
        )}
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="activity-center__offline" role="alert">
          <span className="offline-icon">📡</span>
          <span>Desconectado - Atualizações em tempo real indisponíveis</span>
        </div>
      )}
    </div>
  );
};

export default ActivityCenter;