/**
 * Centralized API Service
 * Consolidates all API calls with consistent error handling, auth, and caching
 */

import { API_URL, ENDPOINTS, getAuthHeader, DEFAULT_REQUEST_OPTIONS } from '../config/api';

// ============================================
// Core Request Helpers
// ============================================

/**
 * Base fetch wrapper with error handling and auth
 */
async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    ...DEFAULT_REQUEST_OPTIONS,
    ...options,
    headers: {
      ...DEFAULT_REQUEST_OPTIONS.headers,
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.message || `HTTP ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.message || 'Network error',
      0,
      { originalError: error }
    );
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * GET request
 */
export function get(endpoint) {
  return request(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export function post(endpoint, body) {
  return request(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

/**
 * PUT request
 */
export function put(endpoint, body) {
  return request(endpoint, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

/**
 * PATCH request
 */
export function patch(endpoint, body) {
  return request(endpoint, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

/**
 * DELETE request
 */
export function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}

/**
 * Upload file(s)
 */
export function upload(endpoint, formData) {
  return request(endpoint, {
    method: 'POST',
    body: formData,
  });
}

// ============================================
// Auth API
// ============================================

export const authApi = {
  login: (credentials) => post(ENDPOINTS.AUTH.LOGIN, credentials),

  register: (userData) => post(ENDPOINTS.AUTH.REGISTER, userData),

  me: () => get(ENDPOINTS.AUTH.ME),

  logout: () => post(ENDPOINTS.AUTH.LOGOUT),

  refresh: () => post(ENDPOINTS.AUTH.REFRESH),

  forgotPassword: (email) => post('/api/auth/forgot-password', { email }),

  resetPassword: (token, password) => post('/api/auth/reset-password', { token, password }),
};

// ============================================
// Users API
// ============================================

export const usersApi = {
  getProfile: (id) => get(ENDPOINTS.USERS.PROFILE(id)),

  updateProfile: (id, data) => put(ENDPOINTS.USERS.PROFILE(id), data),

  getStats: (id) => get(ENDPOINTS.USERS.STATS(id)),

  getPosts: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.USERS.POSTS(id)}?${query}`);
  },

  getGroups: (id) => get(ENDPOINTS.USERS.GROUPS(id)),

  getSaved: (id) => get(ENDPOINTS.USERS.SAVED(id)),

  getFollowers: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.USERS.FOLLOWERS(id)}?${query}`);
  },

  getFollowing: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.USERS.FOLLOWING(id)}?${query}`);
  },

  getPresence: (id) => get(ENDPOINTS.USERS.PRESENCE(id)),

  getPresenceMultiple: (ids) => post(ENDPOINTS.USERS.PRESENCE_MULTIPLE, { ids }),

  search: (query, params = {}) => {
    const searchParams = new URLSearchParams({ q: query, ...params }).toString();
    return get(`${ENDPOINTS.USERS.SEARCH}?${searchParams}`);
  },

  block: (id) => post(ENDPOINTS.USERS.BLOCK(id)),

  unblock: (id) => del(ENDPOINTS.USERS.BLOCK(id)),

  report: (data) => post(ENDPOINTS.USERS.REPORT, data),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return upload(ENDPOINTS.UPLOAD.IMAGE, formData);
  },

  uploadCover: (file) => {
    const formData = new FormData();
    formData.append('cover', file);
    return upload(ENDPOINTS.UPLOAD.IMAGE, formData);
  },

  updateSettings: (data) => put('/api/users/settings', data),

  changePassword: (data) => put('/api/users/password', data),
};

// ============================================
// Posts API
// ============================================

