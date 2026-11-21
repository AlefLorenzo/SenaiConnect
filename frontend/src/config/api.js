/**
 * API Configuration
 * Centralized configuration for API endpoints and mock mode
 */

// Check if mock mode is enabled via environment variable
// Can be set in .env file: VITE_USE_MOCK=true
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Base API URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// API Endpoints
export const ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    ME: '/api/auth/me',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
  },

  // Users
  USERS: {
    BASE: '/api/users',
    PROFILE: (id) => `/api/users/${id}`,
    STATS: (id) => `/api/users/${id}/stats`,
    POSTS: (id) => `/api/users/${id}/posts`,
    GROUPS: (id) => `/api/users/${id}/groups`,
    SAVED: (id) => `/api/users/${id}/saved`,
    FOLLOWERS: (id) => `/api/users/${id}/followers`,
    FOLLOWING: (id) => `/api/users/${id}/following`,
    PRESENCE: (id) => `/api/users/${id}/presence`,
    PRESENCE_MULTIPLE: '/api/users/presence/multiple',
    SEARCH: '/api/users/search',
    BLOCK: (id) => `/api/users/${id}/block`,
    REPORT: '/api/reports',
  },

  // Posts
  POSTS: {
    BASE: '/api/posts',
    FEED: '/api/posts/feed',
    CREATE: '/api/posts',
    LIKE: (id) => `/api/posts/${id}/like`,
    COMMENT: (id) => `/api/posts/${id}/comments`,
    SHARE: (id) => `/api/posts/${id}/share`,
    SAVE: (id) => `/api/posts/${id}/save`,
    DELETE: (id) => `/api/posts/${id}`,
  },

  // Stories
  STORIES: {
    BASE: '/api/stories',
    CREATE: '/api/stories',
    VIEW: (id) => `/api/stories/${id}/view`,
    FEED: '/api/stories/feed',
    USER: (id) => `/api/stories/user/${id}`,
    HIGHLIGHTS: (userId) => `/api/stories/user/${userId}/highlights`,
    CREATE_HIGHLIGHT: (userId) => `/api/stories/user/${userId}/highlights`,
    UPDATE_HIGHLIGHT: (id) => `/api/stories/highlights/${id}`,
    DELETE_HIGHLIGHT: (id) => `/api/stories/highlights/${id}`,
    ADD_TO_HIGHLIGHT: (id) => `/api/stories/highlights/${id}/stories`,
    REMOVE_FROM_HIGHLIGHT: (id) => `/api/stories/highlights/${id}/stories`,
    MENTIONS_SEARCH: '/api/users/search',
    VIEWERS: (id) => `/api/stories/${id}/viewers`,
    REACTIONS: (id) => `/api/stories/${id}/reactions`,
    REACT: (id) => `/api/stories/${id}/react`,
    REPLIES: (id) => `/api/stories/${id}/replies`,
    REPLY: (id) => `/api/stories/${id}/reply`,
    PRIVACY_EXCEPTIONS: (id) => `/api/stories/${id}/privacy-exceptions`,
  },

  // Messages
  MESSAGES: {
    BASE: '/api/messages',
    CONVERSATIONS: '/api/messages/conversations',
    CONVERSATION: (id) => `/api/messages/conversations/${id}`,
    HISTORY: (id) => `/api/messages/conversations/${id}/history`,
    SEND: (id) => `/api/messages/conversations/${id}/messages`,
    READ: (id) => `/api/messages/conversations/${id}/read`,
    TYPING_START: (id) => `/api/messages/conversations/${id}/typing/start`,
    TYPING_STOP: (id) => `/api/messages/conversations/${id}/typing/stop`,
    UPLOAD_MEDIA: '/api/messages/upload',
  },

  // Groups
  GROUPS: {
    BASE: '/api/groups',
    CREATE: '/api/groups',
    MY_GROUPS: '/api/groups/my-groups',
    JOIN: (id) => `/api/groups/${id}/join`,
    LEAVE: (id) => `/api/groups/${id}/leave`,
    MEMBERS: (id) => `/api/groups/${id}/members`,
    MUTE: (id) => `/api/groups/${id}/mute`,
    IMPORTANT: (id) => `/api/groups/${id}/important`,
    DELETE: (id) => `/api/groups/${id}`,
  },

  // Business/Companies
  COMPANIES: {
    BASE: '/api/business',
    FEED: '/api/business/feed',
    CREATE: '/api/business/posts',
    CATEGORIES: '/api/business/categories',
    VERIFY: (id) => `/api/business/${id}/verify`,
    LIKE: (id) => `/api/business/posts/${id}/like`,
    COMMENT: (id) => `/api/business/posts/${id}/comments`,
    SHARE: (id) => `/api/business/posts/${id}/share`,
    STORIES: '/api/business/stories',
  },

  // Notifications
  NOTIFICATIONS: {
    BASE: '/api/notifications',
    MARK_READ: (id) => `/api/notifications/${id}/read`,
    MARK_ALL_READ: '/api/notifications/read-all',
  },

  // Follows
  FOLLOWS: {
    BASE: '/api/follows',
    FOLLOW: (id) => `/api/follows/${id}/follow`,
    UNFOLLOW: (id) => `/api/follows/${id}/unfollow`,
    STATS: (id) => `/api/follows/${id}/stats`,
  },

  // Friends
  FRIENDS: {
    BASE: '/api/friends',
    REQUEST: (id) => `/api/friends/${id}/request`,
    ACCEPT: (id) => `/api/friends/${id}/accept`,
    REJECT: (id) => `/api/friends/${id}/reject`,
    REMOVE: (id) => `/api/friends/${id}/remove`,
    STATUS: (id) => `/api/friends/${id}/status`,
  },

  // Search
  SEARCH: {
    BASE: '/api/search',
    USERS: '/api/search/users',
    POSTS: '/api/search/posts',
    GROUPS: '/api/search/groups',
    PANEL: '/api/search/panel',
  },

  // Upload
  UPLOAD: {
    IMAGE: '/api/upload/image',
    VIDEO: '/api/upload/video',
    DOCUMENT: '/api/upload/document',
  },

  // Settings
  SETTINGS: {
    BASE: '/api/settings',
    GET: '/api/settings',
    UPDATE: '/api/settings',
    THEME: '/api/settings/theme',
  },
};

// Default request options
export const DEFAULT_REQUEST_OPTIONS = {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
};

// Helper to get auth header
export const getAuthHeader = () => {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};