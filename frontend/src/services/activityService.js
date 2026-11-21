import { API_URL, USE_MOCK } from '../config/api';

/**
 * Activity Center Service
 * Handles fetching and managing activity feed with filtering, grouping, and pagination
 */

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Generate mock activity data for development/testing
 */
const generateMockActivities = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisWeek = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const earlier = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return [
    {
      title: 'Hoje',
      date: today,
      latestDate: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      activities: [
        {
          id: 1,
          activity_type: 'post_like',
          actor_id: 2,
          actor_name: 'Maria Silva',
          actor_avatar: null,
          reference_type: 'post',
          reference_id: 101,
          grouping_id: 'post_like_101',
          metadata: {
            action: 'post_like',
            post_id: 101,
            post_preview: 'Acabei de concluir meu projeto final...',
            count: 1
          },
          read: false,
          read_at: null,
          created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          activity_type: 'follow',
          actor_id: 3,
          actor_name: 'João Santos',
          actor_avatar: null,
          reference_type: 'user',
          reference_id: 1,
          grouping_id: null,
          metadata: {
            action: 'follow',
            user_id: 1
          },
          read: false,
          read_at: null,
          created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          activity_type: 'comment',
          actor_id: 4,
          actor_name: 'Ana Carolina Oliveira',
          actor_avatar: null,
          reference_type: 'post',
          reference_id: 102,
          grouping_id: 'post_comment_102',
          metadata: {
            action: 'post_comment',
            post_id: 102,
            comment_preview: 'Parabéns! 🎉',
            count: 1
          },
          read: true,
          read_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      title: 'Ontem',
      date: yesterday,
      latestDate: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      activities: [
        {
          id: 4,
          activity_type: 'story_reaction',
          actor_id: 5,
          actor_name: 'Pedro Henrique',
          actor_avatar: null,
          reference_type: 'story',
          reference_id: 201,
          grouping_id: null,
          metadata: {
            action: 'story_reaction',
            story_id: 201,
            reaction: '❤️',
            user_id: 1
          },
          read: true,
          read_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 5,
          activity_type: 'group_invite',
          actor_id: 6,
          actor_name: 'Fernanda Lima Costa',
          actor_avatar: null,
          reference_type: 'group',
          reference_id: 501,
          grouping_id: null,
          metadata: {
            action: 'group_invite',
            group_id: 501,
            group_name: 'Desenvolvedores SENAI'
          },
          read: false,
          read_at: null,
          created_at: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 6,
          activity_type: 'mention',
          actor_id: 2,
          actor_name: 'Maria Silva',
          actor_avatar: null,
          reference_type: 'post',
          reference_id: 103,
          grouping_id: null,
          metadata: {
            action: 'mention',
            post_id: 103,
            post_preview: '@usuario_demo Veja isso!'
          },
          read: true,
          read_at: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      title: 'Esta semana',
      date: thisWeek,
      latestDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      activities: [
        {
          id: 7,
          activity_type: 'post_like',
          actor_id: 3,
          actor_name: 'João Santos',
          actor_avatar: null,
          reference_type: 'post',
          reference_id: 104,
          grouping_id: 'post_like_104',
          metadata: {
            action: 'post_like',
            post_id: 104,
            post_preview: 'Dica do dia: Sempre escreva testes...',
            count: 3
          },
          read: true,
          read_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 8,
          activity_type: 'event_reminder',
          actor_id: 0,
          actor_name: 'Sistema',
          actor_avatar: null,
          reference_type: 'event',
          reference_id: 301,
          grouping_id: null,
          metadata: {
            action: 'event_reminder',
            event_id: 301,
            event_name: 'Workshop React Avançado',
            event_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          read: false,
          read_at: null,
          created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      title: 'Anterior',
      date: earlier,
      latestDate: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString(),
      activities: [
        {
          id: 9,
          activity_type: 'follow_accepted',
          actor_id: 7,
          actor_name: 'Carlos Eduardo',
          actor_avatar: null,
          reference_type: 'user',
          reference_id: 1,
          grouping_id: null,
          metadata: {
            action: 'follow_accepted',
            user_id: 1
          },
          read: true,
          read_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 10,
          activity_type: 'notice',
          actor_id: 0,
          actor_name: 'SENAI Connect',
          actor_avatar: null,
          reference_type: 'notice',
          reference_id: 401,
          grouping_id: null,
          metadata: {
            action: 'notice',
            notice_id: 401,
            notice_title: 'Novas regras de uso da plataforma'
          },
          read: true,
          read_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  ];
};

export const activityService = {
  /**
   * Fetch activities with filtering, grouping, and pagination
   * @param {Object} params - Query parameters
   * @param {string} params.filter - Filter type: 'all', 'followers', 'likes', 'comments', 'mentions', 'stories', 'others'
   * @param {number} params.limit - Number of activities to fetch
   * @param {number} params.offset - Pagination offset
   * @param {boolean} params.group - Enable grouping of repeated activities
   * @returns {Promise<Object>} - { sections, total, limit, offset, hasMore }
   */
  getActivities: async ({ filter = 'all', limit = 50, offset = 0, group = true } = {}) => {
    // In mock mode, return mock data directly
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      const mockSections = generateMockActivities();

      // Apply filter if not 'all'
      let filteredSections = mockSections;
      if (filter !== 'all') {
        filteredSections = mockSections.map(section => ({
          ...section,
          activities: section.activities.filter(activity =>
            activityService.getFilterCategory(activity.activity_type) === filter
          )
        })).filter(section => section.activities.length > 0);
      }

      // Apply pagination
      const allActivities = filteredSections.flatMap(s => s.activities);
      const paginatedActivities = allActivities.slice(offset, offset + limit);

      // Re-group into sections
      const sectionsMap = new Map();
      paginatedActivities.forEach(activity => {
        const sectionTitle = mockSections.find(s => s.activities.some(a => a.id === activity.id))?.title || 'Hoje';
        if (!sectionsMap.has(sectionTitle)) {
          const originalSection = mockSections.find(s => s.title === sectionTitle);
          sectionsMap.set(sectionTitle, {
            title: sectionTitle,
            date: originalSection?.date,
            latestDate: originalSection?.latestDate,
            activities: []
          });
        }
        sectionsMap.get(sectionTitle).activities.push(activity);
      });

      const sections = Array.from(sectionsMap.values());

      return {
        sections,
        total: allActivities.length,
        limit,
        offset,
        hasMore: offset + limit < allActivities.length
      };
    }

    const queryParams = new URLSearchParams({
      filter,
      limit: limit.toString(),
      offset: offset.toString(),
      group: group.toString()
    });

    const res = await fetch(`${API_URL}/api/notifications?${queryParams}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      throw new Error('Erro ao buscar atividades');
    }

    return res.json();
  },

  /**
   * Mark a single activity as read
   * @param {number|string} id - Activity ID
   * @returns {Promise<Object>} - Response
   */
  markAsRead: async (id) => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    }

    const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      throw new Error('Erro ao marcar como lida');
    }

    return res.json();
  },

  /**
   * Mark all activities as read (optionally filtered)
   * @param {string} filter - Filter type to mark as read
   * @returns {Promise<Object>} - Response with updated count
   */
  markAllAsRead: async (filter = 'all') => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, count: 0 };
    }

    const res = await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ filter })
    });

    if (!res.ok) {
      throw new Error('Erro ao marcar todas como lidas');
    }

    return res.json();
  },

  /**
   * Get unread count for badge
   * @returns {Promise<{count: number}>}
   */
  getUnreadCount: async () => {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const mockSections = generateMockActivities();
      const unreadCount = mockSections.flatMap(s => s.activities).filter(a => !a.read).length;
      return { count: unreadCount };
    }

    const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      throw new Error('Erro ao buscar contagem');
    }

    return res.json();
  },

  /**
   * Activity type metadata for UI rendering
   */
  activityTypes: {
    follow: {
      icon: '👤',
      label: 'Seguiu você',
      color: 'var(--accent-blue)',
      category: 'followers'
    },
    follow_accepted: {
      icon: '✅',
      label: 'Aceitou seu pedido',
      color: 'var(--accent-green)',
      category: 'followers'
    },
    post_like: {
      icon: '❤️',
      label: 'Curtiu sua publicação',
      color: 'var(--accent-red)',
      category: 'likes'
    },
    like: {
      icon: '❤️',
      label: 'Curtiu',
      color: 'var(--accent-red)',
      category: 'likes'
    },
    post_comment: {
      icon: '💬',
      label: 'Comentou na sua publicação',
      color: 'var(--accent-purple)',
      category: 'comments'
    },
    comment: {
      icon: '💬',
      label: 'Comentou',
      color: 'var(--accent-purple)',
      category: 'comments'
    },
    comment_reply: {
      icon: '↩️',
      label: 'Respondeu ao seu comentário',
      color: 'var(--accent-purple)',
      category: 'comments'
    },
    mention: {
      icon: '📢',
      label: 'Mencionou você',
      color: 'var(--accent-orange)',
      category: 'mentions'
    },
    story_mention: {
      icon: '📢',
      label: 'Mencionou você em uma história',
      color: 'var(--accent-orange)',
      category: 'mentions'
    },
    comment_mention: {
      icon: '📢',
      label: 'Mencionou você em um comentário',
      color: 'var(--accent-orange)',
      category: 'mentions'
    },
    story_reaction: {
      icon: '😊',
      label: 'Reagiu à sua história',
      color: 'var(--accent-pink)',
      category: 'stories'
    },
    story_reply: {
      icon: '💌',
      label: 'Respondeu à sua história',
      color: 'var(--accent-pink)',
      category: 'stories'
    },
    story_view: {
      icon: '👁️',
      label: 'Visualizou sua história',
      color: 'var(--accent-pink)',
      category: 'stories'
    },
    group_invite: {
      icon: '👥',
      label: 'Convidou você para um grupo',
      color: 'var(--accent-teal)',
      category: 'others'
    },
    group_post: {
      icon: '📝',
      label: 'Publicou no grupo',
      color: 'var(--accent-teal)',
      category: 'others'
    },
    event_reminder: {
      icon: '📅',
      label: 'Lembrete de evento',
      color: 'var(--accent-indigo)',
      category: 'others'
    },
    notice: {
      icon: '📋',
      label: 'Aviso institucional',
      color: 'var(--accent-indigo)',
      category: 'others'
    },
    message: {
      icon: '💬',
      label: 'Nova mensagem',
      color: 'var(--accent-blue)',
      category: 'others'
    }
  },

  /**
   * Filter options for UI
   */
  filterOptions: [
    { value: 'all', label: 'Todas', icon: '🔔' },
    { value: 'followers', label: 'Seguidores', icon: '👤' },
    { value: 'likes', label: 'Curtidas', icon: '❤️' },
    { value: 'comments', label: 'Comentários', icon: '💬' },
    { value: 'mentions', label: 'Menções', icon: '📢' },
    { value: 'stories', label: 'Histórias', icon: '📖' },
    { value: 'others', label: 'Outras', icon: '📦' }
  ],

  /**
   * Get activity type metadata
   * @param {string} activityType - The activity type
   * @returns {Object} - Metadata object with icon, label, color, category
   */
  getActivityMeta: (activityType) => {
    return activityService.activityTypes[activityType] || {
      icon: '🔔',
      label: 'Atividade',
      color: 'var(--text-secondary)',
      category: 'others'
    };
  },

  /**
   * Get filter category for an activity type
   * @param {string} activityType - The activity type
   * @returns {string} - Filter category
   */
  getFilterCategory: (activityType) => {
    const meta = activityService.activityTypes[activityType];
    return meta?.category || 'others';
  }
};

export default activityService;