export const postsApi = {
  getFeed: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.POSTS.BASE}?${query}`);
  },

  getAlgorithmicFeed: (params = {}) => {
    const query = new URLSearchParams({ sort: 'algo', ...params }).toString();
    return get(`${ENDPOINTS.POSTS.BASE}?${query}`);
  },

  getChronologicalFeed: (params = {}) => {
    const query = new URLSearchParams({ sort: 'chrono', ...params }).toString();
    return get(`${ENDPOINTS.POSTS.BASE}?${query}`);
  },

  getPost: (id) => get(`${ENDPOINTS.POSTS.BASE}/${id}`),

  create: (data) => post(ENDPOINTS.POSTS.CREATE, data),

  update: (id, data) => put(`${ENDPOINTS.POSTS.BASE}/${id}`, data),

  delete: (id) => del(ENDPOINTS.POSTS.DELETE(id)),

  like: (id) => post(ENDPOINTS.POSTS.LIKE(id)),

  unlike: (id) => del(ENDPOINTS.POSTS.LIKE(id)),

  save: (id) => post(ENDPOINTS.POSTS.SAVE(id)),

  unsave: (id) => del(ENDPOINTS.POSTS.SAVE(id)),

  share: (id, data = {}) => post(ENDPOINTS.POSTS.SHARE(id), data),

  getComments: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.POSTS.COMMENT(id)}?${query}`);
  },

  addComment: (id, content) => post(ENDPOINTS.POSTS.COMMENT(id), { content }),

  updateComment: (postId, commentId, content) =>
    put(`/api/posts/${postId}/comments/${commentId}`, { content }),

  deleteComment: (postId, commentId) =>
    del(`/api/posts/${postId}/comments/${commentId}`),

  uploadMedia: (file, folder = 'posts') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return upload(ENDPOINTS.UPLOAD.IMAGE, formData);
  },
};

// ============================================
// Stories API
// ============================================

export const storiesApi = {
  getFeed: () => get(ENDPOINTS.STORIES.FEED),

  getUserStories: (userId) => get(ENDPOINTS.STORIES.USER(userId)),

  create: (storyData) => {
    const formData = new FormData();
    if (storyData.image) formData.append('image', storyData.image);
    if (storyData.video) formData.append('video', storyData.video);
    if (storyData.text) formData.append('text', storyData.text);
    if (storyData.backgroundColor) formData.append('backgroundColor', storyData.backgroundColor);
    return upload(ENDPOINTS.STORIES.CREATE, formData);
  },

  view: (storyId) => post(ENDPOINTS.STORIES.VIEW(storyId)),

  delete: (storyId) => del(`${ENDPOINTS.STORIES.BASE}/${storyId}`),

  getViewers: (storyId) => get(`${ENDPOINTS.STORIES.BASE}/${storyId}/viewers`),
};

// ============================================
// Messages API
// ============================================

