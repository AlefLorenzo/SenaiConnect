import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AuthContext } from './AuthContext.jsx';
import messagesService from '../services/messagesService';
import { initSocket, updateSocketAuth, getSocket, disconnectSocket, isSocketConnected, getSocketUserId } from './socketInstance';

export const SocketContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Message status constants - defined outside to avoid Fast Refresh issues
const MESSAGE_STATUS_VALUES = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  ERROR: 'error'
};

// Track if effect has initialized for current user to avoid HMR re-runs
let initializedForUser = null;

// Track previous user to detect logout
let previousUser = null;
let previousUserId = null;

export const SocketProvider = ({ children }) => {
  const { user, setUser, authSession } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const seenNotificationIdsRef = useRef(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);

  // Reconnection state
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const missedMessagesCheckRef = useRef(false);
  const isProcessingQueueRef = useRef(false);

  // Event handler registry for components to subscribe
  const eventHandlersRef = useRef(new Map());

  // Badge counts come from the database, so the total is never limited to the first page.
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(Math.max(0, Number(data.count) || 0));
    } catch (err) {
      console.error('Erro ao atualizar o contador de notificações:', err);
    }
  }, []);

  const fetchUnreadMessagesCount = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/messages/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadMessagesCount(Math.max(0, Number(data.count) || 0));
    } catch (err) {
      console.error('Erro ao atualizar o contador de mensagens:', err);
    }
  }, []);

  // Initial page data powers the dropdown; the separate endpoint supplies the exact total.
  const fetchNotifications = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const allActivities = data.sections?.flatMap(s => s.activities) || [];
        seenNotificationIdsRef.current = new Set(allActivities.map(n => String(n.id)));
        setNotifications(allActivities);
        await fetchUnreadCount();
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    }
  }, [fetchUnreadCount]);

  // Load offline queue from localStorage on init
  useEffect(() => {
    setOfflineQueue(messagesService.getOfflineQueue());
  }, []);

  // Sync offline queue state with service
  const syncOfflineQueue = useCallback(() => {
    setOfflineQueue(messagesService.getOfflineQueue());
  }, []);

  // Add message to offline queue
  const queueMessage = useCallback((messageData) => {
    const queueId = messagesService.queueMessage(messageData);
    syncOfflineQueue();
    return queueId;
  }, [syncOfflineQueue]);

  // Process offline queue when reconnected
  const processOfflineQueue = useCallback(async () => {
    const currentQueue = messagesService.getOfflineQueue();
    if (isProcessingQueueRef.current || currentQueue.length === 0 || !isConnected) return;

    isProcessingQueueRef.current = true;

    try {
      const result = await messagesService.processOfflineQueue((progress) => {
        // Progress updates handled by service events
      });
      console.log('Offline queue processed:', result);
      syncOfflineQueue();
    } catch (err) {
      console.error('Error processing offline queue:', err);
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [isConnected, syncOfflineQueue]);

  // Register event handler for components
  const registerEventHandler = useCallback((event, handler) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set());
    }
    eventHandlersRef.current.get(event).add(handler);

    return () => {
      const handlers = eventHandlersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  // Emit event to registered handlers
  const emitToHandlers = useCallback((event, data) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in ${event} handler:`, err);
        }
      });
    }
  }, []);

  // Relay confirmations from the offline queue service to subscribed message screens.
  useEffect(() => {
    const handleMessageSentConfirmed = (event) => {
      emitToHandlers('message_sent_confirmed', event.detail || {});
    };
    window.addEventListener('message_sent_confirmed', handleMessageSentConfirmed);
    return () => window.removeEventListener('message_sent_confirmed', handleMessageSentConfirmed);
  }, [emitToHandlers]);

  // Heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Fetch missed messages after reconnection
  const fetchMissedMessages = useCallback(async (lastMessageTimestamp) => {
    if (missedMessagesCheckRef.current) return;
    missedMessagesCheckRef.current = true;

    const recoveryStartedAt = Date.now();
    let recoveryComplete = true;
    try {
      // forceRefresh bypasses the conversation cache; clearing every history cache was unnecessary.
      const conversations = await messagesService.getConversations('all', true);
      const conversationList = conversations.data || conversations || [];
      const changedConversations = conversationList.filter((conv) => {
        const timestamp = new Date(conv.last_message?.createdAt || conv.updatedAt || 0).getTime();
        return Number.isFinite(timestamp) && timestamp > (lastMessageTimestamp || 0);
      });

      // Fetch in small batches: avoid serial N+1 latency without flooding the API after reconnect.
      for (let index = 0; index < changedConversations.length; index += 4) {
        const batch = changedConversations.slice(index, index + 4);
        const recovered = await Promise.all(batch.map(async (conv) => {
          const conversationId = conv.conversation_id ?? conv.id;
          if (!conversationId) return null;
          try {
            const history = await messagesService.getHistory(conversationId, { page: 1, limit: 50, forceRefresh: true });
            const messages = history.data || [];
            return messages.length ? { conversationId, messages } : null;
          } catch (historyError) {
            recoveryComplete = false;
            console.warn('Falha ao recuperar histórico de conversa:', conversationId, historyError.message);
            return null;
          }
        }));
        recovered.filter(Boolean).forEach((payload) => emitToHandlers('missed_messages', payload));
      }
      // Do not move the checkpoint if any conversation failed to load. Retry it on
      // the next pass, and only advance to the start of this pass to avoid a time race.
      if (recoveryComplete) {
        localStorage.setItem(`last_seen_${user?.id}`, recoveryStartedAt.toString());
      }
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('Token')) {
        console.warn('Skipping missed messages fetch - auth required:', err.message);
      } else {
        console.error('Error fetching missed messages:', err);
      }
    } finally {
      missedMessagesCheckRef.current = false;
    }
  }, [emitToHandlers, user?.id]);

  // Reconcile from the database periodically even when Socket.IO reports connected.
  // Mobile browsers can suspend a transport without emitting a timely disconnect event.
  useEffect(() => {
    if (!user?.id || USE_MOCK) return undefined;

    const recoverMessages = () => {
      if (document.visibilityState !== 'visible') return;
      const storedLastSeen = localStorage.getItem(`last_seen_${user.id}`);
      // First visit: establish a checkpoint instead of downloading the entire message history.
      if (!storedLastSeen) {
        localStorage.setItem(`last_seen_${user.id}`, Date.now().toString());
        return;
      }
      fetchMissedMessages(Number(storedLastSeen));
    };

    recoverMessages();
    // Socket.IO remains the primary delivery path; this small polling pass is the safety net.
    const intervalId = window.setInterval(recoverMessages, 90000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') recoverMessages();
    };
    window.addEventListener('online', recoverMessages);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', recoverMessages);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, fetchMissedMessages]);

  // Setup socket event listeners
  const setupSocketListeners = useCallback((socket) => {
    socket.on('connect', () => {
      console.log('Socket conectado:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;


      startHeartbeat();
      processOfflineQueue();

      const lastSeen = localStorage.getItem(`last_seen_${user?.id}`);
      if (lastSeen) {
        fetchMissedMessages(Number(lastSeen));
      } else {
        localStorage.setItem(`last_seen_${user?.id}`, Date.now().toString());
      }

      emitToHandlers('connection_change', { connected: true });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
      setIsConnected(false);
      stopHeartbeat();

      if (reason === 'io server disconnect') {
        socket.connect();
      }

      emitToHandlers('connection_change', { connected: false, reason });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnectionError(err.message);
      reconnectAttemptsRef.current++;

      emitToHandlers('connection_error', { error: err.message, attempts: reconnectAttemptsRef.current });
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconectado após', attemptNumber, 'tentativas');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;

      // The socket 'connect' event already performs recovery and queue processing.
      // Keep this event for UI state only to avoid launching the same work twice.
      emitToHandlers('reconnected', { attemptNumber });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Tentativa de reconexão:', attemptNumber);
      emitToHandlers('reconnecting', { attemptNumber });
    });

    socket.on('heartbeat_ack', () => {
      // Connection is alive
    });

    socket.on('new_message', (msg) => {
      fetchUnreadMessagesCount();
      emitToHandlers('new_message', msg);
    });

    socket.on('message_status', (data) => {
      emitToHandlers('message_status', data);
    });

    socket.on('messages_read', (data) => {
      fetchUnreadMessagesCount();
      emitToHandlers('messages_read', data);
    });

    socket.on('typing_start', (data) => {
      emitToHandlers('typing_start', data);
    });

    socket.on('typing_stop', (data) => {
      emitToHandlers('typing_stop', data);
    });

    socket.on('user_online', (data) => {
      emitToHandlers('user_online', data);
    });

    socket.on('group_member_joined', (data) => {
      emitToHandlers('group_member_joined', data);
    });

    socket.on('group_member_left', (data) => {
      emitToHandlers('group_member_left', data);
    });

    socket.on('group_admin_changed', (data) => {
      emitToHandlers('group_admin_changed', data);
    });

    socket.on('group_updated', (data) => {
      emitToHandlers('group_updated', data);
    });

    socket.on('group_deleted', (data) => {
      emitToHandlers('group_deleted', data);
    });

    socket.on('new_notification', (notification) => {
      const notificationId = notification?.id == null ? null : String(notification.id);
      const isDuplicate = notificationId && seenNotificationIdsRef.current.has(notificationId);

      if (!isDuplicate) {
        if (notificationId) seenNotificationIdsRef.current.add(notificationId);
        setNotifications(prev => [notification, ...prev.filter(item => String(item.id) !== notificationId)]);
        if (!notification.read) setUnreadCount(prev => prev + 1);
      }

      emitToHandlers('new_notification', notification);
    });

    // Admin content notifications carry only a resource identifier. Each page
    // re-fetches through its authenticated API, which applies recipient/unit rules.
    socket.on('admin_content_changed', (change) => {
      const resource = change?.resource;
      if (!['events', 'courses', 'notices'].includes(resource)) return;
      emitToHandlers('admin_content_changed', { resource });
    });

    socket.on('new_story', (story) => {
      emitToHandlers('new_story', story);
    });

    socket.on('story_expired', (data) => {
      emitToHandlers('story_expired', data);
    });

    socket.on('story_deleted', (data) => {
      emitToHandlers('story_deleted', data);
    });

    socket.on('stories_expired', (data) => {
      emitToHandlers('stories_expired', data);
    });

    socket.on('profile_updated', (data) => {
      if (data.userId === user?.id) {
        const token = sessionStorage.getItem('token');
        if (token) {
          fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json()).then(data => {
            if (!data.error) {
              setUser(data);
            }
          }).catch(err => console.error('Error fetching updated profile', err));
        }
      } else {
        window.dispatchEvent(new CustomEvent('profile_updated_broadcast', { detail: data }));
      }
    });
  }, [user, startHeartbeat, stopHeartbeat, processOfflineQueue, fetchMissedMessages, fetchUnreadMessagesCount, emitToHandlers]);

  // Keep the live socket on the current Supabase access token after token refresh.
  useEffect(() => {
    if (user?.id && authSession?.access_token) {
      updateSocketAuth(authSession.access_token);
    }
  }, [user?.id, authSession?.access_token]);

  // Keep the global unread-message badge accurate even when a socket event is missed
  // while a mobile browser is suspended but the connection still appears active.
  useEffect(() => {
    if (!user?.id || USE_MOCK) return undefined;

    const refreshUnreadCount = () => {
      if (document.visibilityState === 'visible') fetchUnreadMessagesCount();
    };
    const intervalId = window.setInterval(refreshUnreadCount, 90000);
    document.addEventListener('visibilitychange', refreshUnreadCount);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshUnreadCount);
    };
  }, [user?.id, fetchUnreadMessagesCount]);

  // Initialize socket when user logs in
  useEffect(() => {
    console.log('[SocketContext] Effect running, user:', user?.id);

    // Detect logout: user was set, now is null
    if (previousUserId && !user) {
      console.log('[SocketContext] User logged out, disconnecting socket');
      disconnectSocket();
      setIsConnected(false);
      setConnectionError(null);
      setNotifications([]);
      setUnreadCount(0);
      setUnreadMessagesCount(0);
      seenNotificationIdsRef.current.clear();
      initializedForUser = null;
      previousUser = null;
      previousUserId = null;
      return;
    }

    // Update previous user tracker
    if (user) {
      previousUser = user;
      previousUserId = user.id;
    }

    if (!user) {
      return;
    }

    if (USE_MOCK) {
      setIsConnected(true);
      setConnectionError(null);
      emitToHandlers('connection_change', { connected: true });
      return;
    }

    // Check if we already initialized for this user (handles HMR)
    if (initializedForUser === user?.id) {
      console.log('[SocketContext] Already initialized for user:', user?.id, '- skipping');
      const existingSocket = getSocket();
      if (existingSocket && existingSocket.connected) {
        setIsConnected(true);
        setConnectionError(null);
        startHeartbeat();
        processOfflineQueue();
      }
      return;
    }

    // Check if we already have a socket for this user
    const existingSocket = getSocket();
    const existingUserId = getSocketUserId();

    if (existingSocket && existingSocket.connected && existingUserId === user?.id) {
      console.log('[SocketContext] Reusing existing socket for user:', user?.id);
      setIsConnected(true);
      setConnectionError(null);
      startHeartbeat();
      processOfflineQueue();
      initializedForUser = user?.id;
      return;
    }

    // Initialize new socket
    const socket = initSocket(user?.id, authSession?.access_token || sessionStorage.getItem('token'));
    if (socket) {
      if (!socket.__senaiListenersInitialized) {
        setupSocketListeners(socket);
        socket.__senaiListenersInitialized = true;
      }
    }

    // Hydrate both badge counters when the authenticated socket starts.
    fetchNotifications();
    fetchUnreadMessagesCount();

    initializedForUser = user?.id;

    // No cleanup - socket persists across HMR
    // Only disconnects on actual logout (handled above via previousUser check)
    return () => {
      // Intentionally empty - socket persists across HMR
      // Logout cleanup happens at the top of this effect when user becomes null
    };
  }, [user, authSession?.access_token, setupSocketListeners, startHeartbeat, processOfflineQueue, fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return false;
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Não foi possível marcar a notificação como lida.');

      const selected = notifications.find(item => String(item.id) === String(notificationId));
      setNotifications(prev => prev.map(item => (
        String(item.id) === String(notificationId) ||
        (selected?.grouping_id && item.grouping_id === selected.grouping_id)
          ? { ...item, read: true }
          : item
      )));
      await fetchUnreadCount();
      return true;
    } catch (err) {
      console.error('Erro ao marcar notificação:', err);
      return false;
    }
  };

  const markAllAsRead = async (filter = 'all') => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return false;
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filter })
      });
      if (!response.ok) throw new Error('Não foi possível marcar as notificações como lidas.');
      setNotifications(prev => prev.map(item => ({ ...item, read: true })));
      await fetchUnreadCount();
      return true;
    } catch (err) {
      console.error('Erro ao marcar todas as notificações como lidas:', err);
      return false;
    }
  };

  // Join conversation for typing indicators
  const joinConversation = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('join_conversation', conversationId);
    }
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('leave_conversation', conversationId);
    }
  }, []);

  // Send typing indicator
  const sendTypingStart = useCallback((conversationId, receiverId) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('typing_start', { conversationId, receiverId });
    }
  }, []);

  const sendTypingStop = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('typing_stop', { conversationId });
    }
  }, []);

  // Mark messages as read
  const sendMessagesRead = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('messages_read', { conversationId, byUserId: user?.id });
    }
  }, [user?.id]);

  // Get offline queue for UI display
  const getOfflineQueue = useCallback(() => offlineQueue, [offlineQueue]);

  // Retry failed message
  const retryMessage = useCallback(async (messageId) => {
    await messagesService.retryQueueItem(messageId);
    syncOfflineQueue();
  }, [syncOfflineQueue]);

  // Clear offline queue
  const clearOfflineQueue = useCallback(() => {
    messagesService.clearOfflineQueue();
    syncOfflineQueue();
  }, [syncOfflineQueue]);

  return (
    <SocketContext.Provider value={{
      socket: getSocket(),
      notifications,
      unreadCount,
      unreadMessagesCount,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
      fetchUnreadCount,
      fetchUnreadMessagesCount,
      isConnected,
      connectionError,
      offlineQueue,
      registerEventHandler,
      joinConversation,
      leaveConversation,
      sendTypingStart,
      sendTypingStop,
      sendMessagesRead,
      queueMessage,
      getOfflineQueue,
      retryMessage,
      clearOfflineQueue,
      MESSAGE_STATUS: MESSAGE_STATUS_VALUES
    }}>
      {children}
    </SocketContext.Provider>
  );
};