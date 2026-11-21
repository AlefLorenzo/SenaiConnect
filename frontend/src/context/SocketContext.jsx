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
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);

  // Reconnection state
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelayRef = useRef(1000);
  const maxReconnectDelay = 30000;
  const heartbeatIntervalRef = useRef(null);
  const missedMessagesCheckRef = useRef(false);
  const isProcessingQueueRef = useRef(false);

  // Event handler registry for components to subscribe
  const eventHandlersRef = useRef(new Map());

  // Fetch existing notifications
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
        setNotifications(allActivities);
        setUnreadCount(allActivities.filter(n => !n.read).length);
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    }
  }, []);

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

    try {
      const { messagesService } = await import('../services/messagesService');
      const conversations = await messagesService.getConversations();

      for (const conv of conversations.data || conversations) {
        if (conv.last_message?.createdAt) {
          const lastMsgTime = new Date(conv.last_message.createdAt).getTime();
          if (lastMsgTime > (lastMessageTimestamp || 0)) {
            const history = await messagesService.getHistory(conv.id, { page: 1, limit: 50 });
            if (history.data?.length) {
              emitToHandlers('missed_messages', {
                conversationId: conv.id,
                messages: history.data
              });
            }
          }
        }
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
  }, [emitToHandlers]);

  // Setup socket event listeners
  const setupSocketListeners = useCallback((socket) => {
    socket.on('connect', () => {
      console.log('Socket conectado:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
      reconnectDelayRef.current = 1000;


      startHeartbeat();
      processOfflineQueue();

      const lastSeen = localStorage.getItem(`last_seen_${user?.id}`);
      if (lastSeen) {
        fetchMissedMessages(parseInt(lastSeen));
      }
      localStorage.setItem(`last_seen_${user?.id}`, Date.now().toString());

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

      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionError('Max reconnection attempts reached');
      }

      emitToHandlers('connection_error', { error: err.message, attempts: reconnectAttemptsRef.current });
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconectado após', attemptNumber, 'tentativas');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;

      startHeartbeat();
      processOfflineQueue();
      fetchMissedMessages(parseInt(localStorage.getItem(`last_seen_${user?.id}`) || '0'));

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
      emitToHandlers('new_message', msg);
    });

    socket.on('message_status', (data) => {
      emitToHandlers('message_status', data);
    });

    socket.on('messages_read', (data) => {
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
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      emitToHandlers('new_notification', notification);
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
      if (data.userId === user) {
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
  }, [user, startHeartbeat, stopHeartbeat, processOfflineQueue, fetchMissedMessages, emitToHandlers]);

  // Initialize socket when user logs in
  useEffect(() => {
    console.log('[SocketContext] Effect running, user:', user?.id);

    // Detect logout: user was set, now is null
    if (previousUserId && !user) {
      console.log('[SocketContext] User logged out, disconnecting socket');
      disconnectSocket();
      setIsConnected(false);
      setConnectionError(null);
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

    // Fetch existing notifications
    fetchNotifications();

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
      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Erro ao marcar notificação:', err);
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
      markAsRead,
      fetchNotifications,
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