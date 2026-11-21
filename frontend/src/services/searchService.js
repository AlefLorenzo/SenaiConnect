/**
 * Search Service
 * Handles search and discovery API calls with mock support
 */

import BaseService from './baseService';
import { ENDPOINTS } from '../config/api';
import { mockProfiles } from '../mock/mockProfiles';
import { mockPosts } from '../mock/mockPosts';

// Convert mockProfiles object to array
const mockProfilesArray = Object.values(mockProfiles);

class SearchService extends BaseService {
  constructor() {
    super('search');
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get search suggestions (people, projects, opportunities, questions)
   */
  async getSuggestions(forceRefresh = false) {
    const cacheKey = 'suggestions';
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetSuggestions();
    }

    const data = await this.get(ENDPOINTS.SEARCH.PANEL);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Search for users, posts, groups
   */
  async search(query, type = 'all', params = {}) {
    if (!query.trim()) {
      return { users: [], posts: [], groups: [] };
    }

    if (this.isMockMode()) {
      return this.mockSearch(query, type);
    }

    const searchParams = { q: query, type, ...params };
    const queryString = new URLSearchParams(searchParams).toString();
    const url = `${ENDPOINTS.SEARCH.BASE}?${queryString}`;
    return this.get(url);
  }

  /**
   * Search users specifically
   */
  async searchUsers(query, params = {}) {
    return this.search(query, 'users', params);
  }

  /**
   * Search posts specifically
   */
  async searchPosts(query, params = {}) {
    return this.search(query, 'posts', params);
  }

  /**
   * Search groups specifically
   */
  async searchGroups(query, params = {}) {
    return this.search(query, 'groups', params);
  }

  // ============ MOCK IMPLEMENTATIONS ============

  mockGetSuggestions() {
    return new Promise(resolve => {
      setTimeout(() => {
        // Get current user from mock profiles (id: 1 is typically the current user)
        const currentUser = mockProfilesArray.find(p => p.id === 1);
        const currentUserCourse = currentUser?.course || 'Técnico em Informática';
        const currentUserUnit = currentUser?.unit || 'SENAI São Paulo';

        // Filter people: exclude current user, prioritize same course/unit
        const otherPeople = mockProfilesArray
          .filter(p => p.id !== 1)
          .sort((a, b) => {
            // Prioritize same course
            const aSameCourse = a.course === currentUserCourse ? 1 : 0;
            const bSameCourse = b.course === currentUserCourse ? 1 : 0;
            if (aSameCourse !== bSameCourse) return bSameCourse - aSameCourse;
            // Then same unit
            const aSameUnit = a.unit === currentUserUnit ? 1 : 0;
            const bSameUnit = b.unit === currentUserUnit ? 1 : 0;
            return bSameUnit - aSameUnit;
          })
          .slice(0, 10);

        // Get recent posts for opportunities (job posts)
        const opportunities = mockPosts
          .filter(p => p.content?.toLowerCase().includes('vaga') ||
                       p.content?.toLowerCase().includes('oportunidade') ||
                       p.content?.toLowerCase().includes('estágio') ||
                       p.content?.toLowerCase().includes('emprego') ||
                       p.hashtags?.some(h => ['vaga', 'oportunidade', 'estagio', 'emprego', 'job'].includes(h.toLowerCase())))
          .slice(0, 5);

        // Get recent posts for projects
        const projects = mockPosts
          .filter(p => p.content?.toLowerCase().includes('projeto') ||
                       p.content?.toLowerCase().includes('project') ||
                       p.hashtags?.some(h => ['projeto', 'project', 'dev', 'desenvolvimento'].includes(h.toLowerCase())))
          .slice(0, 5);

        // Get recent posts for questions
        const questions = mockPosts
          .filter(p => p.content?.includes('?') ||
                       p.content?.toLowerCase().includes('dúvida') ||
                       p.content?.toLowerCase().includes('duvida') ||
                       p.content?.toLowerCase().includes('ajuda') ||
                       p.content?.toLowerCase().includes('como') ||
                       p.hashtags?.some(h => ['duvida', 'dúvida', 'ajuda', 'help', 'pergunta'].includes(h.toLowerCase())))
          .slice(0, 5);

        const data = {
          people: otherPeople,
          projects,
          opportunities,
          questions,
        };

        this.setCache('suggestions', data);
        resolve(data);
      }, 300);
    });
  }

  mockSearch(query, type) {
    return new Promise(resolve => {
      setTimeout(() => {
        const lowerQuery = query.toLowerCase();
        let users = [];
        let posts = [];
        let groups = [];

        if (type === 'all' || type === 'users') {
          users = mockProfilesArray
            .filter(p => p.id !== 1) // Exclude current user
            .filter(p =>
              p.name?.toLowerCase().includes(lowerQuery) ||
              p.course?.toLowerCase().includes(lowerQuery) ||
              p.unit?.toLowerCase().includes(lowerQuery) ||
              p.bio?.toLowerCase().includes(lowerQuery) ||
              p.skills?.some(s => s.toLowerCase().includes(lowerQuery))
            )
            .slice(0, 20);
        }

        if (type === 'all' || type === 'posts') {
          posts = mockPosts
            .filter(p =>
              p.content?.toLowerCase().includes(lowerQuery) ||
              p.hashtags?.some(h => h.toLowerCase().includes(lowerQuery)) ||
              p.user?.name?.toLowerCase().includes(lowerQuery)
            )
            .slice(0, 20);
        }

        // Mock groups search - return empty for now
        groups = [];

        resolve({ users, posts, groups });
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
}

export const searchService = new SearchService();
export default searchService;