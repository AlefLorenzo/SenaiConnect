import { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Send, Phone, Video, MoreVertical, MessageSquare,
  ArrowLeft, Paperclip, X,
  Users, Inbox, Send as SendIcon, Image, FileText, X as XIcon,
  Smile, Mic, Loader2, Shield, X as CloseIcon, Check, CheckCheck, AlertCircle, WifiOff
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import { SocketContext } from '../context/SocketContext.jsx';
import Avatar from '../components/Avatar';
import MessageBubble from '../components/MessageBubble';
import messagesService from '../services/messagesService';
import './Messages.css';

// File validation constants
const FILE_LIMITS = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']
  },
  document: {
    maxSize: 25 * 1024 * 1024, // 25MB
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

// Utility functions (exported for testing)
export const getContactName = (contact) => {
  if (contact.isGroup) return contact.name;
  // Find participant whose name is not "Você" (the current user placeholder)
  return contact.participants?.find(p => p.name !== 'Você')?.name || contact.name || 'Conversa';
};

export const getOtherParticipant = (contact) => {
  if (contact.isGroup) return null;
  // Find participant whose name is not "Você" (the current user placeholder)
  return contact.participants?.find(p => p.name !== 'Você') || null;
};

export const getContactAvatar = (contact) => contact;

export const getContactUnread = (contact) => contact.unreadCount || contact.unread_count || 0;

const sanitizeFileName = (name) => {
  return name
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
};

const validateFile = (file, type) => {
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
};

// Generate a unique temporary ID for optimistic messages
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const Messages = () => {
  const { user } = useContext(AuthContext);
  const {
    socket,
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
    retryMessage,
    MESSAGE_STATUS
  } = useContext(SocketContext);

  // Read conversationId from URL params
  const [searchParams] = useSearchParams();
  const urlConversationId = searchParams.get('conversationId');

  // Tab state - Instagram style: Primary, General, Requests, Groups
  // Default to 'general' to show all conversations (Primary only shows pinned)
  const [activeTab, setActiveTab] = useState('general');
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [history, setHistory] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [isOnline, setIsOnline] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Connection status: 'connected' | 'reconnecting' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Attachment state
  const [attachments, setAttachments] = useState([]);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadAbortControllers, setUploadAbortControllers] = useState({});

  // Track message IDs we've already added (for deduplication)
  const messageIdsRef = useRef(new Set());
  const processedSocketMessagesRef = useRef(new Set());

  // Refs
  const chatBodyRef = useRef(null);
  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const readReceiptObserverRef = useRef(null);
  const lastReadMessageIdRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingDebounceRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 769);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync connection status with socket connection state
  useEffect(() => {
    if (!isConnected) {
      setConnectionStatus('disconnected');
    } else if (connectionStatus === 'disconnected') {
      setConnectionStatus('connected');
      setReconnectAttempt(0);
    }
  }, [isConnected, connectionStatus]);

  // Filter conversations by tab
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    if (activeTab === 'primary') {
      filtered = conversations.filter(c => !c.isGroup && !c.isMuted && c.isPinned);
    } else if (activeTab === 'general') {
      filtered = conversations.filter(c => !c.isGroup && !c.isPinned);
    } else if (activeTab === 'requests') {
      filtered = conversations.filter(c => !c.isGroup && c.isRequest);
    }

    return filtered.filter(contact => {
      const contactName = contact.isGroup
        ? contact.name
        : contact.participants?.find(p => p.name !== 'Você')?.name || contact.name;
      return contactName?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [conversations, activeTab, searchTerm, user?.id]);

  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      return group.name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [groups, searchTerm]);

  const fetchConversations = useCallback(async () => {
    try {
      const result = await messagesService.getConversations();
      if (result.data) {
        setConversations(result.data);
      } else if (Array.isArray(result)) {
        setConversations(result);
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const result = await messagesService.getMyGroups();
      let groupsData = [];
      if (result.data) {
        groupsData = result.data;
      } else if (Array.isArray(result)) {
        groupsData = result;
      }
      // Ensure groups have isGroup: true for proper UI rendering
      const groupsWithFlag = groupsData.map(group => ({
        ...group,
        isGroup: true,
        isMuted: group.muted ?? group.isMuted ?? false,
        isImportant: group.important ?? group.isImportant ?? false,
        isPinned: group.isPinned ?? false,
      }));
      setGroups(groupsWithFlag);
    } catch (err) {
      console.error('Erro ao buscar grupos:', err);
    }
  }, []);

  useEffect(() => {
    // Clear cache to force fresh fetch with fixed transformConversations
    messagesService.clearCache();
    fetchConversations();
    fetchGroups();
  }, [fetchConversations, fetchGroups]);

  // Resolve deep links from profiles even if the inbox list is still loading.
  useEffect(() => {
    if (!urlConversationId) return;
    let cancelled = false;
    const existing = conversations.find(c => String(c.id) === String(urlConversationId));
    if (existing) {
      setSelectedContact(existing);
      setActiveTab(existing.isGroup ? 'groups' : 'general');
      return;
    }
    messagesService.getConversation(urlConversationId, true)
      .then(conversation => {
        if (cancelled || !conversation) return;
        const normalized = {
          ...conversation,
          id: String(conversation.id ?? conversation.conversationId ?? urlConversationId),
          isGroup: Boolean(conversation.isGroup),
          participants: conversation.participants || [],
          unreadCount: conversation.unreadCount || conversation.unread_count || 0,
        };
        setSelectedContact(normalized);
        setActiveTab(normalized.isGroup ? 'groups' : 'general');
      })
      .catch(error => {
        if (!cancelled) console.error('Não foi possível abrir a conversa solicitada:', error);
      });
    return () => { cancelled = true; };
  }, [urlConversationId, conversations]);

  const fetchHistory = useCallback(async (contactId, page = 1, append = false) => {
    if (!contactId) return;
    if (loadingHistory) return;

    try {
      setLoadingHistory(true);
      const result = await messagesService.getHistory(contactId, { page, limit: 30 });
      let data = result.data || [];

      // Ensure messages are in chronological order (oldest first) for proper grouping
      data = [...data].reverse();

      if (append) {
        // Prepend older messages (page 2+) to the beginning
        setHistory(prev => {
          const newMessages = data.filter(msg => !messageIdsRef.current.has(msg.id));
          newMessages.forEach(msg => messageIdsRef.current.add(msg.id));
          return [...newMessages, ...prev];
        });
      } else {
        // Initial load: show chronological order (oldest at top)
        messageIdsRef.current.clear();
        data.forEach(msg => messageIdsRef.current.add(msg.id));
        setHistory(data);
      }
      setHasMoreHistory(result.pagination?.hasMore || data.length >= 30);
      setHistoryPage(page);
      fetchConversations();
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      setHasMoreHistory(false);
    } finally {
      setLoadingHistory(false);
    }
  }, [fetchConversations, loadingHistory]);

  const loadMoreHistory = useCallback(() => {
    if (selectedContact && hasMoreHistory && !loadingHistory) {
      fetchHistory(selectedContact.id, historyPage + 1, true);
    }
  }, [selectedContact, hasMoreHistory, loadingHistory, historyPage, fetchHistory]);

  // IntersectionObserver for infinite scroll (load more on scroll up)
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMoreHistory && !loadingHistory) {
          loadMoreHistory();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMoreHistory, loadingHistory, loadMoreHistory]);

  // Fetch history when contact changes
  useEffect(() => {
    if (selectedContact) {
      messageIdsRef.current.clear();
      processedSocketMessagesRef.current.clear();
      fetchHistory(selectedContact.id, 1, false);
      if (isMobile) {
        setShowMobileChat(true);
      }
      // Join conversation for typing indicators
      joinConversation(selectedContact.id);
    } else {
      setHistory([]);
      setShowMobileChat(false);
      setHasMoreHistory(true);
      setHistoryPage(1);
    }

    return () => {
      if (selectedContact) {
        leaveConversation(selectedContact.id);
      }
    };
  }, [selectedContact, fetchHistory, isMobile, joinConversation, leaveConversation]);

  // Register socket event handlers
  useEffect(() => {
    if (!socket) return;

    const unsubscribeNewMessage = registerEventHandler('new_message', handleNewMessage);
    const unsubscribeMessageStatus = registerEventHandler('message_status', handleMessageStatus);
    const unsubscribeMessagesRead = registerEventHandler('messages_read', handleMessagesRead);
    const unsubscribeTypingStart = registerEventHandler('typing_start', handleTypingStart);
    const unsubscribeTypingStop = registerEventHandler('typing_stop', handleTypingStop);
    const unsubscribeUserOnline = registerEventHandler('user_online', handleUserOnline);
    const unsubscribeMissedMessages = registerEventHandler('missed_messages', handleMissedMessages);
    const unsubscribeConnectionChange = registerEventHandler('connection_change', handleConnectionChange);
    const unsubscribeReconnecting = registerEventHandler('reconnecting', handleReconnecting);
    const unsubscribeReconnected = registerEventHandler('reconnected', handleReconnected);
    const unsubscribeGroupMemberJoined = registerEventHandler('group_member_joined', handleGroupMemberJoined);
    const unsubscribeGroupMemberLeft = registerEventHandler('group_member_left', handleGroupMemberLeft);
    const unsubscribeGroupAdminChanged = registerEventHandler('group_admin_changed', handleGroupAdminChanged);
    const unsubscribeGroupUpdated = registerEventHandler('group_updated', handleGroupUpdated);
    const unsubscribeGroupDeleted = registerEventHandler('group_deleted', handleGroupDeleted);
    const unsubscribeMessageSentConfirmed = registerEventHandler('message_sent_confirmed', handleMessageSentConfirmed);

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageStatus();
      unsubscribeMessagesRead();
      unsubscribeTypingStart();
      unsubscribeTypingStop();
      unsubscribeUserOnline();
      unsubscribeMissedMessages();
      unsubscribeConnectionChange();
      unsubscribeReconnecting();
      unsubscribeReconnected();
      unsubscribeGroupMemberJoined();
      unsubscribeGroupMemberLeft();
      unsubscribeGroupAdminChanged();
      unsubscribeGroupUpdated();
      unsubscribeGroupDeleted();
      unsubscribeMessageSentConfirmed();
    };
  }, [socket, registerEventHandler, selectedContact, user?.id, fetchConversations, fetchGroups, fetchHistory]);

  // Socket event handlers
  const handleNewMessage = useCallback((msg) => {
    const msgId = msg.id || msg.tempId;
    if (processedSocketMessagesRef.current.has(msgId)) return;
    processedSocketMessagesRef.current.add(msgId);

    const senderId = msg.sender_id ?? msg.senderId;
    const receiverId = msg.receiver_id ?? msg.receiverId;
    const conversationId = msg.conversation_id ?? msg.conversationId;

    if (selectedContact && (conversationId === selectedContact.id ||
        (senderId === selectedContact.id || receiverId === selectedContact.id))) {
      // Check if message already exists in history (deduplication)
      const exists = history.some(m => m.id === msgId) ||
                     history.some(m => m.content === msg.content && m.senderId === senderId &&
                       Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 1000);
      if (!exists) {
        setHistory(prev => [...prev, msg]);
      }
      // Send read receipt if we're viewing this conversation
      sendMessagesRead(selectedContact.id);
    } else {
      // Update conversation list
      fetchConversations();
      fetchGroups();
    }
  }, [selectedContact, history, sendMessagesRead, fetchConversations, fetchGroups]);

  const handleMessageStatus = useCallback((data) => {
    const { messageId, tempId, status } = data;
    setHistory(prev => prev.map(m => {
      const match = m.id === messageId || m.tempId === tempId;
      if (match) {
        return { ...m, status, messageId: messageId || m.messageId };
      }
      return m;
    }));
  }, []);

  const handleMessagesRead = useCallback((data) => {
    const byUserId = data.byUserId ?? data.by_user_id;
    const otherParticipantId = getOtherParticipant(selectedContact)?.id;
    if (selectedContact && String(byUserId) === String(otherParticipantId)) {
      setHistory(prev => prev.map(m =>
        (m.status === MESSAGE_STATUS.SENT || m.status === MESSAGE_STATUS.DELIVERED) ?
          { ...m, status: MESSAGE_STATUS.READ } : m
      ));
    }
  }, [selectedContact, MESSAGE_STATUS]);

  const handleTypingStart = useCallback((data) => {
    const { conversationId, userId, userName } = data;
    if (selectedContact && conversationId === selectedContact.id && userId !== user?.id) {
      setTypingUsers(prev => ({ ...prev, [userId]: userName }));
    }
  }, [selectedContact, user?.id]);

  const handleTypingStop = useCallback((data) => {
    const { userId } = data;
    setTypingUsers(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const handleUserOnline = useCallback((data) => {
    const { userId, isOnline: online } = data;
    setIsOnline(prev => ({ ...prev, [userId]: online }));
  }, []);

  const handleMissedMessages = useCallback((data) => {
    const { conversationId, messages } = data;
    if (selectedContact && conversationId === selectedContact.id) {
      const newMessages = messages.filter(msg => !messageIdsRef.current.has(msg.id));
      newMessages.forEach(msg => messageIdsRef.current.add(msg.id));
      if (newMessages.length > 0) {
        setHistory(prev => {
          // Merge and sort by timestamp
          const combined = [...prev, ...newMessages];
          combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return combined;
        });
      }
    }
  }, [selectedContact]);

  const handleConnectionChange = useCallback((data) => {
    const { connected } = data;
    if (connected) {
      setConnectionStatus('connected');
      setReconnectAttempt(0);
    } else {
      setConnectionStatus('disconnected');
    }
  }, []);

  const handleReconnecting = useCallback((data) => {
    const { attemptNumber } = data;
    setConnectionStatus('reconnecting');
    setReconnectAttempt(attemptNumber);
  }, []);

  const handleReconnected = useCallback(() => {
    // Refresh conversations after reconnection
    fetchConversations();
    fetchGroups();
  }, [fetchConversations, fetchGroups]);

  const handleGroupMemberJoined = useCallback((data) => {
    if (selectedContact && selectedContact.isGroup && data.groupId === selectedContact.id) {
      // Refresh group data
      fetchGroups();
    }
    fetchConversations();
  }, [selectedContact, fetchGroups, fetchConversations]);

  const handleGroupMemberLeft = useCallback((data) => {
    if (selectedContact && selectedContact.isGroup && data.groupId === selectedContact.id) {
      fetchGroups();
    }
    fetchConversations();
  }, [selectedContact, fetchGroups, fetchConversations]);

  const handleGroupAdminChanged = useCallback((data) => {
    if (selectedContact && selectedContact.isGroup && data.groupId === selectedContact.id) {
      fetchGroups();
    }
  }, [selectedContact, fetchGroups]);

  const handleGroupUpdated = useCallback((data) => {
    if (selectedContact && selectedContact.isGroup && data.groupId === selectedContact.id) {
      fetchGroups();
    }
    fetchConversations();
  }, [selectedContact, fetchGroups, fetchConversations]);

  const handleGroupDeleted = useCallback((data) => {
    if (selectedContact && selectedContact.isGroup && data.groupId === selectedContact.id) {
      setSelectedContact(null);
    }
    fetchGroups();
    fetchConversations();
  }, [selectedContact, fetchGroups, fetchConversations]);

  const handleMessageSentConfirmed = useCallback((data) => {
    const { tempId, message } = data;
    setHistory(prev => prev.map(m =>
      m.tempId === tempId ? { ...message, tempId: m.tempId } : m
    ));
    // Update messageIdsRef to include the confirmed message ID
    messageIdsRef.current.add(message.id);
  }, []);

  // Auto-scroll to bottom on new messages (but not when loading history)
  useEffect(() => {
    if (chatBodyRef.current && !loadingHistory && history.length > 0) {
      // Only auto-scroll if user is near bottom
      const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      }
    }
  }, [history, loadingHistory]);

  // Read receipts: IntersectionObserver to detect when messages become visible
  useEffect(() => {
    if (!selectedContact || !chatBodyRef.current) return;

    const messagesContainer = chatBodyRef.current;
    const sentMessages = messagesContainer.querySelectorAll('[data-message-id]');

    if (readReceiptObserverRef.current) {
      readReceiptObserverRef.current.disconnect();
    }

    readReceiptObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const msgId = entry.target.getAttribute('data-message-id');
            if (msgId && msgId !== lastReadMessageIdRef.current) {
              lastReadMessageIdRef.current = msgId;
              // Send read receipt for this message
              sendMessagesRead(selectedContact.id);
            }
          }
        });
      },
      {
        root: messagesContainer,
        threshold: 0.5,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    sentMessages.forEach(el => {
      readReceiptObserverRef.current.observe(el);
    });

    return () => {
      if (readReceiptObserverRef.current) {
        readReceiptObserverRef.current.disconnect();
      }
    };
  }, [history, selectedContact, sendMessagesRead]);

  // Handle click outside emoji picker
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle typing indicator with debounce
  const handleTyping = useCallback(() => {
    if (!selectedContact || !socket || !isConnected) return;

    // Clear existing debounce
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }

    // Send typing_start immediately if not already typing
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStart(selectedContact.id, selectedContact.id);
    }

    // Debounce typing_stop
    typingDebounceRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStop(selectedContact.id);
    }, 2000);
  }, [selectedContact, socket, isConnected, sendTypingStart, sendTypingStop]);

  // Remove attachment
  const removeAttachment = useCallback((id) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      const newAttachments = prev.filter(a => a.id !== id);
      if (newAttachments.length === 0) {
        setShowAttachmentPreview(false);
      }
      return newAttachments;
    });
  }, []);

  // Cancel upload
  const cancelUpload = useCallback((attachmentId) => {
    const controller = uploadAbortControllers[attachmentId];
    if (controller) {
      controller.abort();
      setUploadAbortControllers(prev => {
        const next = { ...prev };
        delete next[attachmentId];
        return next;
      });
    }
    removeAttachment(attachmentId);
  }, [removeAttachment, uploadAbortControllers]);

  // Send message with optimistic UI
  const handleSendMessage = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim() && attachments.length === 0 || !selectedContact) return;

    // Clear typing indicator
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    if (socket && isConnected) {
      sendTypingStop(selectedContact.id);
    }

    const tempText = messageText;
    const tempAttachments = [...attachments];
    const tempId = generateTempId();

    // Optimistic UI: create temporary message
    const optimisticMessage = {
      tempId,
      id: tempId,
      conversationId: selectedContact.id,
      senderId: user?.id,
      senderName: 'Você',
      content: tempText,
      type: tempAttachments.length > 0 ? tempAttachments[0].type : 'text',
      message_type: tempAttachments.length > 0 ? tempAttachments[0].type : 'text',
      status: MESSAGE_STATUS.SENDING,
      createdAt: new Date().toISOString(),
      attachments: tempAttachments.length > 0 ? tempAttachments.map(a => ({
        mediaUrl: a.preview,
        messageType: a.type,
        fileName: a.name,
        fileSize: a.size,
        fileType: a.file.type
      })) : []
    };

    // Add to history immediately
    setHistory(prev => [...prev, optimisticMessage]);
    messageIdsRef.current.add(tempId);

    // Clear input
    setMessageText('');
    setAttachments([]);
    setShowAttachmentPreview(false);
    setShowEmojiPicker(false);
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
    }

    try {
      // Upload attachments first if any
      let uploadedAttachments = [];
      if (tempAttachments.length > 0) {
        for (const attachment of tempAttachments) {
          const controller = new AbortController();
          setUploadAbortControllers(prev => ({ ...prev, [attachment.id]: controller }));

          setUploadProgress(prev => ({ ...prev, [attachment.id]: 0 }));

          try {
            const uploadResult = await messagesService.uploadMedia(attachment.file, (progress) => {
              setUploadProgress(prev => ({ ...prev, [attachment.id]: progress }));
            }, controller.signal);
            if (uploadResult) {
              uploadedAttachments.push({
                mediaUrl: uploadResult.url,
                messageType: attachment.type,
                fileName: attachment.name,
                fileSize: attachment.size,
                fileType: attachment.file.type
              });
            }
          } catch (uploadErr) {
            if (uploadErr.name === 'AbortError') {
              console.log('Upload cancelado:', attachment.name);
              continue;
            }
            console.error('Erro ao fazer upload:', uploadErr);
            throw new Error(`Falha ao enviar ${attachment.name}`, { cause: uploadErr });
          } finally {
            setUploadAbortControllers(prev => {
              const next = { ...prev };
              delete next[attachment.id];
              return next;
            });
          }
        }
      }

      const messageData = {
        content: tempText,
        type: uploadedAttachments.length > 0 ? uploadedAttachments[0].messageType : 'text',
        message_type: uploadedAttachments.length > 0 ? uploadedAttachments[0].messageType : 'text',
        attachments: uploadedAttachments
      };

      // Try to send via API
      const result = await messagesService.sendMessage(selectedContact.id, messageData);

      if (result) {
        // Update optimistic message with server response
        setHistory(prev => prev.map(m =>
          m.tempId === tempId ? { ...result, tempId } : m
        ));
        messageIdsRef.current.delete(tempId);
        messageIdsRef.current.add(result.id);
        fetchConversations();
        fetchGroups();
      } else {
        // API returned no result - mark as error
        throw new Error('Erro ao enviar mensagem.');
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);

      // If offline, queue the message
      if (!isConnected) {
        queueMessage({
          conversationId: selectedContact.id,
          content: tempText,
          type: tempAttachments.length > 0 ? tempAttachments[0].type : 'text',
          attachments: tempAttachments.map(a => ({
            file: a.file,
            type: a.type,
            name: a.name,
            size: a.size
          })),
          tempId
        });
        // Update status to indicate queued
        setHistory(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: MESSAGE_STATUS.SENDING } : m
        ));
      } else {
        // Mark as error for retry
        setHistory(prev => prev.map(m =>
          m.tempId === tempId ? { ...m, status: MESSAGE_STATUS.ERROR } : m
        ));
        alert(err.message || 'Erro ao enviar mensagem. Tente novamente.');
      }

      // Restore input on error (only if not queued)
      if (isConnected) {
        setMessageText(tempText);
        setAttachments(tempAttachments);
        setShowAttachmentPreview(tempAttachments.length > 0);
      }
    } finally {
      setUploadProgress({});
      setUploadAbortControllers({});
    }
  }, [messageText, attachments, selectedContact, socket, isConnected, user?.id,
      sendTypingStop, fetchConversations, fetchGroups, queueMessage, MESSAGE_STATUS]);

  // Retry failed message
  const handleRetryMessage = useCallback(async (msgId) => {
    const msg = history.find(m => m.id === msgId || m.tempId === msgId);
    if (!msg) return;

    // Find the original message data
    const originalMsg = history.find(m => m.tempId === msgId);
    if (!originalMsg) return;

    // Re-send with same content
    try {
      setHistory(prev => prev.map(m =>
        (m.id === msgId || m.tempId === msgId) ? { ...m, status: MESSAGE_STATUS.SENDING } : m
      ));

      const messageData = {
        content: originalMsg.content,
        type: originalMsg.type,
        message_type: originalMsg.type,
        attachments: originalMsg.attachments || []
      };

      const result = await messagesService.sendMessage(selectedContact.id, messageData);

      if (result) {
        setHistory(prev => prev.map(m =>
          (m.id === msgId || m.tempId === msgId) ? { ...result, tempId: m.tempId } : m
        ));
        messageIdsRef.current.add(result.id);
      }
    } catch (err) {
      console.error('Erro ao reenviar:', err);
      setHistory(prev => prev.map(m =>
        (m.id === msgId || m.tempId === msgId) ? { ...m, status: MESSAGE_STATUS.ERROR } : m
      ));
    }
  }, [history, selectedContact, MESSAGE_STATUS]);

  // Handle file selection with validation
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      const isImage = file.type.startsWith('image/');
      const type = isImage ? 'image' : 'document';
      const validation = validateFile(file, type);

      if (validation.valid) {
        validFiles.push({
          file,
          type,
          name: sanitizeFileName(file.name),
          size: file.size,
          preview: isImage ? URL.createObjectURL(file) : null,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      } else {
        errors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }
    });

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
      setShowAttachmentPreview(true);
    }

    if (errors.length > 0) {
      alert(`Alguns arquivos não puderam ser adicionados:\n${errors.join('\n')}`);
    }

    e.target.value = '';
  }, []);

  // Handle multiple image selection
  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Apenas imagens são permitidas`);
        return;
      }

      const validation = validateFile(file, 'image');
      if (validation.valid) {
        validFiles.push({
          file,
          type: 'image',
          name: sanitizeFileName(file.name),
          size: file.size,
          preview: URL.createObjectURL(file),
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      } else {
        errors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }
    });

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
      setShowAttachmentPreview(true);
    }

    if (errors.length > 0) {
      alert(`Algumas imagens não puderam ser adicionadas:\n${errors.join('\n')}`);
    }

    e.target.value = '';
  }, []);

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
    setShowEmojiPicker(false);
  }, []);

  // Open image-only picker
  const openImagePicker = useCallback(() => {
    imageInputRef.current?.click();
    setShowEmojiPicker(false);
  }, []);

  // Toggle emoji picker
  const toggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker(prev => !prev);
  }, []);

  // Insert emoji into textarea
  const insertEmoji = useCallback((emoji) => {
    setMessageText(prev => {
      const newText = prev + emoji;
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.style.height = 'auto';
          const maxHeight = 120;
          const newHeight = Math.min(messageInputRef.current.scrollHeight, maxHeight);
          messageInputRef.current.style.height = `${newHeight}px`;
        }
      }, 0);
      return newText;
    });
    handleTyping();
  }, [handleTyping]);

  // Handle key down for Enter to send
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  }, [handleSendMessage]);

  // Auto-resize textarea
  const handleTextareaInput = useCallback((e) => {
    const value = e.target.value;
    setMessageText(value);
    handleTyping();

    const textarea = e.target;
    textarea.style.height = 'auto';
    const maxHeight = 120;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [handleTyping]);

  // Clear message search
  const handleClearMessageSearch = useCallback(() => {
    setMessageSearchTerm('');
    setShowMessageSearch(false);
  }, []);

  // Filter history for message search
  const filteredHistory = useMemo(() => {
    if (!messageSearchTerm) return history;
    return history.filter(msg => {
      const content = msg.content;
      const contentStr = typeof content === 'string' ? content : '';
      return contentStr.toLowerCase().includes(messageSearchTerm.toLowerCase());
    });
  }, [history, messageSearchTerm]);

  // Get current contacts based on active tab
  const currentContacts = activeTab === 'groups' ? filteredGroups : filteredConversations;

  // Tab configurations
  const tabs = useMemo(() => [
    { id: 'primary', label: 'Principal', icon: Inbox, count: conversations.filter(c => !c.isGroup && !c.isMuted && c.isPinned).reduce((sum, c) => sum + (c.unreadCount || 0), 0) },
    { id: 'general', label: 'Geral', icon: MessageSquare, count: conversations.filter(c => !c.isGroup && !c.isPinned).reduce((sum, c) => sum + (c.unreadCount || 0), 0) },
    { id: 'groups', label: 'Grupos', icon: Users, count: groups.reduce((sum, g) => sum + (g.unreadCount || 0), 0) },
  ], [conversations, groups]);

  // Check if we're in a group
  const isGroup = activeTab === 'groups' || selectedContact?.isGroup;

  // Common emojis for quick picker
  const commonEmojis = [
    '😀', '😂', '😍', '😭', '😎', '🥰', '😊', '🙏',
    '👍', '👎', '❤️', '🔥', '✨', '🎉', '😱', '🤔',
    '😴', '🤣', '😘', '😇', '🤷', '🤞', '✅', '❌'
  ];

  // Render empty state (conversation list)
  if (!selectedContact) {
    return (
      <div className="messages-layout" role="main">
        <aside className="messages-sidebar" aria-label="Lista de conversas">
          <MessagesSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={tabs}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            currentContacts={currentContacts}
            getContactName={getContactName}
            getContactAvatar={getContactAvatar}
            getContactUnread={getContactUnread}
            getOtherParticipant={getOtherParticipant}
            onSelectContact={setSelectedContact}
            selectedContactId={selectedContact?.id || null}
            isMobile={isMobile}
            showMobileChat={showMobileChat}
            setShowMobileChat={setShowMobileChat}
            isConnected={isConnected}
          />
        </aside>
        <div className="messages-chat">
          <ChatEmptyState activeTab={activeTab} />
        </div>
      </div>
    );
  }

  // Render chat with selected contact
  return (
    <div className={`messages-layout ${isMobile && showMobileChat ? 'show-chat-mobile' : ''}`}>
      <aside className="messages-sidebar" aria-label="Lista de conversas">
        <MessagesSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={tabs}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          currentContacts={currentContacts}
          getContactName={getContactName}
          getContactAvatar={getContactAvatar}
          getContactUnread={getContactUnread}
          getOtherParticipant={getOtherParticipant}
          onSelectContact={setSelectedContact}
          selectedContactId={selectedContact?.id || null}
          isMobile={isMobile}
          showMobileChat={showMobileChat}
          setShowMobileChat={setShowMobileChat}
          isConnected={isConnected}
        />
      </aside>

      <div className="messages-chat" role="region" aria-label={`Conversa com ${getContactName(selectedContact)}`}>
        <ConversationHeader
          contact={selectedContact}
          activeTab={activeTab}
          isGroup={isGroup}
          isOnline={isOnline}
          user={user}
          isMobile={isMobile}
          showMobileChat={showMobileChat}
          setShowMobileChat={setShowMobileChat}
          setSelectedContact={setSelectedContact}
          onSearchToggle={setShowMessageSearch}
          showMessageSearch={showMessageSearch}
        />

        {showMessageSearch && (
          <MessageSearchBar
            messageSearchTerm={messageSearchTerm}
            setMessageSearchTerm={setMessageSearchTerm}
            onClear={handleClearMessageSearch}
          />
        )}

        {/* Connection status indicator */}
        {connectionStatus !== 'connected' && (
          <div className={`connection-status-banner connection-status-${connectionStatus}`} role="status" aria-live="polite">
            {connectionStatus === 'reconnecting' && (
              <>
                <Loader2 size={16} className="spinning" color="#0056D2" />
                <span>Reconectando... {reconnectAttempt > 0 && `(tentativa ${reconnectAttempt})`}</span>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <WifiOff size={16} />
                <span>Desconectado - Tentando reconectar...</span>
              </>
            )}
          </div>
        )}

        {/* Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <TypingIndicator typingUsers={typingUsers} />
        )}

        <div className="chat-body" ref={chatBodyRef}>
          <div ref={loadMoreRef} className="load-more-trigger" aria-hidden="true">
            {loadingHistory && hasMoreHistory && (
              <div className="load-more-spinner" aria-label="Carregando mensagens anteriores">
                <Loader2 size={20} className="spinning" color="#0056D2" />
                <span>Carregando mensagens anteriores...</span>
              </div>
            )}
            {!hasMoreHistory && filteredHistory.length > 0 && (
              <div className="end-of-history" aria-label="Início da conversa">
                <span>Início da conversa</span>
              </div>
            )}
          </div>

          {filteredHistory.length > 0 ? (
            filteredHistory.map((msg, index) => (
              <MessageBubble
                key={msg.tempId || msg.id}
                message={msg}
                index={index}
                messages={filteredHistory}
                currentUserId={user?.id}
                isGroup={isGroup}
                participants={selectedContact?.participants}
                adminIds={selectedContact?.adminIds || []}
                onRetry={handleRetryMessage}
                onImageClick={(url) => window.open(url, '_blank')}
                showDateSeparator={true}
              />
            ))
          ) : (
            <div className="chat-empty-messages" aria-live="polite">
              <MessageSquare size={32} />
              {messageSearchTerm ? (
                <>
                  <span>Nenhuma mensagem encontrada para "{messageSearchTerm}"</span>
                  <button onClick={handleClearMessageSearch} className="btn-secondary" style={{ marginTop: '8px' }}>
                    Limpar busca
                  </button>
                </>
              ) : (
                <span>Envie uma mensagem para iniciar a conversa!</span>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept="image/*,application/pdf,.doc,.docx,.txt"
          multiple
          onChange={handleFileSelect}
        />
        <input
          ref={imageInputRef}
          type="file"
          style={{ display: 'none' }}
          accept="image/*"
          multiple
          onChange={handleImageSelect}
        />

        {/* Attachment Preview Bar */}
        {showAttachmentPreview && attachments.length > 0 && (
          <AttachmentPreviewBar
            attachments={attachments}
            uploadProgress={uploadProgress}
            onRemove={removeAttachment}
            onCancel={cancelUpload}
          />
        )}

        <ChatInputArea
          messageText={messageText}
          setMessageText={setMessageText}
          handleTextareaInput={handleTextareaInput}
          handleKeyDown={handleKeyDown}
          handleSendMessage={handleSendMessage}
          openFilePicker={openFilePicker}
          openImagePicker={openImagePicker}
          attachments={attachments}
          messageInputRef={messageInputRef}
          showEmojiPicker={showEmojiPicker}
          toggleEmojiPicker={toggleEmojiPicker}
          insertEmoji={insertEmoji}
          commonEmojis={commonEmojis}
          emojiPickerRef={emojiPickerRef}
        />
      </div>
    </div>
  );
};

// ========== Sub-components ==========

const MessagesSidebar = ({
  activeTab, setActiveTab, tabs, searchTerm, setSearchTerm,
  currentContacts, getContactName, getContactAvatar,
  getContactUnread, getOtherParticipant,
  onSelectContact, selectedContactId, isMobile, setShowMobileChat,
  isConnected
}) => (
  <div className="messages-sidebar">
    <div className="messages-header">
      <div className="header-left">
        <h2>Mensagens</h2>
      </div>
      <div className="header-right">
        <button className="icon-btn-transparent" aria-label="Nova mensagem">
          <SendIcon size={24} color="#0056D2" />
        </button>
        <button className="icon-btn-transparent" aria-label="Mais opções">
          <MoreVertical size={24} color="#65676B" />
        </button>
      </div>
    </div>

    {/* Connection status in sidebar */}
    {!isConnected && (
      <div className="sidebar-connection-warning">
        <AlertCircle size={14} />
        <span>Offline - Mensagens serão enviadas quando reconectar</span>
      </div>
    )}

    <div className="messages-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => { setActiveTab(tab.id); onSelectContact(null); if (isMobile) setShowMobileChat(false); }}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
        >
          <tab.icon size={20} color={activeTab === tab.id ? '#0056D2' : '#65676B'} />
          <span>{tab.label}</span>
          {tab.count > 0 && (
            <span className="tab-badge">{tab.count > 99 ? '99+' : tab.count}</span>
          )}
        </button>
      ))}
    </div>

    <div className="messages-search">
      <Search size={18} color="#65676B" />
      <input
        type="text"
        placeholder={activeTab === 'groups' ? 'Pesquisar grupos...' : 'Pesquisar mensagens...'}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>

    <div className="contact-list" role="tabpanel" id={`panel-${activeTab}`}>
      {currentContacts.length > 0 ? (
        currentContacts.map(contact => {
          const unreadCount = getContactUnread(contact);
          const hasUnread = unreadCount > 0;
          const contactName = getContactName(contact);
          const otherParticipant = getOtherParticipant(contact);
          const contactOnline = otherParticipant?.isOnline || false;
          const contactId = contact.conversation_id || contact.id;
          const isActive = contactId === selectedContactId;

          return (
            <div
              key={contactId}
              className={`contact-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
              onClick={() => { onSelectContact(contact); if (isMobile) setShowMobileChat(true); }}
              role="option"
              aria-selected={isActive}
            >
              <div className="contact-avatar-wrapper">
                <Avatar user={getContactAvatar(contact)} className="contact-avatar" />
                {contactOnline && activeTab !== 'groups' && (
                  <span className="online-indicator" aria-label="Online" />
                )}
                {activeTab === 'groups' && contact.isImportant && (
                  <span className="important-badge" aria-label="Grupo importante">
                    <span className="star">★</span>
                  </span>
                )}
                {contact.isMuted && (
                  <span className="muted-badge" aria-label="Silenciado">🔕</span>
                )}
              </div>
              <div className="contact-info">
                <div className="contact-header">
                  <h4 style={{ fontWeight: hasUnread ? '700' : '500' }}>
                    {contactName}
                  </h4>
                  <span className="contact-time">
                    {contact.last_message?.createdAt ? new Date(contact.last_message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="contact-preview">
                  <p style={{
                    fontWeight: hasUnread ? '600' : 'normal',
                    color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}>
                    {contact.isGroup && contact.last_message ? (
                      <>
                        {contact.last_message.senderName ? (
                          <>
                            <strong>{contact.last_message.senderName}:</strong> {contact.last_message.content || contact.last_message.text || ''}
                          </>
                        ) : (
                          contact.last_message.content || contact.last_message.text || 'Nenhuma mensagem ainda'
                        )}
                      </>
                    ) : (
                      contact.last_message?.content || contact.last_message?.text || 'Nenhuma mensagem ainda'
                    )}
                  </p>
                </div>
              </div>
              {hasUnread && (
                <span className="unread-badge" aria-label={`${unreadCount} mensagens não lidas`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {contact.isPinned && activeTab !== 'groups' && (
                <span className="pinned-badge" aria-label="Fixado">📌</span>
              )}
            </div>
          );
        })
      ) : (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {activeTab === 'groups' ? (
            <>
              <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Nenhum grupo ainda</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>Entre em grupos ou crie o seu próprio</p>
            </>
          ) : activeTab === 'requests' ? (
            <>
              <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Sem solicitações</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>Solicitações de mensagem aparecerão aqui</p>
            </>
          ) : (
            <>
              <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Nenhuma conversa</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>Inicie uma nova conversa clicando no ícone +</p>
            </>
          )}
        </div>
      )}
    </div>
  </div>
);

