/**
 * Groups Service
 * Handles all group-related API calls with mock mode support
 */

import BaseService from './baseService';
import { ENDPOINTS } from '../config/api';
import { getAuthHeader } from '../config/api';
import { USE_MOCK } from '../config/api';
import { mockGroups, mockGroupPosts, groupCategories } from '../mock/mockGroups';

class GroupsService extends BaseService {
  constructor() {
    super('groups');
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    // Mock data state for mutations
    this.mockGroups = [...mockGroups];
    this.mockGroupPosts = { ...mockGroupPosts };
  }

  /**
   * Get all groups (public + user's groups)
   */
  async getAllGroups(params = {}) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const cacheKey = `all_groups_${JSON.stringify(params)}`;
      if (this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      // Return paginated format like backend
      const data = {
        data: this.mockGroups,
        pagination: { page: 1, limit: 20, total: this.mockGroups.length, hasMore: false }
      };
      this.setCache(cacheKey, data);
      return data;
    }

    const cacheKey = `all_groups_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.getPaginated(ENDPOINTS.GROUPS.BASE, params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get user's groups
   */
  async getMyGroups(forceRefresh = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cacheKey = 'my_groups';
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      const data = this.mockGroups.filter(g => g.isMember);
      this.setCache(cacheKey, data);
      return data;
    }

    const cacheKey = 'my_groups';
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.get(ENDPOINTS.GROUPS.MY_GROUPS);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get group details
   */
  async getGroup(groupId, forceRefresh = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cacheKey = `group_${groupId}`;
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      this.setCache(cacheKey, group);
      return group;
    }

    const cacheKey = `group_${groupId}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.get(`${ENDPOINTS.GROUPS.BASE}/${groupId}`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Create a new group
   */
  async createGroup(groupData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const newGroup = {
        id: Date.now(),
        name: groupData.name,
        description: groupData.description || '',
        avatar: groupData.avatar || null,
        coverImage: null,
        category: groupData.category || 'outros',
        isPrivate: groupData.isPrivate || false,
        is_private: groupData.isPrivate || false,
        memberCount: 1,
        members_count: 1,
        maxMembers: 50,
        participants: [
          { id: 1, name: 'Você', avatar: null, member: { role: 'admin' }, role: 'admin', user_role: 'admin', isOnline: true, joinedAt: new Date().toISOString() },
        ],
        adminIds: [1],
        muted: false,
        important: false,
        isMember: true,
        is_member: true,
        isAdmin: true,
        is_admin: true,
        isOwner: true,
        is_owner: true,
        rules: '',
        tags: [],
        tag_list: [],
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.mockGroups.unshift(newGroup);
      this.invalidateCache();
      return newGroup;
    }

    const formData = new FormData();
    formData.append('name', groupData.name);
    if (groupData.description) formData.append('description', groupData.description);
    if (groupData.avatar) formData.append('avatar', groupData.avatar);
    if (groupData.category) formData.append('category', groupData.category);
    if (groupData.isPrivate !== undefined) formData.append('isPrivate', groupData.isPrivate);

    const url = this.buildUrl(ENDPOINTS.GROUPS.CREATE);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Update group
   */
  async updateGroup(groupId, groupData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const index = this.mockGroups.findIndex(g => g.id === parseInt(groupId) || g.id === groupId);
      if (index === -1) throw new Error('Grupo não encontrado');
      this.mockGroups[index] = {
        ...this.mockGroups[index],
        ...groupData,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.invalidateCache();
      return this.mockGroups[index];
    }

    const formData = new FormData();
    Object.entries(groupData).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, value);
    });

