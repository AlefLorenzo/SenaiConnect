/**
 * Companies/Business Service
 * Handles business feed, company posts, and enterprise features
 * Only verified/authorized companies can post in the business feed
 */

import BaseService from './baseService';
import { ENDPOINTS } from '../config/api';
import { getAuthHeader } from '../config/api';
import { mockCompanies, mockBusinessPosts, mockCategories, mockBusinessStories } from '../mock/mockCompanies';

class CompaniesService extends BaseService {
  constructor() {
    super('companies');
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get business feed (posts from verified companies)
   */
  async getBusinessFeed(params = {}) {
    const cacheKey = `business_feed_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetBusinessFeed(params);
    }

    const data = await this.getPaginated(ENDPOINTS.COMPANIES.FEED, params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get company categories for filtering
   */
  async getCategories() {
    const cacheKey = 'categories';
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetCategories();
    }

    const data = await this.get(ENDPOINTS.COMPANIES.CATEGORIES);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get verified companies list
   */
  async getVerifiedCompanies(params = {}) {
    const cacheKey = `verified_companies_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetVerifiedCompanies(params);
    }

    const data = await this.getPaginated(ENDPOINTS.COMPANIES.BASE, params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get company details
   */
  async getCompany(companyId, forceRefresh = false) {
    const cacheKey = `company_${companyId}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetCompany(companyId);
    }

    const data = await this.get(`${ENDPOINTS.COMPANIES.BASE}/${companyId}`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get company posts
   */
  async getCompanyPosts(companyId, params = {}) {
    const cacheKey = `company_posts_${companyId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetCompanyPosts(companyId, params);
    }

    return this.getPaginated(`${ENDPOINTS.COMPANIES.BASE}/${companyId}/posts`, params);
  }

  /**
   * Create a business post (only for verified companies)
   */
  async createBusinessPost(postData) {
    if (this.isMockMode()) {
      return this.mockCreateBusinessPost(postData);
    }

    const formData = new FormData();
    formData.append('content', postData.content);
    formData.append('category', postData.category);
    if (postData.attachments) {
      postData.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }
    if (postData.link) formData.append('link', postData.link);

    const url = this.buildUrl(ENDPOINTS.COMPANIES.CREATE);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Like a business post
   */
  async likeBusinessPost(postId) {
    if (this.isMockMode()) {
      return this.mockLikeBusinessPost(postId);
    }

    return this.post(ENDPOINTS.COMPANIES.LIKE(postId), {});
  }

  /**
   * Comment on a business post
   */
  async commentBusinessPost(postId, content) {
    if (this.isMockMode()) {
      return this.mockCommentBusinessPost(postId, content);
    }

    return this.post(ENDPOINTS.COMPANIES.COMMENT(postId), { content });
  }

  /**
   * Share a business post
   */
  async shareBusinessPost(postId) {
    if (this.isMockMode()) {
      return this.mockShareBusinessPost(postId);
    }

    return this.post(ENDPOINTS.COMPANIES.SHARE(postId), {});
  }

  /**
   * Request verification for company
   */
  async requestVerification(companyData) {
    if (this.isMockMode()) {
      return this.mockRequestVerification(companyData);
    }

    const formData = new FormData();
    Object.entries(companyData).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, value);
    });

    const url = this.buildUrl(ENDPOINTS.COMPANIES.VERIFY(companyData.id));
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });
    return this.handleResponse(response);
  }

  /**
   * Follow/Unfollow a company
   */
  async toggleFollowCompany(companyId, follow) {
    if (this.isMockMode()) {
      return this.mockToggleFollowCompany(companyId, follow);
    }

    return follow
      ? this.post(`${ENDPOINTS.COMPANIES.BASE}/${companyId}/follow`)
      : this.delete(`${ENDPOINTS.COMPANIES.BASE}/${companyId}/follow`);
  }

  // Mock implementations
  mockGetBusinessFeed(params) {
    return new Promise(resolve => {
      setTimeout(() => {
        let posts = [...mockBusinessPosts];
        if (params.category) {
          posts = posts.filter(p => p.category === params.category);
        }
        if (params.companyId) {
          posts = posts.filter(p => p.companyId === parseInt(params.companyId));
        }
        if (params.search) {
          const search = params.search.toLowerCase();
          posts = posts.filter(p =>
            p.content.toLowerCase().includes(search) ||
            p.companyName.toLowerCase().includes(search)
          );
        }
        // Sort by date (newest first)
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const page = params.page || 1;
        const limit = params.limit || 10;
        const start = (page - 1) * limit;
        const end = start + limit;

        resolve({
          data: posts.slice(start, end),
          pagination: { page, limit, total: posts.length, hasMore: end < posts.length }
        });
      }, 300);
    });
  }

  mockGetCategories() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(mockCategories);
      }, 200);
    });
  }

  mockGetVerifiedCompanies(params) {
    return new Promise(resolve => {
      setTimeout(() => {
        let companies = mockCompanies.filter(c => c.verified);
        if (params.category) {
          companies = companies.filter(c => c.category === params.category);
        }
        if (params.search) {
          const search = params.search.toLowerCase();
          companies = companies.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.description?.toLowerCase().includes(search)
          );
        }
        resolve({
          data: companies,
          pagination: { page: params.page || 1, limit: params.limit || 20, total: companies.length }
        });
      }, 300);
    });
  }

  mockGetCompany(companyId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const company = mockCompanies.find(c => c.id === parseInt(companyId));
        if (company) {
          resolve(company);
        } else {
          reject(new Error('Empresa não encontrada'));
        }
      }, 200);
    });
  }

  mockGetCompanyPosts(companyId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        const posts = mockBusinessPosts.filter(p => p.companyId === parseInt(companyId));
        const page = params.page || 1;
        const limit = params.limit || 10;
        const start = (page - 1) * limit;
        const end = start + limit;
        resolve({
          data: posts.slice(start, end),
          pagination: { page, limit, total: posts.length, hasMore: end < posts.length }
        });
      }, 300);
    });
  }

  mockCreateBusinessPost(postData) {
    return new Promise(resolve => {
      setTimeout(() => {
        // In mock mode, we simulate a verified company posting
        const company = mockCompanies.find(c => c.id === 1); // Current user's company
        const newPost = {
          id: Date.now(),
          companyId: company?.id || 1,
          companyName: company?.name || 'Empresa Demo',
          companyLogo: company?.logo,
          companyVerified: company?.verified || true,
          content: postData.content,
          category: postData.category,
          attachments: postData.attachments || [],
          link: postData.link,
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };
        mockBusinessPosts.unshift(newPost);
        resolve(newPost);
      }, 500);
    });
  }

  mockLikeBusinessPost(postId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const post = mockBusinessPosts.find(p => p.id === parseInt(postId));
        if (post) {
          post.isLiked = !post.isLiked;
          post.likesCount += post.isLiked ? 1 : -1;
          resolve({ success: true, liked: post.isLiked, likesCount: post.likesCount });
        } else {
          reject(new Error('Post não encontrado'));
        }
      }, 200);
    });
  }

  mockCommentBusinessPost(postId, content) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const post = mockBusinessPosts.find(p => p.id === parseInt(postId));
        if (post) {
          const comment = {
            id: Date.now(),
            postId: parseInt(postId),
            authorId: 1,
            authorName: 'Você',
            authorAvatar: null,
            content,
            createdAt: new Date().toISOString(),
          };
          if (!post.comments) post.comments = [];
          post.comments.push(comment);
          post.commentsCount++;
          resolve({ success: true, comment });
        } else {
          reject(new Error('Post não encontrado'));
        }
      }, 300);
    });
  }

  mockShareBusinessPost(postId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const post = mockBusinessPosts.find(p => p.id === parseInt(postId));
        if (post) {
          post.sharesCount++;
          resolve({ success: true, sharesCount: post.sharesCount });
        } else {
          reject(new Error('Post não encontrado'));
        }
      }, 200);
    });
  }

  mockRequestVerification() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Solicitação de verificação enviada. Você receberá uma resposta em até 5 dias úteis.',
          requestId: Date.now(),
        });
      }, 500);
    });
  }

  mockToggleFollowCompany(companyId, follow) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const company = mockCompanies.find(c => c.id === parseInt(companyId));
        if (company) {
          company.isFollowed = follow;
          company.followersCount += follow ? 1 : -1;
          resolve({ success: true, followed: follow, followersCount: company.followersCount });
        } else {
          reject(new Error('Empresa não encontrada'));
        }
      }, 200);
    });
  }

  /**
   * Get business post status (liked, saved)
   */
  async getBusinessPostStatus(postId) {
    const cacheKey = `business_post_status_${postId}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetBusinessPostStatus(postId);
    }

    const data = await this.get(`${ENDPOINTS.COMPANIES.BASE}/posts/${postId}/status`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Save/unsave a business post
   */
  async saveBusinessPost(postId) {
    if (this.isMockMode()) {
      return this.mockSaveBusinessPost(postId);
    }

    return this.post(`${ENDPOINTS.COMPANIES.BASE}/posts/${postId}/save`, {});
  }

  /**
   * Get business post comments
   */
  async getBusinessPostComments(postId, params = {}) {
    const cacheKey = `business_post_comments_${postId}_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetBusinessPostComments(postId, params);
    }

    const data = await this.get(`${ENDPOINTS.COMPANIES.BASE}/posts/${postId}/comments`, params);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Delete a business post comment
   */
  async deleteBusinessPostComment(commentId) {
    if (this.isMockMode()) {
      return this.mockDeleteBusinessPostComment(commentId);
    }

    return this.delete(`${ENDPOINTS.COMPANIES.BASE}/posts/comments/${commentId}`);
  }

  /**
   * Report a business post
   */
  async reportBusinessPost(reportData) {
    if (this.isMockMode()) {
      return this.mockReportBusinessPost(reportData);
    }

    return this.post(`${ENDPOINTS.COMPANIES.BASE}/reports`, reportData);
  }

  /**
   * Get business stories
   */
  async getBusinessStories(params = {}) {
    const cacheKey = `business_stories_${JSON.stringify(params)}`;
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (this.isMockMode()) {
      return this.mockGetBusinessStories(params);
    }

    const data = await this.get(ENDPOINTS.COMPANIES.STORIES, params);
    this.setCache(cacheKey, data);
    return data;
  }

  // Mock implementations for business stories
  mockGetBusinessStories(params) {
    return new Promise(resolve => {
      setTimeout(() => {
        // Filter only verified companies' stories
        let stories = mockBusinessStories.filter(s => {
          const company = mockCompanies.find(c => c.id === s.business_id);
          return company?.verified;
        });

        if (params.companyId) {
          stories = stories.filter(s => s.business_id === parseInt(params.companyId));
        }

        resolve(stories);
      }, 300);
    });
  }

  // Mock implementations for business post status and interactions
  mockGetBusinessPostStatus(postId) {
    return new Promise(resolve => {
      setTimeout(() => {
        // In mock mode, we simulate some posts as liked/saved
        const post = mockBusinessPosts.find(p => p.id === parseInt(postId));
        resolve({
          liked: post?.isLiked || false,
          saved: post?.isSaved || false,
        });
      }, 200);
    });
  }

  mockSaveBusinessPost(postId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const post = mockBusinessPosts.find(p => p.id === parseInt(postId));
        if (post) {
          post.isSaved = !post.isSaved;
          // Note: we don't track save count in mock data
          resolve({ success: true, saved: post.isSaved });
        } else {
          reject(new Error('Post não encontrado'));
        }
      }, 200);
    });
  }

  mockGetBusinessPostComments(postId, params) {
    return new Promise(resolve => {
      setTimeout(() => {
        const post = mockBusinessPosts.find(p => p.id === parseInt(postId));
        if (post && post.comments) {
          resolve(post.comments);
        } else {
          resolve([]);
        }
      }, 300);
    });
  }

  mockDeleteBusinessPostComment(commentId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Find and remove comment from all posts
        for (const post of mockBusinessPosts) {
          if (post.comments) {
            const idx = post.comments.findIndex(c => c.id === parseInt(commentId));
            if (idx !== -1) {
              post.comments.splice(idx, 1);
              post.commentsCount--;
              resolve({ success: true });
              return;
            }
          }
        }
        reject(new Error('Comentário não encontrado'));
      }, 200);
    });
  }

  mockReportBusinessPost(reportData) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Denúncia enviada com sucesso',
          reportId: Date.now(),
        });
      }, 500);
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

export const companiesService = new CompaniesService();
export default companiesService;