export const messagesApi = {
  getConversations: (type = 'individual', params = {}) => {
    const query = new URLSearchParams({ type, ...params }).toString();
    return get(`${ENDPOINTS.MESSAGES.CONVERSATIONS}?${query}`);
  },

  getConversation: (id) => get(ENDPOINTS.MESSAGES.CONVERSATION(id)),

  createConversation: (participantId) =>
    post(ENDPOINTS.MESSAGES.CONVERSATIONS, { participantId }),

  getHistory: (conversationId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.MESSAGES.HISTORY(conversationId)}?${query}`);
  },

  send: (conversationId, data) => post(ENDPOINTS.MESSAGES.SEND(conversationId), data),

  sendWithMedia: (conversationId, formData) => upload(ENDPOINTS.MESSAGES.SEND(conversationId), formData),

  markAsRead: (conversationId) => post(ENDPOINTS.MESSAGES.READ(conversationId)),

  typingStart: (conversationId) => post(ENDPOINTS.MESSAGES.TYPING_START(conversationId), { conversationId }),

  typingStop: (conversationId) => post(ENDPOINTS.MESSAGES.TYPING_STOP(conversationId), { conversationId }),

  edit: (messageId, content) =>
    put(`/api/messages/${messageId}`, { content }),

  delete: (messageId, forEveryone = false) =>
    del(`/api/messages/${messageId}?forEveryone=${forEveryone}`),

  // Groups
  getGroups: () => get(ENDPOINTS.GROUPS.BASE),

  createGroup: (data) => post(ENDPOINTS.GROUPS.CREATE, data),

  getGroup: (id) => get(`${ENDPOINTS.GROUPS.BASE}/${id}`),

  updateGroup: (id, data) => put(`${ENDPOINTS.GROUPS.BASE}/${id}`, data),

  deleteGroup: (id) => del(ENDPOINTS.GROUPS.DELETE(id)),

  joinGroup: (id) => post(ENDPOINTS.GROUPS.JOIN(id)),

  leaveGroup: (id) => post(ENDPOINTS.GROUPS.LEAVE(id)),

  getMembers: (id) => get(ENDPOINTS.GROUPS.MEMBERS(id)),

  addMember: (groupId, userId) => post(`${ENDPOINTS.GROUPS.MEMBERS(groupId)}`, { userId }),

  removeMember: (groupId, userId) => del(`${ENDPOINTS.GROUPS.MEMBERS(groupId)}/${userId}`),

  muteGroup: (id) => post(ENDPOINTS.GROUPS.MUTE(id)),

  unmuteGroup: (id) => del(ENDPOINTS.GROUPS.MUTE(id)),

  markImportant: (id) => post(ENDPOINTS.GROUPS.IMPORTANT(id)),

  unmarkImportant: (id) => del(ENDPOINTS.GROUPS.IMPORTANT(id)),
};

// ============================================
// Groups API (Public)
// ============================================

export const groupsApi = {
  getMyGroups: () => get(ENDPOINTS.GROUPS.MY_GROUPS),

  discover: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.GROUPS.BASE}?${query}`);
  },

  getGroup: (id) => get(`${ENDPOINTS.GROUPS.BASE}/${id}`),

  create: (data) => post(ENDPOINTS.GROUPS.CREATE, data),

  update: (id, data) => put(`${ENDPOINTS.GROUPS.BASE}/${id}`, data),

  delete: (id) => del(ENDPOINTS.GROUPS.DELETE(id)),

  join: (id) => post(ENDPOINTS.GROUPS.JOIN(id)),

  leave: (id) => post(ENDPOINTS.GROUPS.LEAVE(id)),

  getMembers: (id) => get(ENDPOINTS.GROUPS.MEMBERS(id)),

  addMember: (groupId, userId) => post(`${ENDPOINTS.GROUPS.MEMBERS(groupId)}`, { userId }),

  removeMember: (groupId, userId) => del(`${ENDPOINTS.GROUPS.MEMBERS(groupId)}/${userId}`),

  mute: (id) => post(ENDPOINTS.GROUPS.MUTE(id)),

  unmute: (id) => del(ENDPOINTS.GROUPS.MUTE(id)),

  markImportant: (id) => post(ENDPOINTS.GROUPS.IMPORTANT(id)),

  unmarkImportant: (id) => del(ENDPOINTS.GROUPS.IMPORTANT(id)),
};

// ============================================
// Notifications API
// ============================================