    const url = this.buildUrl(`${ENDPOINTS.GROUPS.BASE}/${groupId}`);
    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Delete group
   */
  async deleteGroup(groupId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      this.mockGroups = this.mockGroups.filter(g => g.id !== parseInt(groupId) && g.id !== groupId);
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.GROUPS.BASE}/${groupId}`);
  }

  /**
   * Join group
   */
  async joinGroup(groupId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      if (!group.participants.some(p => p.id === 1)) {
        group.participants.push({ id: 1, name: 'Você', avatar: null, member: { role: 'member' }, role: 'member', user_role: 'member', isOnline: true, joinedAt: new Date().toISOString() });
        group.memberCount++;
        group.members_count++;
      }
      group.isMember = true;
      group.is_member = true;
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.JOIN(groupId), {});
  }

  /**
   * Leave group
   */
  async leaveGroup(groupId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.participants = group.participants.filter(p => p.id !== 1);
      group.memberCount = Math.max(0, group.memberCount - 1);
      group.members_count = Math.max(0, group.members_count - 1);
      group.isMember = false;
      group.is_member = false;
      group.isAdmin = false;
      group.is_admin = false;
      group.isOwner = false;
      group.is_owner = false;
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.LEAVE(groupId), {});
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId, params = {}) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      return group.participants || [];
    }

    return this.getPaginated(ENDPOINTS.GROUPS.MEMBERS(groupId), params);
  }

  /**
   * Add members to group
   */
  async addGroupMembers(groupId, userIds) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      // Add mock users
      const mockUsers = [
        { id: 2, name: 'Maria Silva', avatar: null },
        { id: 3, name: 'João Santos', avatar: null },
        { id: 4, name: 'Ana Carolina Oliveira', avatar: null },
        { id: 5, name: 'Pedro Henrique', avatar: null },
        { id: 6, name: 'Fernanda Lima Costa', avatar: null },
      ];
      userIds.forEach(userId => {
        const user = mockUsers.find(u => u.id === userId);
        if (user && !group.participants.some(p => p.id === userId)) {
          group.participants.push({ ...user, member: { role: 'member' }, role: 'member', user_role: 'member', isOnline: false, joinedAt: new Date().toISOString() });
          group.memberCount++;
          group.members_count++;
        }
      });
      this.invalidateCache();
      return { success: true };
    }

    return this.post(`${ENDPOINTS.GROUPS.BASE}/${groupId}/members`, { userIds });
  }

  /**
   * Remove member from group
   */
  async removeGroupMember(groupId, userId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.participants = group.participants.filter(p => p.id !== userId);
      group.memberCount = Math.max(0, group.memberCount - 1);
      group.members_count = Math.max(0, group.members_count - 1);
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.GROUPS.BASE}/${groupId}/members/${userId}`);
  }

  /**
   * Promote member to admin
   */
  async promoteToAdmin(groupId, userId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      if (!group.adminIds.includes(userId)) {
        group.adminIds.push(userId);
      }
      const participant = group.participants.find(p => p.id === userId);
      if (participant) {
        participant.member = { role: 'admin' };
        participant.role = 'admin';
        participant.user_role = 'admin';
      }
      this.invalidateCache();
      return { success: true };
    }

    return this.post(`${ENDPOINTS.GROUPS.BASE}/${groupId}/admins/${userId}`);
  }

  /**
   * Demote admin to member
   */
  async demoteFromAdmin(groupId, userId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.adminIds = group.adminIds.filter(id => id !== userId);
      const participant = group.participants.find(p => p.id === userId);
      if (participant) {
        participant.member = { role: 'member' };
        participant.role = 'member';
        participant.user_role = 'member';
      }
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.GROUPS.BASE}/${groupId}/admins/${userId}`);
  }

  /**
   * Mute/unmute group notifications
   */
  async toggleMute(groupId, muted) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.muted = muted;
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.MUTE(groupId), { muted });
  }

  /**
   * Mark/unmark group as important
   */
  async toggleImportant(groupId, important) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const group = this.mockGroups.find(g => g.id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.important = important;
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.IMPORTANT(groupId), { important });
  }

  /**
   * Get group posts/feed
   */
  async getGroupPosts(groupId, params = {}) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cacheKey = `group_posts_${groupId}_${JSON.stringify(params)}`;
      if (this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      const posts = this.mockGroupPosts[groupId] || [];
      const data = {
        data: posts,
        pagination: { page: 1, limit: 20, total: posts.length, hasMore: false }
      };
      this.setCache(cacheKey, data);
      return data;
    }

    const cacheKey = `group_posts_${groupId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.getPaginated(`${ENDPOINTS.GROUPS.BASE}/${groupId}/posts`, params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Create post in group
   */
  async createGroupPost(groupId, postData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const groupPosts = this.mockGroupPosts[groupId] || [];
      const newPost = {
        id: Date.now(),
        groupId,
        authorId: 1,
        authorName: 'Você',
        authorAvatar: null,
        authorRole: 'member',
        content: postData.content,
        attachments: postData.attachments || [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLiked: false,
        isPinned: false,
        createdAt: new Date().toISOString(),
      };
      groupPosts.unshift(newPost);
      this.mockGroupPosts[groupId] = groupPosts;
      this.invalidateCache();
      return newPost;
    }

    const formData = new FormData();
    formData.append('content', postData.content);
    if (postData.attachments) {
      postData.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    const url = this.buildUrl(`${ENDPOINTS.GROUPS.BASE}/${groupId}/posts`);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Get group categories
   */
  async getCategories() {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return groupCategories;
    }
    // No real endpoint for this, return from backend if available
    return groupCategories;
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

  invalidateGroup(groupId) {
    this.cache.delete(`group_${groupId}`);
    this.cache.delete(`group_posts_${groupId}_${JSON.stringify({})}`);
  }

  // Invalidate cache on group changes
  invalidateCache() {
    this.clearCache();
  }
}

export const groupsService = new GroupsService();
export default groupsService;