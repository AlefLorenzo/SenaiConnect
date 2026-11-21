import { API_URL, getAuthHeader } from '../config/api';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Falha na API (${response.status})`);
  return data;
}

function normalizePost(row) {
  const user = row.user || {
    id: row.user_id,
    name: row.user_name || 'Usuário',
    avatar: row.user_avatar || null,
    role: row.user_role || 'aluno',
    isVerified: Boolean(row.is_verified),
  };
  return {
    ...row,
    user,
    is_liked: Boolean(row.is_liked ?? row.liked),
    is_saved: Boolean(row.is_saved ?? row.saved),
    likes_count: Number(row.likes_count || 0),
    comments_count: Number(row.comments_count || 0),
  };
}

class PostsService {
  constructor() {
    this.posts = [];
    this.listeners = new Set();
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.posts));
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async getFeed() {
    const rows = await request('/api/posts');
    this.posts = (Array.isArray(rows) ? rows : rows.data || []).map(normalizePost);
    return { posts: this.posts, total: this.posts.length, page: 1, limit: this.posts.length, hasMore: false };
  }

  async getUserPosts(userId) {
    const rows = await request(`/api/users/${encodeURIComponent(userId)}/posts`);
    return (Array.isArray(rows) ? rows : rows.data || []).map(normalizePost);
  }

  async getPost(postId) {
    const { posts } = await this.getFeed();
    const post = posts.find((item) => String(item.id) === String(postId));
    if (!post) throw new Error('Publicação não encontrada.');
    return post;
  }

  async createPost(postData) {
    if (!postData.content?.trim() && !postData.attachment_url) {
      throw new Error('Escreva algo ou anexe uma imagem antes de publicar.');
    }
    await request('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        content: postData.content || '',
        attachment_url: postData.attachment_url || null,
        attachment_type: postData.attachment_type || null,
        attachment_name: postData.attachment_name || null,
      }),
    });
    await this.getFeed();
    this.notify();
    return this.posts[0] || null;
  }

  async updatePost(postId, updates) {
    await request(`/api/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    await this.getFeed();
    this.notify();
    return this.posts.find((post) => String(post.id) === String(postId));
  }

  async deletePost(postId) {
    await request(`/api/posts/${postId}`, { method: 'DELETE' });
    this.posts = this.posts.filter((post) => String(post.id) !== String(postId));
    this.notify();
    return { success: true };
  }

  async toggleLike(postId) {
    const result = await request(`/api/posts/${postId}/like`, { method: 'POST', body: '{}' });
    const post = this.posts.find((item) => String(item.id) === String(postId));
    if (post) {
      post.is_liked = Boolean(result.liked);
      post.likes_count = Number(result.likes_count ?? Math.max(0, post.likes_count + (post.is_liked ? 1 : -1)));
      this.notify();
      return { is_liked: post.is_liked, likes_count: post.likes_count };
    }
    await this.getFeed();
    return { is_liked: Boolean(result.liked), likes_count: this.posts.find((item) => String(item.id) === String(postId))?.likes_count || 0 };
  }

  async toggleSave(postId) {
    const result = await request(`/api/posts/${postId}/save`, { method: 'POST', body: '{}' });
    const post = this.posts.find((item) => String(item.id) === String(postId));
    if (post) post.is_saved = Boolean(result.saved);
    this.notify();
    return { is_saved: Boolean(result.saved) };
  }

  async getSavedPosts(userId) {
    const rows = await request(`/api/users/${encodeURIComponent(userId)}/saved`);
    return (Array.isArray(rows) ? rows : rows.data || []).map(normalizePost);
  }

  async searchPosts(query) {
    const { posts } = await this.getFeed();
    const needle = String(query || '').toLocaleLowerCase('pt-BR');
    return { posts: posts.filter((post) => (post.content || '').toLocaleLowerCase('pt-BR').includes(needle)) };
  }
}

export const postsService = new PostsService();
export default PostsService;