const ConversationHeader = ({
  contact, isGroup, isOnline, user,
  isMobile, setShowMobileChat,
  setSelectedContact,
  onSearchToggle, showMessageSearch
}) => {
  // Find other participant by name not being "Você" (handles case where both have same ID)
  const otherParticipant = contact.participants?.find(p => p.name !== 'Você');
  const participantOnline = otherParticipant ? isOnline[otherParticipant.id] : false;
  const onlineCount = contact.participants?.filter(p => p.name !== 'Você' && isOnline[p.id]).length || 0;
  const totalParticipants = contact.participants?.length || 0;
  const admins = contact.participants?.filter(p => p.isAdmin && p.name !== 'Você') || [];

  return (
    <header className="chat-header" role="banner">
      <div className="chat-user">
        {isMobile && (
          <button
            className="mobile-back-btn"
            onClick={() => { setShowMobileChat(false); setSelectedContact(null); }}
            aria-label="Voltar para lista de conversas"
            title="Voltar"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <Avatar user={contact} style={{ width: '40px', height: '40px' }} />
        <div className="chat-user-info">
          <h3>{isGroup ? contact.name : (otherParticipant?.name || contact.name)}</h3>
          <span className="contact-status">
            {isGroup ? (
              <>
                <span className={`status-dot ${onlineCount > 0 ? 'online' : ''}`} aria-hidden="true"></span>
                <span>{totalParticipants} {totalParticipants === 1 ? 'membro' : 'membros'}</span>
                {admins.length > 0 && (
                  <>
                    <span className="admin-separator" aria-hidden="true">·</span>
                    <span className="admin-badge">
                      <Shield size={10} aria-hidden="true" />
                      {admins.length} admin{admins.length > 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className={`status-dot ${participantOnline ? 'online' : ''}`} aria-hidden="true"></span>
                <span>{participantOnline ? 'Online' : 'Offline'}</span>
              </>
            )}
          </span>
        </div>
      </div>
      <div className="chat-actions">
        <button
          className="icon-btn-transparent"
          onClick={() => onSearchToggle(!showMessageSearch)}
          aria-label={showMessageSearch ? 'Fechar busca' : 'Buscar mensagens'}
          aria-pressed={showMessageSearch}
        >
          {showMessageSearch ? <X size={20} color="#0056D2" /> : <Search size={20} color="#0056D2" />}
        </button>
        <button
          className="icon-btn-transparent"
          onClick={() => alert('Ligando... (Função em desenvolvimento)')}
          aria-label="Ligar"
        >
          <Phone size={20} color="#0056D2" />
        </button>
        <button
          className="icon-btn-transparent"
          onClick={() => alert('Iniciando videochamada... (Função em desenvolvimento)')}
          aria-label="Videochamada"
        >
          <Video size={20} color="#0056D2" />
        </button>
        <button
          className="icon-btn-transparent"
          aria-label="Mais opções"
        >
          <MoreVertical size={20} color="#65676B" />
        </button>
      </div>
    </header>
  );
};

const MessageSearchBar = ({ messageSearchTerm, setMessageSearchTerm, onClear }) => (
  <div className="message-search-bar">
    <Search size={18} color="#65676B" />
    <input
      type="text"
      placeholder="Buscar nesta conversa..."
      value={messageSearchTerm}
      onChange={(e) => setMessageSearchTerm(e.target.value)}
      autoFocus
    />
    <button type="button" className="icon-btn-transparent" onClick={onClear} aria-label="Limpar busca">
      <X size={18} color="#65676B" />
    </button>
  </div>
);

const TypingIndicator = ({ typingUsers }) => (
  <div className="typing-indicator" aria-live="polite">
    <span className="typing-dots">
      <span></span><span></span><span></span>
    </span>
    <span>
      {Object.values(typingUsers).join(', ')}
      {Object.keys(typingUsers).length > 1 ? ' estão digitando...' : ' está digitando...'}
    </span>
  </div>
);

const AttachmentPreviewBar = ({ attachments, uploadProgress, onRemove, onCancel }) => (
  <div className="attachment-preview-bar" role="status" aria-label="Anexos">
    <div className="attachment-previews">
      {attachments.map((attachment) => {
        const progress = uploadProgress[attachment.id];
        const isUploading = progress !== undefined && progress < 100;
        const isComplete = progress === 100;

        return (
          <div key={attachment.id} className={`attachment-preview ${isUploading ? 'uploading' : ''} ${isComplete ? 'upload-complete' : ''}`}>
            {attachment.type === 'image' && attachment.preview && (
              <img src={attachment.preview} alt={`Preview de ${attachment.name}`} />
            )}
            {attachment.type === 'document' && (
              <div className="attachment-doc-icon">
                <FileText size={24} color="#0056D2" />
              </div>
            )}
            <div className="attachment-info">
              <span className="attachment-name">{attachment.name}</span>
              <span className="attachment-size">
                {attachment.size < 1024 * 1024
                  ? `${(attachment.size / 1024).toFixed(1)} KB`
                  : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
              </span>
            </div>
            {isUploading && (
              <>
                <div className="attachment-progress" style={{ '--progress': `${progress}%` }} />
                <span className="attachment-progress-text">{Math.round(progress)}%</span>
              </>
            )}
            {isComplete && (
              <div className="attachment-progress complete" style={{ '--progress': '100%' }} />
            )}
            <button
              type="button"
              className={isUploading ? 'attachment-cancel' : 'attachment-remove'}
              onClick={isUploading ? () => onCancel(attachment.id) : () => onRemove(attachment.id)}
              aria-label={isUploading ? `Cancelar upload de ${attachment.name}` : `Remover ${attachment.name}`}
              disabled={isComplete}
            >
              {isUploading ? <CloseIcon size={14} /> : <XIcon size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

const ChatInputArea = ({
  messageText, handleTextareaInput, handleKeyDown,
  handleSendMessage, openFilePicker, openImagePicker,
  messageInputRef, showEmojiPicker, toggleEmojiPicker,
  insertEmoji, commonEmojis, emojiPickerRef
}) => (
  <form className="chat-input-area" onSubmit={handleSendMessage}>
    <button
      type="button"
      className="icon-btn-transparent input-icon-btn"
      onClick={openFilePicker}
      aria-label="Anexar arquivo"
    >
      <Paperclip size={24} color="var(--text-secondary)" />
    </button>
    <button
      type="button"
      className="icon-btn-transparent input-icon-btn"
      onClick={openImagePicker}
      aria-label="Anexar foto"
    >
      <Image size={24} color="var(--text-secondary)" />
    </button>
    <button
      type="button"
      className="icon-btn-transparent input-icon-btn"
      onClick={toggleEmojiPicker}
      aria-label={showEmojiPicker ? 'Fechar emojis' : 'Emojis'}
      aria-expanded={showEmojiPicker}
      aria-controls="emoji-picker"
    >
      <Smile size={24} color={showEmojiPicker ? 'var(--color-primary)' : 'var(--text-secondary)'} />
    </button>
    <div className="textarea-wrapper" style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      <textarea
        ref={messageInputRef}
        placeholder="Mensagem..."
        value={messageText}
        onChange={handleTextareaInput}
        onKeyDown={handleKeyDown}
        aria-label="Digite sua mensagem"
        rows={1}
        className="message-input"
        style={{
          minHeight: '44px',
          maxHeight: '140px',
          resize: 'none',
          width: '100%'
        }}
      />
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          id="emoji-picker"
          className="emoji-picker"
          role="listbox"
          aria-label="Selecionar emoji"
        >
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              type="button"
              role="option"
              className="emoji-option"
              onClick={() => insertEmoji(emoji)}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
    <button
      type="button"
      className="icon-btn-transparent input-icon-btn"
      aria-label="Gravar áudio"
    >
      <Mic size={24} color="var(--text-secondary)" />
    </button>
    <button
      type="submit"
      className="send-btn"
      disabled={!messageText.trim()}
      onClick={handleSendMessage}
      aria-label="Enviar mensagem"
    >
      <Send size={20} color="white" />
    </button>
  </form>
);

const ChatEmptyState = ({ activeTab }) => (
  <div className="chat-empty-state">
    {activeTab === 'groups' ? (
      <>
        <Users size={64} style={{ opacity: 0.3 }} />
        <h3>Selecione um grupo para conversar</h3>
        <p>Seus grupos aparecem na aba "Grupos" acima.</p>
      </>
    ) : (
      <>
        <MessageSquare size={64} style={{ opacity: 0.3 }} />
        <h3>Selecione uma conversa</h3>
        <p>Suas mensagens aparecem aqui.</p>
      </>
    )}
  </div>
);

export { MessagesSidebar };

export default Messages;