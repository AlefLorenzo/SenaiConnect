/**
 * Posts Service
 * Mock implementation using mockPosts.js data
 */

import { mockPosts, mockUserPosts, mockEdgeCasePosts } from '../mock/mockPosts';

class PostsService {
  constructor() {
    // Store posts in memory for mutations (like, save, create)
    this.posts = [...mockPosts];
    this.listeners = new Set();
  }

  // Notify all listeners of changes
  notify() {
    this.listeners.forEach(cb => cb(this.posts));
  }

  // Subscribe to changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Get feed posts (for home page)
  async getFeed(params = {}) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const { page = 1, limit = 10 } = params;
    const start = (page - 1) * limit;
    const end = start + limit;

    // Return posts sorted by created_at descending (newest first)
    const sortedPosts = [...this.posts].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    return {
      posts: sortedPosts.slice(start, end),
      total: sortedPosts.length,
      page,
      limit,
      hasMore: end < sortedPosts.length
    };
  }

  // Get posts by user ID
  async getUserPosts(userId) {
    await new Promise(resolve => setTimeout(resolve, 200));

    const userPosts = mockUserPosts[userId] || [];
    return userPosts.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  // Get single post by ID
  async getPost(postId) {
    await new Promise(resolve => setTimeout(resolve, 150));

    const post = this.posts.find(p => p.id === postId);
    if (!post) {
      throw new Error('Post não encontrado');
    }
    return post;
  }

  // Create a new post
  async createPost(postData) {
    await new Promise(resolve => setTimeout(resolve, 500));

    const newPost = {
      id: Date.now(), // Simple ID generation
      user_id: postData.user_id || 1, // Default to current user
      user: postData.user || {
        id: 1,
        name: 'Usuário Atual',
        avatar: null,
        role: 'aluno',
        isVerified: true
      },
      content: postData.content,
      attachment_url: postData.attachment_url || null,
      attachment_type: postData.attachment_type || null,
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      is_liked: false,
      is_saved: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add to beginning of posts array
    this.posts.unshift(newPost);
    this.notify();

    return newPost;
  }

  // Update post
  async updatePost(postId, updates) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const index = this.posts.findIndex(p => p.id === postId);
    if (index === -1) {
      throw new Error('Post não encontrado');
    }

    this.posts[index] = {
      ...this.posts[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.notify();

    return this.posts[index];
  }

  // Delete post
  async deletePost(postId) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const index = this.posts.findIndex(p => p.id === postId);
    if (index === -1) {
      throw new Error('Post não encontrado');
    }

    this.posts.splice(index, 1);
    this.notify();

    return { success: true };
  }

  // Like/Unlike post
  async toggleLike(postId) {
    await new Promise(resolve => setTimeout(resolve, 100));

    const post = this.posts.find(p => p.id === postId);
    if (!post) {
      throw new Error('Post não encontrado');
    }

    post.is_liked = !post.is_liked;
    post.likes_count += post.is_liked ? 1 : -1;
    this.notify();

    return { is_liked: post.is_liked, likes_count: post.likes_count };
  }

  // Save/Unsave post
  async toggleSave(postId) {
    await new Promise(resolve => setTimeout(resolve, 100));

    const post = this.posts.find(p => p.id === postId);
    if (!post) {
      throw new Error('Post não encontrado');
    }

    post.is_saved = !post.is_saved;
    this.notify();

    return { is_saved: post.is_saved };
  }

  // Share post
  async sharePost(postId) {
    await new Promise(resolve => setTimeout(resolve, 100));

    const post = this.posts.find(p => p.id === postId);
    if (!post) {
      throw new Error('Post não encontrado');
    }

    post.shares_count += 1;
    this.notify();

    return { shares_count: post.shares_count };
  }

  // Get saved posts
  async getSavedPosts() {
    await new Promise(resolve => setTimeout(resolve, 200));

    return this.posts.filter(p => p.is_saved).sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  // Get liked posts
  async getLikedPosts() {
    await new Promise(resolve => setTimeout(resolve, 200));

    return this.posts.filter(p => p.is_liked).sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  // Search posts
  async searchPosts(query, params = {}) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const { page = 1, limit = 10 } = params;
    const start = (page - 1) * limit;
    const end = start + limit;

    const lowerQuery = query.toLowerCase();
    const filtered = this.posts.filter(p =>
      p.content.toLowerCase().includes(lowerQuery) ||
      p.user.name.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      posts: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      hasMore: end < filtered.length
    };
  }
}

// Export singleton instance
export const postsService = new PostsService();

// Also export class for testing
export default PostsService;