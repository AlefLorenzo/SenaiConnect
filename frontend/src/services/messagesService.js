/**
 * Messages Service
 * Handles all messaging-related API calls with mock mode support
 * Supports both individual conversations and group chats
 */

import BaseService from './baseService';
import { ENDPOINTS } from '../config/api';
import { getAuthHeader } from '../config/api';
import { USE_MOCK } from '../config/api';
import { mockConversations, mockMessages } from '../mock/mockMessages';

function createClientMessageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

class MessagesService extends BaseService {
  constructor() {
    super('messages');
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
    this.typingTimers = new Map();
    this.offlineQueue = [];
    this.isProcessingQueue = false;
    this.loadOfflineQueue();
    // Mock data state for mutations
    // Separate individual and group conversations from the single mockConversations array
    this.mockIndividualConversations = mockConversations.filter(c => !c.isGroup);
    this.mockGroupConversations = mockConversations.filter(c => c.isGroup);
    this.mockMessages = { ...mockMessages };
  }

  // ============ OFFLINE QUEUE ============

  /**
   * Load offline queue from localStorage
   */
  loadOfflineQueue() {
    try {
      const stored = localStorage.getItem('messages_offline_queue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
      }
    } catch (err) {
      console.error('Error loading offline queue:', err);
      this.offlineQueue = [];
    }
  }

  /**
   * Save offline queue to localStorage
   */
  saveOfflineQueue() {
    try {
      localStorage.setItem('messages_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (err) {
      console.error('Error saving offline queue:', err);
    }
  }

  /**
   * Add message to offline queue
   * @param {Object} messageData - Message data to queue
   * @returns {string} Queue item ID
   */
  queueMessage(messageData) {
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...messageData,
      clientMessageId: messageData.clientMessageId || messageData.tempId || createClientMessageId(),
      timestamp: Date.now(),
      retries: 0,
      status: 'queued'
    };
    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();
    return queueItem.id;
  }

  /**
   * Get offline queue
   * @returns {Array} Offline queue items
   */
  getOfflineQueue() {
    return [...this.offlineQueue];
  }

  /**
   * Remove item from offline queue
   * @param {string} queueId - Queue item ID
   */
  removeFromOfflineQueue(queueId) {
    this.offlineQueue = this.offlineQueue.filter(item => item.id !== queueId);
    this.saveOfflineQueue();
  }

  /**
   * Update queue item status
   * @param {string} queueId - Queue item ID
   * @param {Object} updates - Status updates
   */
  updateQueueItem(queueId, updates) {
    const index = this.offlineQueue.findIndex(item => item.id === queueId);
    if (index !== -1) {
      this.offlineQueue[index] = { ...this.offlineQueue[index], ...updates };
      this.saveOfflineQueue();
    }
  }

  /**
   * Process offline queue when back online
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Result with sent and failed counts
   */
  async processOfflineQueue(onProgress) {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) {
      return { sent: 0, failed: 0 };
    }

    this.isProcessingQueue = true;
    let sent = 0;
    let failed = 0;

