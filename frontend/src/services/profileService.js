/**
 * Profile Service
 * Handles user profile data, stats, achievements, posts, projects, and settings
 */

import BaseService from './baseService';
import { ENDPOINTS } from '../config/api';
import { getAuthHeader } from '../config/api';
import { mockProfiles, mockAchievements, mockUserProjects } from '../mock/mockProfiles';

class ProfileService extends BaseService {
  constructor() {
    super('profile');
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId, forceRefresh = false) {
    const cacheKey = `profile_${userId}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetProfile(userId);
    }

    const data = await this.get(ENDPOINTS.USERS.PROFILE(userId));
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get current user's profile
   */
  async getMyProfile(forceRefresh = false) {
    return this.getProfile('me', forceRefresh);
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    if (this.isMockMode()) {
      return this.mockUpdateProfile(profileData);
    }

    const formData = new FormData();
    Object.entries(profileData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'skills' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'links' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'avatar' || key === 'cover_image') {
          // File uploads handled separately
        } else {
          formData.append(key, value);
        }
      }
    });

    const url = this.buildUrl(ENDPOINTS.USERS.PROFILE('me'));
    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file) {
    if (this.isMockMode()) {
      return this.mockUploadAvatar(file);
    }

    const formData = new FormData();
    formData.append('avatar', file);

    const url = this.buildUrl(`${ENDPOINTS.USERS.BASE}/me/avatar`);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Upload cover image
   */
  async uploadCoverImage(file) {
    if (this.isMockMode()) {
      return this.mockUploadCoverImage(file);
    }

    const formData = new FormData();
    formData.append('cover_image', file);

    const url = this.buildUrl(`${ENDPOINTS.USERS.BASE}/me/cover`);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Get user stats (followers, following, posts, groups)
   */
  async getStats(userId) {
    const cacheKey = `stats_${userId}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetStats(userId);
    }

