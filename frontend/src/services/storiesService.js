/**
 * Stories Service
 * Handles all story-related API calls with mock mode support
 */

import BaseService from './baseService';
import { ENDPOINTS } from '../config/api';
import { getAuthHeader } from '../config/api';
import { USE_MOCK } from '../config/api';
import { mockStories, mockUserStories, mockHighlights, mockAddStory } from '../mock/mockStories';

// Mock data for new features
const mockStoryViewers = [
  { id: 2, name: 'Maria Silva', avatar: null, username: 'maria.silva', viewed_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, name: 'João Santos', avatar: null, username: 'joao.santos', viewed_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 4, name: 'Ana Carolina Oliveira', avatar: null, username: 'ana.oliveira', viewed_at: new Date(Date.now() - 10800000).toISOString() },
];

const mockStoryReactions = [
  { type: 'heart', count: 3, users: [{ id: 2, name: 'Maria Silva', avatar: null }, { id: 3, name: 'João Santos', avatar: null }, { id: 4, name: 'Ana Oliveira', avatar: null }] },
  { type: 'fire', count: 1, users: [{ id: 5, name: 'Pedro Henrique', avatar: null }] },
];

const mockStoryReplies = [
  { id: 1, story_id: 1, user_id: 2, content: 'Legal!', created_at: new Date(Date.now() - 1800000).toISOString(), name: 'Maria Silva', avatar: null, username: 'maria.silva' },
  { id: 2, story_id: 1, user_id: 3, content: 'Top demais 🔥', created_at: new Date(Date.now() - 900000).toISOString(), name: 'João Santos', avatar: null, username: 'joao.santos' },
];

class StoriesService extends BaseService {
  constructor() {
    super('stories');
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    // Mock data state for mutations
    this.mockFeed = [...mockStories];
    this.mockUserStories = { ...mockUserStories };
    this.mockHighlights = { ...mockHighlights };
  }

  /**
   * Get stories feed (stories from followed users)
   */
  async getFeed(forceRefresh = false) {
    if (USE_MOCK) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      const cacheKey = 'feed';
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      // Transform mock data to match backend format
      const transformedFeed = this.mockFeed.map(group => ({
        user_id: group.user.id,
        user_name: group.user.name,
        user_avatar: group.user.avatar,
        stories: (group.items || []).map(story => ({
          id: story.id,
          media_url: story.url,
          media_type: story.type,
          text_content: story.text,
          background_color: story.backgroundColor,
          created_at: story.createdAt,
          expires_at: group.expiresAt,
          views_count: group.viewsCount,
          reply_count: 0,
          reaction_count: 0,
          viewed: story.viewed,
        })),
      }));
      // Add "add story" item at the beginning
      const feedWithAdd = [mockAddStory, ...transformedFeed];
      this.setCache(cacheKey, feedWithAdd);
      return feedWithAdd;
    }

    const cacheKey = 'feed';
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.get(ENDPOINTS.STORIES.FEED);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get stories for a specific user
   */
  async getUserStories(userId, forceRefresh = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cacheKey = `user_${userId}`;
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      const userStories = this.mockUserStories[userId] || [];
      // Transform mock data to match backend format
      const transformedData = userStories.map(group => ({
        user_id: group.user.id,
        user_name: group.user.name,
        user_avatar: group.user.avatar,
        stories: (group.items || []).map(story => ({
          id: story.id,
          media_url: story.url,
          media_type: story.type,
          text_content: story.text,
          background_color: story.backgroundColor,
          created_at: story.createdAt,
          expires_at: group.expiresAt,
          views_count: group.viewsCount,
          reply_count: 0,
          reaction_count: 0,
          viewed: story.viewed,
        })),
      }));
      this.setCache(cacheKey, transformedData);
      return transformedData;
    }