export const notificationsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.NOTIFICATIONS.BASE}?${query}`);
  },

  markAsRead: (id) => put(ENDPOINTS.NOTIFICATIONS.MARK_READ(id)),

  markAllAsRead: () => put(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ),

  delete: (id) => del(`${ENDPOINTS.NOTIFICATIONS.BASE}/${id}`),

  getPreferences: () => get('/api/notifications/preferences'),

  updatePreferences: (prefs) => put('/api/notifications/preferences', prefs),
};

// ============================================
// Follows API
// ============================================

export const followsApi = {
  follow: (userId) => post(ENDPOINTS.FOLLOWS.FOLLOW(userId)),

  unfollow: (userId) => del(ENDPOINTS.FOLLOWS.UNFOLLOW(userId)),

  getStats: (userId) => get(ENDPOINTS.FOLLOWS.STATS(userId)),

  getFollowers: (userId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.USERS.FOLLOWERS(userId)}?${query}`);
  },

  getFollowing: (userId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.USERS.FOLLOWING(userId)}?${query}`);
  },

  getSuggestions: () => get('/api/follows/suggestions'),
};

// ============================================
// Friends API
// ============================================

export const friendsApi = {
  request: (userId) => post(ENDPOINTS.FRIENDS.REQUEST(userId)),

  accept: (userId) => post(ENDPOINTS.FRIENDS.ACCEPT(userId)),

  reject: (userId) => post(ENDPOINTS.FRIENDS.REJECT(userId)),

  remove: (userId) => post(ENDPOINTS.FRIENDS.REMOVE(userId)),

  getStatus: (userId) => get(ENDPOINTS.FRIENDS.STATUS(userId)),

  getFriends: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.FRIENDS.BASE}?${query}`);
  },

  getRequests: () => get('/api/friends/requests'),
};

// ============================================
// Search API
// ============================================

export const searchApi = {
  global: (query, params = {}) => {
    const searchParams = new URLSearchParams({ q: query, ...params }).toString();
    return get(`${ENDPOINTS.SEARCH.BASE}?${searchParams}`);
  },

  users: (query, params = {}) => {
    const searchParams = new URLSearchParams({ q: query, ...params }).toString();
    return get(`${ENDPOINTS.SEARCH.USERS}?${searchParams}`);
  },

  posts: (query, params = {}) => {
    const searchParams = new URLSearchParams({ q: query, ...params }).toString();
    return get(`${ENDPOINTS.SEARCH.POSTS}?${searchParams}`);
  },

  groups: (query, params = {}) => {
    const searchParams = new URLSearchParams({ q: query, ...params }).toString();
    return get(`${ENDPOINTS.SEARCH.GROUPS}?${searchParams}`);
  },

  panel: (query) => get(`${ENDPOINTS.SEARCH.PANEL}?q=${encodeURIComponent(query)}`),
};

// ============================================
// Business/Companies API
// ============================================

export const businessApi = {
  getFeed: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.COMPANIES.FEED}?${query}`);
  },

  getDirectory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`${ENDPOINTS.COMPANIES.BASE}?${query}`);
  },

  getProfile: (id) => get(`${ENDPOINTS.COMPANIES.BASE}/${id}`),

  createPost: (data) => post(ENDPOINTS.COMPANIES.CREATE, data),

  updatePost: (id, data) => put(`${ENDPOINTS.COMPANIES.BASE}/posts/${id}`, data),

  deletePost: (id) => del(`${ENDPOINTS.COMPANIES.BASE}/posts/${id}`),

  likePost: (id) => post(ENDPOINTS.COMPANIES.LIKE(id)),

  commentPost: (id, content) => post(ENDPOINTS.COMPANIES.COMMENT(id), { content }),

  sharePost: (id) => post(ENDPOINTS.COMPANIES.SHARE(id)),

  getCategories: () => get(ENDPOINTS.COMPANIES.CATEGORIES),

  requestVerification: (id) => post(ENDPOINTS.COMPANIES.VERIFY(id)),

  // Dashboard
  getDashboard: () => get('/api/business/dashboard'),

  getDashboardPosts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/business/dashboard/posts?${query}`);
  },

  getDashboardCampaigns: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/business/dashboard/campaigns?${query}`);
  },

  getDashboardAnalytics: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/business/dashboard/analytics?${query}`);
  },

  getDashboardBilling: () => get('/api/business/dashboard/billing'),

  getDashboardSettings: () => get('/api/business/dashboard/settings'),

  updateDashboardSettings: (data) => put('/api/business/dashboard/settings', data),
};

// ============================================
// Admin API
// ============================================