    // Process in order
    for (const item of [...this.offlineQueue]) {
      if (item.retries >= 3) {
        this.updateQueueItem(item.id, { status: 'failed', error: 'Max retries exceeded' });
        failed++;
        continue;
      }

      try {
        this.updateQueueItem(item.id, { status: 'sending', retries: item.retries + 1 });

        // Upload attachments first if any
        let uploadedAttachments = [];
        if (item.attachments && item.attachments.length > 0) {
          for (const attachment of item.attachments) {
            if (attachment.file) {
              const uploadResult = await this.uploadMedia(attachment.file, null, null);
              if (uploadResult) {
                uploadedAttachments.push({
                  mediaUrl: uploadResult.url,
                  messageType: attachment.type,
                  fileName: attachment.name,
                  fileSize: attachment.size,
                  fileType: attachment.file.type
                });
              }
            }
          }
        }

        const messageData = {
          content: item.content,
          type: uploadedAttachments.length > 0 ? uploadedAttachments[0].messageType : item.type || 'text',
          message_type: uploadedAttachments.length > 0 ? uploadedAttachments[0].messageType : item.type || 'text',
          attachments: uploadedAttachments,
          replyTo: item.replyTo,
          clientMessageId: item.clientMessageId || item.tempId || item.id
        };

        const result = await this.sendMessage(item.conversationId, messageData, { retries: 1 });

        if (result) {
          this.removeFromOfflineQueue(item.id);
          sent++;

          // Emit event for UI update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('message_sent_confirmed', {
              detail: { tempId: item.tempId || item.id, message: result }
            }));
          }
        }
      } catch (err) {
        console.error('Failed to send queued message:', err);
        this.updateQueueItem(item.id, { status: 'queued', error: err.message });
        failed++;
      }

      if (onProgress) {
        onProgress({ sent, failed, total: this.offlineQueue.length + sent + failed });
      }
    }

    this.isProcessingQueue = false;
    return { sent, failed };
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue() {
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  /**
   * Retry failed queue item
   * @param {string} queueId - Queue item ID
   */
  async retryQueueItem(queueId) {
    const item = this.offlineQueue.find(i => i.id === queueId);
    if (item) {
      this.updateQueueItem(queueId, { status: 'queued', retries: 0 });
      await this.processOfflineQueue();
    }
  }

  // ============ CONVERSATIONS ============

  /**
   * Get all conversations (individual + groups)
   */
  async getConversations(type = 'all', forceRefresh = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const cacheKey = `conversations_${type}`;
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }

      // Combine individual and group conversations
      const allConversations = [
        ...this.mockIndividualConversations,
        ...this.mockGroupConversations
      ];

      // Filter by type if needed
      let filtered = allConversations;
      if (type === 'individual') {
        filtered = allConversations.filter(c => !c.isGroup);
      } else if (type === 'group') {
        filtered = allConversations.filter(c => c.isGroup);
      }

      // Sort by updatedAt descending
      filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Mock data is already in frontend format, no transformation needed
      this.setCache(cacheKey, filtered);
      return filtered;
    }

    const cacheKey = `conversations_${type}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const params = type !== 'all' ? { type } : {};
    const rawData = await this.getPaginated(ENDPOINTS.MESSAGES.CONVERSATIONS, params);
    const data = this.transformConversations(rawData);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Transform backend conversation data to frontend format
   * Backend returns flat structure for individuals, nested for groups
   */
  transformConversations(rawData) {
    const conversations = rawData.data || rawData;
    return conversations.map(conv => {
      if (conv.isGroup) {
        // Group conversations already have participants array
        // Backend provides senderName in last_message for groups
        return {
          id: conv.conversation_id || conv.id,
          isGroup: true,
          name: conv.name,
          avatar: conv.avatar,
          description: conv.description,
          participants: conv.participants || [],
          adminIds: (conv.admin_ids ?? conv.adminIds) || [],
          last_message: conv.last_message ? {
            content: conv.last_message.content,
            senderName: conv.last_message.senderName,
            type: conv.last_message.type,
            status: conv.last_message.status,
            createdAt: conv.last_message.createdAt
          } : null,
          unreadCount: conv.unread_count || conv.unreadCount || 0,
          updatedAt: conv.last_interaction || conv.updatedAt,
          isPinned: conv.isPinned || false,
          isMuted: conv.isMuted || false,
          isImportant: conv.isImportant || false,
        };
      } else {
        // Individual conversations - use backend's participants array (includes both current user and other user)
        // Backend returns: participants: [{ id: loggedUserId, name: 'Você', ... }, otherUser]
        const participants = conv.participants || [];
        // Find the other participant (not "Você")
        const otherUser = participants.find(p => p.name !== 'Você') || {
          id: conv.id,
          name: conv.name,
          avatar: conv.avatar,
          role: conv.role,
          isOnline: conv.is_online === 1 || conv.is_online === true,
          lastSeen: conv.last_seen,
          lastSeenPrivacy: conv.last_seen_privacy,
        };
        return {
          id: conv.conversation_id,
          isGroup: false,
          participants: participants, // Use backend's participants array
          last_message: conv.last_message ? {
            id: conv.last_message.id,
            senderId: conv.last_message.senderId ?? conv.last_message.sender_id,
            content: conv.last_message.content,
            senderName: conv.last_message.senderName || otherUser.name,
            type: conv.last_message.type || 'text',
            status: conv.last_message.status || 'enviada',
            createdAt: conv.last_message.createdAt || conv.last_interaction
          } : null,
          unreadCount: conv.unread_count || conv.unreadCount || 0,
          updatedAt: conv.last_interaction || conv.updatedAt,
          isPinned: conv.isPinned || false,
          isMuted: conv.isMuted || false,
          isImportant: conv.isImportant || false,
        };
      }
    });
  }

  /**
   * Get a specific conversation
   */
  async getConversation(conversationId, forceRefresh = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cacheKey = `conversation_${conversationId}`;
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      // Find in both arrays - handle both string and number comparison
      const convId = String(conversationId);
      const conv = this.mockIndividualConversations.find(c => String(c.conversation_id) === convId || String(c.id) === convId) ||
                   this.mockGroupConversations.find(c => String(c.conversation_id) === convId || String(c.id) === convId);
      if (!conv) throw new Error('Conversa não encontrada');
      // Mock data is already in frontend format, no transformation needed
      this.setCache(cacheKey, conv);
      return conv;
    }

    const cacheKey = `conversation_${conversationId}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const data = await this.get(ENDPOINTS.MESSAGES.CONVERSATION(conversationId));
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Create a new conversation (individual)
   */
  async createConversation(participantId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));

      // Find the participant from existing conversations' participants
      // The mock data is already in frontend format with participants array
      let participant = null;
      for (const conv of this.mockIndividualConversations) {
        const p = conv.participants?.find(p => p.id === participantId);
        if (p) {
          participant = p;
          break;
        }
      }

      // Also check group conversations for the participant
      if (!participant) {
        for (const conv of this.mockGroupConversations) {
          const p = conv.participants?.find(p => p.id === participantId);
          if (p) {
            participant = p;
            break;
          }
        }
      }

      if (!participant) throw new Error('Usuário não encontrado');

      // Check if conversation already exists
      const existingConv = this.mockIndividualConversations.find(c =>
        !c.isGroup && c.participants?.some(p => p.id === participantId)
      );

      if (existingConv) {
        // Return existing conversation (already in frontend format)
        return existingConv;
      }

      // Create new conversation in frontend format directly
      const conversationId = Date.now();
      const newConv = {
        id: conversationId,
        isGroup: false,
        participants: [
          { id: 1, name: 'Você', avatar: null, isOnline: true }, // Current user
          { ...participant, isOnline: participant.isOnline || false }
        ],
        last_message: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        isPinned: false,
        isMuted: false,
        isImportant: false,
      };

      this.mockIndividualConversations.unshift(newConv);
      this.invalidateCache();
      return newConv;
    }

    return this.post(ENDPOINTS.MESSAGES.CONVERSATIONS, { participantId });
  }

  /**
   * Create a new group conversation
   */
  async createGroup(groupData) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const newGroup = {
        conversation_id: Date.now(),
        id: Date.now(),
        name: groupData.name,
        avatar: groupData.avatar || null,
        description: groupData.description || '',
        participants: [
          { id: 1, name: 'Você', avatar: null, member: { role: 'admin' }, role: 'admin', user_role: 'admin', isOnline: true, joinedAt: new Date().toISOString() },
        ],
        adminIds: [1],
        last_message: null,
        unread_count: 0,
        last_interaction: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isGroup: true,
        isPinned: false,
        isMuted: false,
        isImportant: false,
      };
      this.mockGroupConversations.unshift(newGroup);
      this.invalidateCache();
      return this.transformConversations({ data: [newGroup] })[0];
    }

    return this.post(ENDPOINTS.GROUPS.CREATE, groupData);
  }

  // ============ MESSAGES ============

  /**
   * Get message history for a conversation
   * Backend returns { messages: [...], contact: {...}, isGroup: boolean }
   * We return { data: messages[], contact, isGroup, pagination } for consistency
   */
  async getHistory(conversationId, params = {}) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const { forceRefresh = false, ...queryParams } = params;
      const cacheKey = `history_${conversationId}_${JSON.stringify(queryParams)}`;
      if (!forceRefresh && this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }

      const messages = this.mockMessages[conversationId] || [];
      const isGroup = this.mockGroupConversations.some(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId);
      const contact = isGroup
        ? this.mockGroupConversations.find(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId)
        : this.mockIndividualConversations.find(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId);

      const data = {
        data: messages,
        contact: contact || null,
        isGroup: isGroup,
        pagination: {
          page: params.page || 1,
          limit: params.limit || 50,
          total: messages.length,
          hasMore: false
        }
      };
      this.setCache(cacheKey, data);
      return data;
    }

    const { forceRefresh = false, ...queryParams } = params;
    const cacheKey = `history_${conversationId}_${JSON.stringify(queryParams)}`;
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    const response = await this.getPaginated(ENDPOINTS.MESSAGES.HISTORY(conversationId), queryParams);
    // Backend returns { data: messages[], contact, isGroup, pagination }
    // Transform to expected format
    const messages = response.data || response.messages || [];
    const data = {
      data: messages,
      contact: response.contact || null,
      isGroup: response.isGroup || false,
      pagination: response.pagination || {
        page: params.page || 1,
        limit: params.limit || 50,
        total: messages.length,
        hasMore: false
      }
    };
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Send a message with optional attachments
   */
  async sendMessage(conversationId, messageData, options = {}) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const messages = this.mockMessages[conversationId] || [];
      const newMessage = {
        id: Date.now(),
        conversation_id: parseInt(conversationId),
        sender_id: 1,
        sender_name: 'Você',
        sender_avatar: null,
        content: messageData.content,
        type: messageData.type || 'text',
        message_type: messageData.type || 'text',
        attachments: messageData.attachments || [],
        reply_to: messageData.replyTo || null,
        status: 'sent',
        isOwn: true,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      messages.push(newMessage);
      this.mockMessages[conversationId] = messages;

      // Update conversation last_message and unreadCount
      this.updateConversationLastMessage(conversationId, newMessage);
      this.invalidateCache();

      return newMessage;
    }

    const { retries = 2, retryDelay = 1000 } = options;
    // Generate once, outside the retry loop, so every HTTP retry represents the same message.
    const clientMessageId = messageData.clientMessageId || createClientMessageId();

    const attempt = async (attemptNumber) => {
      const formData = new FormData();
      formData.append('content', messageData.content);
      formData.append('type', messageData.type || 'text');
      formData.append('clientMessageId', clientMessageId);
      if (messageData.replyTo) formData.append('replyTo', messageData.replyTo);
      if (messageData.attachments?.length) {
        // The current messages schema stores one media attachment per message.
        if (messageData.attachments.length > 1) {
          throw new Error('Envie um anexo por mensagem. O armazenamento atual ainda não oferece múltiplos anexos por mensagem.');
        }
        const attachment = messageData.attachments[0];
        // messageController reads flat multipart fields, not nested array keys.
        formData.append('mediaUrl', attachment.mediaUrl || '');
        formData.append('fileName', attachment.fileName || '');
        formData.append('fileSize', String(attachment.fileSize || ''));
        formData.append('fileType', attachment.fileType || '');
      }

      const url = this.buildUrl(ENDPOINTS.MESSAGES.SEND(conversationId));
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData,
      });

      if (!response.ok && attemptNumber < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attemptNumber));
        return attempt(attemptNumber + 1);
      }

      return this.handleResponse(response);
    };

    const result = await attempt(1);
    // Sending changes the inbox ordering and latest-message preview; never reuse stale snapshots.
    this.invalidateCache();
    return result;
  }

  /**
   * Update conversation's last_message and unread count
   */
  updateConversationLastMessage(conversationId, message) {
    // Check individual conversations
    const indIndex = this.mockIndividualConversations.findIndex(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId);
    if (indIndex !== -1) {
      this.mockIndividualConversations[indIndex].last_message = message.content;
      this.mockIndividualConversations[indIndex].last_interaction = message.createdAt;
      this.mockIndividualConversations[indIndex].updatedAt = message.createdAt;
      return;
    }
    // Check group conversations
    const grpIndex = this.mockGroupConversations.findIndex(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId);
    if (grpIndex !== -1) {
      this.mockGroupConversations[grpIndex].last_message = {
        content: message.content,
        senderName: message.sender_name,
        type: message.type,
        status: 'sent',
        createdAt: message.createdAt,
      };
      this.mockGroupConversations[grpIndex].last_interaction = message.createdAt;
      this.mockGroupConversations[grpIndex].updatedAt = message.createdAt;
    }
  }

  /**
   * Upload media (image/document) for message with progress tracking and abort support
   */
  async uploadMedia(file, onProgress, abortSignal) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      // Return a mock upload result with a data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            url: e.target.result,
            messageType: file.type.startsWith('image/') ? 'image' : 'document',
          });
        };
        reader.readAsDataURL(file);
      });
    }

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const url = this.buildUrl(ENDPOINTS.MESSAGES.UPLOAD_MEDIA || '/messages/upload');
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      // Handle abort
      if (abortSignal) {
        if (abortSignal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        abortSignal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error('Resposta inválida do servidor'));
          }
        } else {
          let errorMessage = 'Erro no upload';
          try {
            const error = JSON.parse(xhr.responseText);
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `Erro ${xhr.status}: ${xhr.statusText}`;
          }
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Erro de rede durante o upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new DOMException('Upload cancelado', 'AbortError'));
      });

      xhr.open('POST', url);
      const authHeader = getAuthHeader();
      if (authHeader.Authorization) {
        xhr.setRequestHeader('Authorization', authHeader.Authorization);
      }
      xhr.send(formData);
    });
  }

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      // Find and update unread count
      const indIndex = this.mockIndividualConversations.findIndex(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId);
      if (indIndex !== -1) {
        this.mockIndividualConversations[indIndex].unread_count = 0;
        this.mockIndividualConversations[indIndex].unreadCount = 0;
        this.invalidateCache();
        return { success: true };
      }
      const grpIndex = this.mockGroupConversations.findIndex(c => c.conversation_id === parseInt(conversationId) || c.id === conversationId);
      if (grpIndex !== -1) {
        this.mockGroupConversations[grpIndex].unread_count = 0;
        this.mockGroupConversations[grpIndex].unreadCount = 0;
        this.invalidateCache();
        return { success: true };
      }
      return { success: true };
    }

    return this.post(ENDPOINTS.MESSAGES.READ(conversationId), {});
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId, forEveryone = false) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      // Find and remove message from mock data
      Object.keys(this.mockMessages).forEach(convId => {
        this.mockMessages[convId] = this.mockMessages[convId].filter(m => m.id !== messageId);
      });
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.MESSAGES.BASE}/${messageId}`, {
      body: JSON.stringify({ forEveryone }),
    });
  }

  /**
   * Edit a message
   */
  async editMessage(messageId, content) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      Object.keys(this.mockMessages).forEach(convId => {
        const msg = this.mockMessages[convId].find(m => m.id === messageId);
        if (msg) {
          msg.content = content;
          msg.edited = true;
        }
      });
      this.invalidateCache();
      return { success: true };
    }

    return this.patch(`${ENDPOINTS.MESSAGES.BASE}/${messageId}`, { content });
  }

  // ============ TYPING INDICATORS ============

  /**
   * Send typing start event
   */
  async sendTypingStart(conversationId, receiverId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true };
    }

    return this.post(ENDPOINTS.MESSAGES.TYPING_START(conversationId), { conversationId, receiverId });
  }

  /**
   * Send typing stop event
   */
  async sendTypingStop(conversationId, receiverId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true };
    }

    return this.post(ENDPOINTS.MESSAGES.TYPING_STOP(conversationId), { conversationId, receiverId });
  }

  // ============ GROUPS ============

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
      const data = this.mockGroupConversations;
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
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
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
   * Get group members
   */
  async getGroupMembers(groupId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      return group.participants || [];
    }

    return this.get(ENDPOINTS.GROUPS.MEMBERS(groupId));
  }

  /**
   * Mute/unmute group
   */
  async toggleGroupMute(groupId, mute) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.isMuted = mute;
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.MUTE(groupId), { mute });
  }

  /**
   * Mark group as important
   */
  async toggleGroupImportant(groupId, important) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.isImportant = important;
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.IMPORTANT(groupId), { important });
  }

  /**
   * Leave group
   */
  async leaveGroup(groupId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      this.mockGroupConversations = this.mockGroupConversations.filter(g => g.conversation_id !== parseInt(groupId) && g.id !== groupId);
      this.invalidateCache();
      return { success: true };
    }

    return this.post(ENDPOINTS.GROUPS.LEAVE(groupId), {});
  }

  /**
   * Add members to group
   */
  async addGroupMembers(groupId, userIds) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
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
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      group.participants = group.participants.filter(p => p.id !== userId);
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.GROUPS.BASE}/${groupId}/members/${userId}`);
  }

  /**
   * Add member to group
   */
  async addGroupMember(groupId, userId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return this.addGroupMembers(groupId, [userId]);
    }

    return this.post(`${ENDPOINTS.GROUPS.BASE}/${groupId}/members`, { userId });
  }

  /**
   * Change group admin status
   */
  async changeGroupAdmin(groupId, userId, isAdmin) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      if (isAdmin) {
        if (!group.adminIds.includes(userId)) {
          group.adminIds.push(userId);
        }
        const participant = group.participants.find(p => p.id === userId);
        if (participant) {
          participant.member = { role: 'admin' };
          participant.role = 'admin';
          participant.user_role = 'admin';
        }
      } else {
        group.adminIds = group.adminIds.filter(id => id !== userId);
        const participant = group.participants.find(p => p.id === userId);
        if (participant) {
          participant.member = { role: 'member' };
          participant.role = 'member';
          participant.user_role = 'member';
        }
      }
      this.invalidateCache();
      return { success: true };
    }

    return this.post(`${ENDPOINTS.GROUPS.BASE}/${groupId}/admins`, { userId, isAdmin });
  }

  /**
   * Update group info
   */
  async updateGroup(groupId, data) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const group = this.mockGroupConversations.find(g => g.conversation_id === parseInt(groupId) || g.id === groupId);
      if (!group) throw new Error('Grupo não encontrado');
      Object.assign(group, data);
      group.updatedAt = new Date().toISOString();
      this.invalidateCache();
      return group;
    }

    return this.put(`${ENDPOINTS.GROUPS.BASE}/${groupId}`, data);
  }

  /**
   * Delete group
   */
  async deleteGroup(groupId) {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 200));
      this.mockGroupConversations = this.mockGroupConversations.filter(g => g.conversation_id !== parseInt(groupId) && g.id !== groupId);
      this.invalidateCache();
      return { success: true };
    }

    return this.delete(`${ENDPOINTS.GROUPS.BASE}/${groupId}`);
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

  // Clear cache for specific conversation
  invalidateConversation(conversationId) {
    this.cache.delete(`conversation_${conversationId}`);
    this.cache.delete(`history_${conversationId}_${JSON.stringify({})}`);
  }

  // Invalidate cache on group changes
  invalidateCache() {
    this.clearCache();
  }

  // ============ FILE VALIDATION HELPERS ============

  /**
   * Validate file for upload
   * @param {File} file - File to validate
   * @param {'image'|'document'} type - Type of file
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validateFile(file, type) {
    const FILE_LIMITS = {
      image: {
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']
      },
      document: {
        maxSize: 25 * 1024 * 1024,
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/zip',
          'application/x-zip-compressed'
        ],
        allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.zip']
      }
    };

    const limits = FILE_LIMITS[type];
    const errors = [];

    if (file.size > limits.maxSize) {
      errors.push(`Arquivo muito grande. Máximo: ${type === 'image' ? '10MB' : '25MB'}`);
    }

    const isValidType = limits.allowedTypes.includes(file.type) ||
      limits.allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      errors.push(`Tipo de arquivo não permitido. Tipos aceitos: ${limits.allowedExtensions.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize file name for security
   * @param {string} name - Original file name
   * @returns {string} Sanitized file name
   */
  static sanitizeFileName(name) {
    return name
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  /**
   * Get file type category from MIME type
   * @param {string} mimeType - MIME type
   * @returns {'image'|'document'|'unknown'}
   */
  static getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf' ||
        mimeType === 'application/msword' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'text/plain' ||
        mimeType === 'application/zip' ||
        mimeType === 'application/x-zip-compressed') return 'document';
    return 'unknown';
  }
}

export const messagesService = new MessagesService();
export default messagesService;