    const data = await this.get(ENDPOINTS.USERS.STATS(userId));
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get user posts
   */
  async getUserPosts(userId, params = {}) {
    const cacheKey = `posts_${userId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetUserPosts(userId, params);
    }

    const data = await this.getPaginated(ENDPOINTS.USERS.POSTS(userId), params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get user groups
   */
  async getUserGroups(userId, params = {}) {
    const cacheKey = `groups_${userId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetUserGroups(userId, params);
    }

    const data = await this.getPaginated(ENDPOINTS.USERS.GROUPS(userId), params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get saved posts (own profile only)
   */
  async getSavedPosts(userId, params = {}) {
    const cacheKey = `saved_${userId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetSavedPosts(userId, params);
    }

    const data = await this.getPaginated(ENDPOINTS.USERS.SAVED(userId), params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get user achievements/badges
   */
  async getAchievements(userId) {
    const cacheKey = `achievements_${userId}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetAchievements(userId);
    }

    const data = await this.get(`${ENDPOINTS.USERS.BASE}/${userId}/achievements`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get user projects
   */
  async getProjects(userId, params = {}) {
    const cacheKey = `projects_${userId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetProjects(userId, params);
    }

    const data = await this.getPaginated(`${ENDPOINTS.USERS.BASE}/${userId}/projects`, params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Search users
   */
  async searchUsers(query, params = {}) {
    if (this.isMockMode()) {
      return this.mockSearchUsers(query, params);
    }

    return this.getPaginated(ENDPOINTS.USERS.SEARCH, { q: query, ...params });
  }

  /**
   * Follow/Unfollow user
   */
  async toggleFollow(userId, follow) {
    if (this.isMockMode()) {
      return this.mockToggleFollow(userId, follow);
    }

    return follow
      ? this.post(ENDPOINTS.FOLLOWS.FOLLOW(userId), {})
      : this.delete(ENDPOINTS.FOLLOWS.UNFOLLOW(userId));
  }

  /**
   * Get followers
   */
  async getFollowers(userId, params = {}) {
    if (this.isMockMode()) {
      return this.mockGetFollowers(userId, params);
    }

    return this.getPaginated(ENDPOINTS.USERS.FOLLOWERS(userId), params);
  }

  /**
   * Get following
   */
  async getFollowing(userId, params = {}) {
    if (this.isMockMode()) {
      return this.mockGetFollowing(userId, params);
    }

    return this.getPaginated(ENDPOINTS.USERS.FOLLOWING(userId), params);
  }

  /**
   * Block user
   */
  async blockUser(userId) {
    if (this.isMockMode()) {
      return this.mockBlockUser(userId);
    }

    return this.post(ENDPOINTS.USERS.BLOCK(userId), {});
  }

  /**
   * Report user
   */
  async reportUser(userId, reason) {
    if (this.isMockMode()) {
      return this.mockReportUser(userId, reason);
    }

    return this.post(ENDPOINTS.USERS.REPORT, { target_type: 'user', target_id: userId, reason });
  }

  // Mock implementations
  mockGetProfile(userId) {
    return new Promise(resolve => {
      setTimeout(() => {
        const profile = mockProfiles[userId] || mockProfiles[1];
        resolve(profile);
      }, 300);
    });
  }

  mockUpdateProfile(profileData) {
    return new Promise(resolve => {
      setTimeout(() => {
        const updated = { ...mockProfiles[1], ...profileData };
        mockProfiles[1] = updated;
        resolve(updated);
      }, 500);
    });
  }

  mockUploadAvatar(file) {
    return new Promise(resolve => {
      setTimeout(() => {
        // Create object URL for mock
        const url = URL.createObjectURL(file);
        mockProfiles[1].avatar = url;
        resolve({ avatar: url });
      }, 500);
    });
  }

  mockUploadCoverImage(file) {
    return new Promise(resolve => {
      setTimeout(() => {
        const url = URL.createObjectURL(file);
        mockProfiles[1].cover_image = url;
        resolve({ cover_image: url });
      }, 500);
    });
  }

  mockGetStats(userId) {
    return new Promise(resolve => {
      setTimeout(() => {
        const profile = mockProfiles[userId] || mockProfiles[1];
        resolve({
          followers: profile.followersCount || 0,
          following: profile.followingCount || 0,
          posts: profile.postsCount || 0,
          groups: profile.groupsCount || 0,
        });
      }, 200);
    });
  }

  mockGetUserPosts(userId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        // In a real app, this would fetch from posts API
        // For mock, we'll return empty or use mockPosts
        resolve({
          data: [],
          pagination: { page: params.page || 1, limit: params.limit || 10, total: 0, hasMore: false }
        });
      }, 300);
    });
  }

  mockGetUserGroups(userId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        // Mock groups data - supports both snake_case (mock) and camelCase (API) via nullish coalescing
        // Component usage: const count = group.members_count ?? group.membersCount;
        const groups = [
          { id: 1, name: 'Desenvolvimento Web', description: 'Grupo para devs web', members_count: 150, membersCount: 150 },
          { id: 2, name: 'React Native', description: 'Mobile development', members_count: 89, membersCount: 89 },
        ];
        resolve({
          data: groups,
          pagination: { page: params.page || 1, limit: params.limit || 10, total: groups.length, hasMore: false }
        });
      }, 300);
    });
  }

  mockGetSavedPosts(userId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: [],
          pagination: { page: params.page || 1, limit: params.limit || 10, total: 0, hasMore: false }
        });
      }, 300);
    });
  }

  mockGetAchievements(userId) {
    return new Promise(resolve => {
      setTimeout(() => {
        const profile = mockProfiles[userId] || mockProfiles[1];
        const userAchievements = mockAchievements.filter(a => profile.achievementIds?.includes(a.id));
        resolve(userAchievements);
      }, 300);
    });
  }

  mockGetProjects(userId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        const projects = mockUserProjects[userId] || mockUserProjects[1] || [];
        const page = params.page || 1;
        const limit = params.limit || 6;
        const start = (page - 1) * limit;
        const end = start + limit;
        resolve({
          data: projects.slice(start, end),
          pagination: { page, limit, total: projects.length, hasMore: end < projects.length }
        });
      }, 300);
    });
  }

  mockSearchUsers(query, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        const results = Object.values(mockProfiles).filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.handle?.toLowerCase().includes(query.toLowerCase())
        );
        resolve({
          data: results,
          pagination: { page: params.page || 1, limit: params.limit || 20, total: results.length, hasMore: false }
        });
      }, 300);
    });
  }

  mockToggleFollow(userId, follow) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const profile = mockProfiles[userId];
        if (profile) {
          profile.isFollowing = follow;
          profile.followersCount += follow ? 1 : -1;
          resolve({ success: true, following: follow, followersCount: profile.followersCount });
        } else {
          reject(new Error('Usuário não encontrado'));
        }
      }, 200);
    });
  }

  mockGetFollowers(userId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        // Mock followers
        resolve({
          data: [],
          pagination: { page: params.page || 1, limit: params.limit || 20, total: 0, hasMore: false }
        });
      }, 300);
    });
  }

  mockGetFollowing(userId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          data: [],
          pagination: { page: params.page || 1, limit: params.limit || 20, total: 0, hasMore: false }
        });
      }, 300);
    });
  }

  mockBlockUser() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, blocked: true });
      }, 200);
    });
  }

  mockReportUser() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, reportId: Date.now() });
      }, 300);
    });
  }

  // Cache management
  isCacheValid(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache() {
    this.cache.clear();
  }

  invalidateProfile(userId) {
    this.cache.delete(`profile_${userId}`);
    this.cache.delete(`stats_${userId}`);
    this.cache.delete(`achievements_${userId}`);
  }
}

export const profileService = new ProfileService();
export default profileService;