export const adminApi = {
  getDashboard: () => get('/api/admin/dashboard'),

  // Notices
  getNotices: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/admin/notices?${query}`);
  },

  getNotice: (id) => get(`/api/admin/notices/${id}`),

  createNotice: (data) => post('/api/admin/notices', data),

  updateNotice: (id, data) => put(`/api/admin/notices/${id}`, data),

  deleteNotice: (id) => del(`/api/admin/notices/${id}`),

  publishNotice: (id) => post(`/api/admin/notices/${id}/publish`),

  // Users
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/admin/users?${query}`);
  },

  getUser: (id) => get(`/api/admin/users/${id}`),

  updateUser: (id, data) => put(`/api/admin/users/${id}`, data),

  deleteUser: (id) => del(`/api/admin/users/${id}`),

  blockUser: (id) => post(`/api/admin/users/${id}/block`),

  unblockUser: (id) => post(`/api/admin/users/${id}/unblock`),

  // Reports
  getReports: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/admin/reports?${query}`);
  },

  getReport: (id) => get(`/api/admin/reports/${id}`),

  reviewReport: (id) => post(`/api/admin/reports/${id}/review`),

  resolveReport: (id, action) => post(`/api/admin/reports/${id}/resolve`, { action }),

  dismissReport: (id) => post(`/api/admin/reports/${id}/dismiss`),

  // Audit
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/admin/audit?${query}`);
  },

  exportAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/admin/audit/export?${query}`);
  },

  // Settings
  getSettings: () => get('/api/admin/settings'),

  updateSettings: (data) => put('/api/admin/settings', data),

  // Courses
  getCourses: () => get('/api/admin/courses'),

  createCourse: (data) => post('/api/admin/courses', data),

  updateCourse: (id, data) => put(`/api/admin/courses/${id}`, data),

  deleteCourse: (id) => del(`/api/admin/courses/${id}`),

  // Events
  getEvents: () => get('/api/admin/events'),

  createEvent: (data) => post('/api/admin/events', data),

  updateEvent: (id, data) => put(`/api/admin/events/${id}`, data),

  deleteEvent: (id) => del(`/api/admin/events/${id}`),
};

// ============================================
// Courses API
// ============================================

export const coursesApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/courses?${query}`);
  },

  get: (id) => get(`/api/courses/${id}`),

  enroll: (id) => post(`/api/courses/${id}/enroll`),

  unenroll: (id) => del(`/api/courses/${id}/enroll`),

  getMyCourses: () => get('/api/courses/my'),

  getProgress: (id) => get(`/api/courses/${id}/progress`),

  updateProgress: (id, data) => put(`/api/courses/${id}/progress`, data),
};

// ============================================
// Events API
// ============================================

export const eventsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return get(`/api/events?${query}`);
  },

  get: (id) => get(`/api/events/${id}`),

  register: (id) => post(`/api/events/${id}/register`),

  unregister: (id) => del(`/api/events/${id}/register`),

  getMyEvents: () => get('/api/events/my'),

  checkIn: (id) => post(`/api/events/${id}/checkin`),
};

// ============================================
// Upload API
// ============================================

export const uploadApi = {
  image: (file, folder = 'posts') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return upload(ENDPOINTS.UPLOAD.IMAGE, formData);
  },

  video: (file, folder = 'posts') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return upload(ENDPOINTS.UPLOAD.VIDEO, formData);
  },

  document: (file, folder = 'documents') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return upload(ENDPOINTS.UPLOAD.DOCUMENT, formData);
  },
};

// ============================================
// Default Export
// ============================================

export default {
  auth: authApi,
  users: usersApi,
  posts: postsApi,
  stories: storiesApi,
  messages: messagesApi,
  groups: groupsApi,
  notifications: notificationsApi,
  follows: followsApi,
  friends: friendsApi,
  search: searchApi,
  business: businessApi,
  admin: adminApi,
  courses: coursesApi,
  events: eventsApi,
  upload: uploadApi,
  // Core helpers
  request,
  get,
  post,
  put,
  patch,
  delete: del,
  upload,
  ApiError,
};