/**
 * Base Service Class
 * Provides common functionality for all API services including:
 * - Centralized error handling
 * - Loading states management
 * - Request/response interceptors
 * - Pagination support
 * - Mock/real API switching
 */

import { USE_MOCK, API_URL, getAuthHeader } from '../config/api';

class BaseService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.loading = false;
    this.error = null;
    this.listeners = new Set();
  }

  /**
   * Notify all listeners of state changes
   */
  notify() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current service state
   */
  getState() {
    return {
      loading: this.loading,
      error: this.error,
    };
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.loading = loading;
    this.notify();
  }

  /**
   * Set error state
   */
  setError(error) {
    this.error = error;
    this.notify();
  }

  /**
   * Clear error state
   */
  clearError() {
    this.error = null;
    this.notify();
  }

  /**
   * Build full URL for endpoint
   */
  buildUrl(endpoint) {
    return `${API_URL}${endpoint}`;
  }

  /**
   * Default headers for authenticated requests
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    };
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Generic GET request
   */
  async get(endpoint, options = {}) {
    this.setLoading(true);
    this.clearError();

    try {
      const url = this.buildUrl(endpoint);
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        ...options,
      });
      const data = await this.handleResponse(response);
      this.setLoading(false);
      return data;
    } catch (error) {
      this.setError(error.message);
      this.setLoading(false);
      throw error;
    }
  }

  /**
   * Generic POST request
   */
  async post(endpoint, body, options = {}) {
    this.setLoading(true);
    this.clearError();

    try {
      const url = this.buildUrl(endpoint);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        ...options,
      });
      const data = await this.handleResponse(response);
      this.setLoading(false);
      return data;
    } catch (error) {
      this.setError(error.message);
      this.setLoading(false);
      throw error;
    }
  }

  /**
   * Generic PUT request
   */
  async put(endpoint, body, options = {}) {
    this.setLoading(true);
    this.clearError();

    try {
      const url = this.buildUrl(endpoint);
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        ...options,
      });
      const data = await this.handleResponse(response);
      this.setLoading(false);
      return data;
    } catch (error) {
      this.setError(error.message);
      this.setLoading(false);
      throw error;
    }
  }

  /**
   * Generic PATCH request
   */
  async patch(endpoint, body, options = {}) {
    this.setLoading(true);
    this.clearError();

    try {
      const url = this.buildUrl(endpoint);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        ...options,
      });
      const data = await this.handleResponse(response);
      this.setLoading(false);
      return data;
    } catch (error) {
      this.setError(error.message);
      this.setLoading(false);
      throw error;
    }
  }

  /**
   * Generic DELETE request
   */
  async delete(endpoint, options = {}) {
    this.setLoading(true);
    this.clearError();

    try {
      const url = this.buildUrl(endpoint);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        ...options,
      });
      const data = await this.handleResponse(response);
      this.setLoading(false);
      return data;
    } catch (error) {
      this.setError(error.message);
      this.setLoading(false);
      throw error;
    }
  }

  /**
   * Paginated GET request
   * @param {string} endpoint - Base endpoint
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async getPaginated(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.get(url);
  }

  /**
   * Upload file
   */
  async upload(endpoint, file) {
    this.setLoading(true);
    this.clearError();

    try {
      const url = this.buildUrl(endpoint);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeader(), // Don't set Content-Type for FormData
        body: formData,
      });

      const data = await this.handleResponse(response);
      this.setLoading(false);
      return data;
    } catch (error) {
      this.setError(error.message);
      this.setLoading(false);
      throw error;
    }
  }

  /**
   * Check if mock mode is enabled
   */
  isMockMode() {
    return USE_MOCK;
  }
}

export default BaseService;