    const cacheKey = `user_${userId}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.get(ENDPOINTS.STORIES.USER(userId));
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Create a new story
   */
  async createStory(storyData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const newStory = {
        id: Date.now(),
        user_id: 1,
        user_name: 'Você',
        user_avatar: null,
        stories: [{
          id: Date.now() + 1,
          media_url: storyData.image || storyData.video || null,
          media_type: storyData.image ? 'image' : storyData.video ? 'video' : 'text',
          text_content: storyData.text || '',
          background_color: storyData.backgroundColor || null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          views_count: 0,
          reply_count: 0,
          reaction_count: 0,
          viewed: false,
        }],
      };
      // Also add to mockFeed in original format for compatibility
      const mockFormatStory = {
        id: newStory.id,
        user: { id: 1, name: 'Você', avatar: null },
        items: newStory.stories.map(s => ({
          id: s.id,
          type: s.media_type,
          url: s.media_url,
          text: s.text_content,
          backgroundColor: s.background_color,
          createdAt: s.created_at,
          viewed: s.viewed,
        })),
        createdAt: newStory.stories[0].created_at,
        expiresAt: newStory.stories[0].expires_at,
        viewsCount: 0,
        hasUnviewed: true,
      };
      this.mockFeed.unshift(mockFormatStory);
      this.invalidateCache();
      return newStory;
    }

    // For file uploads, we need FormData
    const formData = new FormData();
    if (storyData.image) formData.append('image', storyData.image);
    if (storyData.video) formData.append('video', storyData.video);
    if (storyData.text) formData.append('text', storyData.text);
    if (storyData.backgroundColor) formData.append('backgroundColor', storyData.backgroundColor);
    if (storyData.privacy) formData.append('privacy', storyData.privacy);

    const url = this.buildUrl(ENDPOINTS.STORIES.CREATE);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Mark story as viewed
   */
  async viewStory(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      // Update mock data
      this.mockFeed.forEach(group => {
        group.items.forEach(item => {
          if (item.id === storyId) {
            item.viewed = true;
          }
        });
        group.hasUnviewed = group.items.some(item => !item.viewed);
      });
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.STORIES.VIEW(storyId), {});
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      this.mockFeed = this.mockFeed.filter(group =>
        !group.items.some(item => item.id === storyId)
      );
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.STORIES.BASE}/${storyId}`);
  }

  /**
   * Get story viewers
   */
  async getStoryViewers(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return [
        { id: 2, name: 'Maria Silva', avatar: null, username: 'maria.silva', viewed_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 3, name: 'João Santos', avatar: null, username: 'joao.santos', viewed_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 4, name: 'Ana Carolina Oliveira', avatar: null, username: 'ana.oliveira', viewed_at: new Date(Date.now() - 10800000).toISOString() },
      ];
    }

    return this.get(`${ENDPOINTS.STORIES.BASE}/${storyId}/viewers`);
  }

  /**
   * Get user highlights
   */
  async getUserHighlights(userId, forceRefresh = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cacheKey = `highlights_${userId}`;
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      const data = this.mockHighlights[userId] || [];
      this.setCache(cacheKey, data);
      return data;
    }

    const cacheKey = `highlights_${userId}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.get(ENDPOINTS.STORIES.HIGHLIGHTS(userId));
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Create a new highlight
   */
  async createHighlight(userId, highlightData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const newHighlight = {
        id: Date.now(),
        userId,
        ...highlightData,
        stories: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!this.mockHighlights[userId]) {
        this.mockHighlights[userId] = [];
      }
      this.mockHighlights[userId].push(newHighlight);
      this.invalidateCache();
      return newHighlight;
    }

    return this.post(ENDPOINTS.STORIES.CREATE_HIGHLIGHT(userId), highlightData);
  }

  /**
   * Update a highlight
   */
  async updateHighlight(highlightId, highlightData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      for (const userId in this.mockHighlights) {
        const index = this.mockHighlights[userId].findIndex(h => h.id === highlightId);
        if (index !== -1) {
          this.mockHighlights[userId][index] = {
            ...this.mockHighlights[userId][index],
            ...highlightData,
            updatedAt: new Date().toISOString(),
          };
          this.invalidateCache();
          return this.mockHighlights[userId][index];
        }
      }
      throw new Error('Highlight não encontrado');
    }

    return this.put(ENDPOINTS.STORIES.UPDATE_HIGHLIGHT(highlightId), highlightData);
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(highlightId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const userId in this.mockHighlights) {
        const index = this.mockHighlights[userId].findIndex(h => h.id === highlightId);
        if (index !== -1) {
          this.mockHighlights[userId].splice(index, 1);
          this.invalidateCache();
          return { success: true };
        }
      }
      throw new Error('Highlight não encontrado');
    }

    return this.delete(ENDPOINTS.STORIES.DELETE_HIGHLIGHT(highlightId));
  }

  /**
   * Add stories to a highlight
   */
  async addStoriesToHighlight(highlightId, storyIds) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const userId in this.mockHighlights) {
        const highlight = this.mockHighlights[userId].find(h => h.id === highlightId);
        if (highlight) {
          highlight.stories = [...new Set([...highlight.stories, ...storyIds])];
          highlight.updatedAt = new Date().toISOString();
          this.invalidateCache();
          return highlight;
        }
      }
      throw new Error('Highlight não encontrado');
    }

    return this.post(ENDPOINTS.STORIES.ADD_TO_HIGHLIGHT(highlightId), { storyIds });
  }

  /**
   * Remove story from highlight
   */
  async removeStoryFromHighlight(highlightId, storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const userId in this.mockHighlights) {
        const highlight = this.mockHighlights[userId].find(h => h.id === highlightId);
        if (highlight) {
          highlight.stories = highlight.stories.filter(id => id !== storyId);
          highlight.updatedAt = new Date().toISOString();
          this.invalidateCache();
          return highlight;
        }
      }
      throw new Error('Highlight não encontrado');
    }

    return this.delete(`${ENDPOINTS.STORIES.REMOVE_FROM_HIGHLIGHT(highlightId)}/${storyId}`);
  }

  /**
   * Search users for mentions
   */
  async searchUsersForMentions(query) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      const mockUsers = [
        { id: 2, name: 'Maria Silva', avatar: null },
        { id: 3, name: 'João Santos', avatar: null },
        { id: 4, name: 'Ana Carolina Oliveira', avatar: null },
        { id: 5, name: 'Pedro Henrique', avatar: null },
        { id: 6, name: 'Fernanda Lima Costa', avatar: null },
      ];
      return mockUsers.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
    }

    return this.get(`${ENDPOINTS.STORIES.MENTIONS_SEARCH}?q=${encodeURIComponent(query)}&limit=10`);
  }

  /**
   * Mark story as viewed
   */
  async viewStory(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      this.mockFeed.forEach(group => {
        group.items.forEach(item => {
          if (item.id === storyId) {
            item.viewed = true;
          }
        });
        group.hasUnviewed = group.items.some(item => !item.viewed);
      });
      this.invalidateCache();
      return { success: true };
    }

    return this.post(`${ENDPOINTS.STORIES.BASE}/${storyId}/view`, {});
  }

  /**
   * Get story viewers (owner only)
   */
  async getStoryViewers(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return mockStoryViewers;
    }

    return this.get(`${ENDPOINTS.STORIES.BASE}/${storyId}/viewers`);
  }

  /**
   * Get story reactions
   */
  async getStoryReactions(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return mockStoryReactions;
    }

    return this.get(`${ENDPOINTS.STORIES.BASE}/${storyId}/reactions`);
  }

  /**
   * Add/remove reaction to story
   */
  async reactToStory(storyId, reactionType) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const reaction = mockStoryReactions.find(r => r.type === reactionType);
      if (reaction) {
        reaction.count++;
        reaction.users.push({ id: 1, name: 'Você', avatar: null });
      } else {
        mockStoryReactions.push({ type: reactionType, count: 1, users: [{ id: 1, name: 'Você', avatar: null }] });
      }
      this.invalidateCache();
      return { success: true, action: 'added' };
    }

    return this.post(`${ENDPOINTS.STORIES.BASE}/${storyId}/react`, { reaction_type: reactionType });
  }

  /**
   * Get story replies
   */
  async getStoryReplies(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return mockStoryReplies;
    }

    return this.get(`${ENDPOINTS.STORIES.BASE}/${storyId}/replies`);
  }

  /**
   * Reply to story
   */
  async replyToStory(storyId, content) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const newReply = {
        id: Date.now(),
        story_id: storyId,
        user_id: 1,
        content,
        created_at: new Date().toISOString(),
        name: 'Você',
        avatar: null,
        username: 'voce',
      };
      mockStoryReplies.push(newReply);
      this.invalidateCache();
      return { id: newReply.id };
    }

    return this.post(`${ENDPOINTS.STORIES.BASE}/${storyId}/reply`, { content });
  }

  /**
   * Get privacy exceptions for a story
   */
  async getPrivacyExceptions(storyId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 150));
      return [];
    }

    return this.get(`${ENDPOINTS.STORIES.BASE}/${storyId}/privacy-exceptions`);
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

  // Invalidate cache on story changes
  invalidateCache() {
    this.clearCache();
  }
}

export const storiesService = new StoriesService();
export default storiesService;