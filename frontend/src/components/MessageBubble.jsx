import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Check, CheckCheck, FileText, Download, X, Maximize2, ZoomIn, ZoomOut, RotateCw, Shield, FileImage, FileSpreadsheet, FileArchive, Music, Video, FileCode } from 'lucide-react';
import Avatar from './Avatar';
import './MessageBubble.css';

const normalizeUserId = (value) => value === null || value === undefined ? '' : String(value);

/**
 * MessageBubble - WhatsApp-style message component with group sender identification
 * Handles: sent/received messages, group sender grouping, images, files, read receipts, date separators
 * Features:
 * - Sent messages: right-aligned, blue gradient, read receipts (✓✓ for read, ✓ for sent)
 * - Received messages: left-aligned, white with border, sender name for groups
 * - Group messages: show sender name above bubble for first message in sequence
 * - Consecutive messages from same sender: group visually, show name only once
 * - Avatar: show for first message in group sequence, hide for consecutive
 * - Time: subtle, bottom-right of bubble
 * - Images: preview in bubble, click to expand in modal
 * - Files: document icon, name, size, download button
 * - Date separators: centered, "Today", "Yesterday", or date
 * - Accessibility: ARIA labels, proper heading structure, focus management
 */
const MessageBubble = ({
  message,
  index,
  messages,
  currentUserId,
  isGroup,
  participants,
  adminIds = [],
  onRetry,
  onImageClick,
  showDateSeparator = true
}) => {
  const senderId = message.sender_id ?? message.senderId;
  const normalizedSenderId = normalizeUserId(senderId);
  const createdAt = message.created_at ?? message.createdAt;
  const messageType = message.message_type ?? message.type ?? 'text';
  const mediaUrl = message.media_url ?? message.mediaUrl;
  const content = message.content;
  const status = message.status ?? message.messageStatus ?? 'sent';
  const isSent = normalizedSenderId !== '' && normalizedSenderId === normalizeUserId(currentUserId);
  const isRead = status === 'lida' || status === 'read';
  const isDelivered = status === 'entregue' || status === 'delivered';
  const isSending = status === 'enviando' || status === 'sending';
  const isError = status === 'erro' || status === 'error' || status === 'failed';
  const fileName = message.fileName ?? message.file_name;
  const fileSize = message.fileSize ?? message.file_size;
  const fileType = message.fileType ?? message.file_type;

  // Modal state for image expansion
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const modalRef = useRef(null);
  const imageContainerRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Zoom/Pan state for image modal
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialTouchRef = useRef(null);

  // Refs for handlers to avoid circular dependencies in useCallback
  const handleMouseMoveRef = useRef(null);
  const handleMouseUpRef = useRef(null);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl+wheel
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
    } else if (zoom > 1) {
      // Pan with wheel when zoomed
      setPosition(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, [zoom]);

  // Handle mouse drag for panning - use refs to avoid circular deps
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMoveRef.current);
    document.removeEventListener('mouseup', handleMouseUpRef.current);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  }, [isDragging]);

  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    document.addEventListener('mousemove', handleMouseMoveRef.current);
    document.addEventListener('mouseup', handleMouseUpRef.current);
  }, [zoom, position]);

  // Update refs when handlers change
  useEffect(() => {
    handleMouseMoveRef.current = handleMouseMove;
  }, [handleMouseMove]);

  useEffect(() => {
    handleMouseUpRef.current = handleMouseUp;
  }, [handleMouseUp]);

  // Handle touch for mobile pan/zoom
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      // Single touch - pan if zoomed
      if (zoom > 1) {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        };
        initialTouchRef.current = null;
      }
    } else if (e.touches.length === 2) {
      // Two touches - pinch zoom
      e.preventDefault();
      setIsDragging(false);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialTouchRef.current = {
        distance: Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY),
        zoom
      };
    }
  }, [zoom, position]);

  // We need to add touchmove and touchend handlers
  useEffect(() => {
    const handleTouchMove = (e) => {
      if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        setPosition({
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y
        });
      } else if (e.touches.length === 2 && initialTouchRef.current) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const scale = distance / initialTouchRef.current.distance;
        setZoom(Math.max(0.5, Math.min(5, initialTouchRef.current.zoom * scale)));
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      initialTouchRef.current = null;
    };

    if (isImageExpanded) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isImageExpanded, isDragging]);

  // Resolve the author of a group message. Normalize IDs because the API,
  // optimistic messages and the authenticated user can use different ID types.
  const getSenderInfo = () => {
    if (!isGroup) return null;

    const isCurrentUserAdmin = adminIds?.some(id => normalizeUserId(id) === normalizedSenderId) || false;
    if (isSent) {
      return { name: 'Você', avatar: null, isAdmin: isCurrentUserAdmin };
    }

    const participant = participants?.find(p =>
      normalizeUserId(p.id ?? p.user_id ?? p.userId) === normalizedSenderId
    );
    const messageSenderName = message.senderName ?? message.sender_name;
    const name = (messageSenderName || participant?.name || '').trim();

    return {
      name: name || 'Desconhecido',
      avatar: message.senderAvatar ?? message.sender_avatar ?? participant?.avatar ?? null,
      isAdmin: participant?.isAdmin === true ||
        participant?.role === 'admin' ||
        participant?.user_role === 'admin' ||
        participant?.member?.role === 'admin' ||
        isCurrentUserAdmin
    };
  };

  // Show an author label at the start of every sender sequence, including our
  // own messages ("Você"), just like the grouped message layout in WhatsApp.
  const shouldShowSenderHeader = useMemo(() => {
    if (!isGroup) return false;
    if (index === 0) return true;

    const prevMessage = messages[index - 1];
    const prevSenderId = prevMessage?.sender_id ?? prevMessage?.senderId;
    const prevCreatedAt = prevMessage?.created_at ?? prevMessage?.createdAt;

    if (normalizeUserId(prevSenderId) !== normalizedSenderId) return true;

    if (prevCreatedAt && createdAt) {
      const timeDiff = Math.abs(new Date(createdAt) - new Date(prevCreatedAt));
      if (timeDiff > 5 * 60 * 1000) return true;
    }

    return false;
  }, [index, messages, normalizedSenderId, createdAt, isGroup]);

  // Check if should show avatar (first in sequence or after time gap)
  const shouldShowAvatar = useMemo(() => {
    if (!isGroup || isSent) return false;
    if (index === 0) return true;

    const prevMessage = messages[index - 1];
    const prevSenderId = prevMessage?.sender_id ?? prevMessage?.senderId;
    const prevCreatedAt = prevMessage?.created_at ?? prevMessage?.createdAt;

    // Different sender
    if (normalizeUserId(prevSenderId) !== normalizedSenderId) return true;

    // Message history may be returned oldest-first or newest-first.
    if (prevCreatedAt && createdAt) {
      const timeDiff = Math.abs(new Date(createdAt) - new Date(prevCreatedAt));
      if (timeDiff > 5 * 60 * 1000) return true;
    }

    return false;
  }, [index, messages, normalizedSenderId, createdAt, isGroup, isSent]);

  // Check if next message is from same sender (for grouping visual style)
  const isLastInSequence = useMemo(() => {
    if (!isGroup || isSent) return true;
    if (index === messages.length - 1) return true;

    const nextMessage = messages[index + 1];
    const nextSenderId = nextMessage?.sender_id ?? nextMessage?.senderId;
    const nextCreatedAt = nextMessage?.created_at ?? nextMessage?.createdAt;

    // Different sender
    if (normalizeUserId(nextSenderId) !== normalizedSenderId) return true;

    // Message history may be returned oldest-first or newest-first.
    if (nextCreatedAt && createdAt) {
      const timeDiff = Math.abs(new Date(nextCreatedAt) - new Date(createdAt));
      if (timeDiff > 5 * 60 * 1000) return true;
    }

    return false;
  }, [index, messages, normalizedSenderId, createdAt, isGroup, isSent]);

  // Check if should show date separator
  const showDate = useMemo(() => {
    if (!showDateSeparator) return false;
    if (index === 0) return true;

    const prevMessage = messages[index - 1];
    const prevCreatedAt = prevMessage?.created_at ?? prevMessage?.createdAt;

    if (!prevCreatedAt || !createdAt) return false;

    const prevDate = new Date(prevCreatedAt).toDateString();
    const currDate = new Date(createdAt).toDateString();

    return prevDate !== currDate;
  }, [index, messages, createdAt, showDateSeparator]);

  // Format date for separator
  const formatDateSeparator = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  // Format time for message
  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to get file type icon based on extension or MIME type
  const getFileIcon = (fileName, fileType, messageType) => {
    const ext = fileName ? fileName.split('.').pop()?.toLowerCase() : '';
    const mime = fileType ? fileType.toLowerCase() : '';

    // Image types
    if (messageType === 'image' || mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return <FileImage size={28} color="var(--color-primary)" />;
    }

    // PDF
    if (mime === 'application/pdf' || ext === 'pdf') {
      return <FileText size={28} color="#e74c3c" />;
    }

    // Word documents
    if (mime.includes('word') || mime.includes('msword') || ['doc', 'docx'].includes(ext)) {
      return <FileText size={28} color="#2980b9" />;
    }

    // Excel/Spreadsheet
    if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet size={28} color="#27ae60" />;
    }

    // PowerPoint/Presentation
    if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
      return <FileText size={28} color="#e67e22" />;
    }

    // Archive
    if (mime.includes('zip') || mime.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive size={28} color="#8e44ad" />;
    }

    // Audio
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
      return <Music size={28} color="#3498db" />;
    }

    // Video
    if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      return <Video size={28} color="#9b59b6" />;
    }

    // Code/Text files
    if (mime.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h'].includes(ext)) {
      return <FileCode size={28} color="#34495e" />;
    }

    // Default
    return <FileText size={28} color="var(--text-secondary)" />;
  };

  // Handle keyboard navigation for modal
  useEffect(() => {
    if (isImageExpanded) {
      previousActiveElement.current = document.activeElement;
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsImageExpanded(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
  }, [isImageExpanded]);

  // Handle image click to expand
  const handleImageClick = (url, e) => {
    e?.stopPropagation();
    setIsImageExpanded(true);
    onImageClick?.(url);
  };

  // Handle download
  const handleDownload = (url, name, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    const link = document.createElement('a');
    link.href = url;
    link.download = name || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const senderInfo = getSenderInfo();
  const time = formatTime(createdAt);

  // Determine message classes
  const isFirstInGroupSequence = isGroup && !isSent && shouldShowSenderHeader;
  const isContinueInGroupSequence = isGroup && !isSent && !shouldShowSenderHeader;

  const bubbleClasses = [
    'message-bubble',
    isSent ? 'sent' : 'received',
    isGroup && !isSent ? 'group-message' : '',
    isFirstInGroupSequence ? 'group-first' : '',
    isContinueInGroupSequence ? 'group-continue' : '',
    isLastInSequence ? 'group-last' : '',
    isError ? 'error' : '',
    isSending ? 'sending' : ''
  ].filter(Boolean).join(' ');

  const groupHeaderClasses = [
    'group-sender-header',
    shouldShowSenderHeader ? 'visible' : 'hidden'
  ].filter(Boolean).join(' ');

  const avatarClasses = [
    'group-sender-avatar',
    shouldShowAvatar ? 'visible' : 'hidden'
  ].filter(Boolean).join(' ');

  // Status text for accessibility
  const getStatusText = () => {
    if (isError) return 'Erro no envio';
    if (isSending) return 'Enviando';
    if (isRead) return 'Lida';
    if (isDelivered) return 'Entregue';
    return 'Enviada';
  };

  return (
    <React.Fragment>
      {/* Date Separator */}
      {showDate && (
        <div className="date-separator" role="separator" aria-label={formatDateSeparator(createdAt)}>
          <span>{formatDateSeparator(createdAt)}</span>
        </div>
      )}

      {/* Group sender label: own messages are identified as "Você". */}
      {isGroup && shouldShowSenderHeader && (
        <div
          className={`${groupHeaderClasses}${isSent ? ' own' : ''}`}
          role="presentation"
        >
          {!isSent && (
            <Avatar
              user={{ avatar: senderInfo.avatar, name: senderInfo.name }}
              size={28}
              className={avatarClasses}
              aria-hidden="true"
            />
          )}
          <span className={`group-sender-name${isSent ? ' own' : ''}`} id={`sender-name-${message.id}`}>
            {senderInfo.name}
          </span>
          {senderInfo.isAdmin && (
            <span className="group-sender-admin-badge" aria-label="Administrador">
              <Shield size={10} />
            </span>
          )}
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={bubbleClasses}
        style={{
          '--bubble-max-width': '75%',
          '--avatar-size': '28px'
        }}
        data-message-id={message.id}
        role="article"
        aria-label={isSent ? 'Mensagem enviada' : 'Mensagem recebida'}
        aria-labelledby={isGroup && shouldShowSenderHeader ? `sender-name-${message.id}` : undefined}
      >
        {/* Message Content */}
        <div className="message-content">
          {/* Image Message */}
          {messageType === 'image' && mediaUrl && (
            <div className="message-image-wrapper" role="img" aria-label={`Imagem: ${content || 'sem descrição'}`}>
              <img
                src={mediaUrl}
                alt={content || 'Imagem compartilhada'}
                className="message-image"
                onClick={(e) => handleImageClick(mediaUrl, e)}
                loading="lazy"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleImageClick(mediaUrl, e);
                  }
                }}
              />
              {content && (
                <div className="message-image-caption">{content}</div>
              )}
              {/* Expand hint */}
              <div className="image-expand-hint" aria-hidden="true">
                <Maximize2 size={16} />
                <span>Clique para ampliar</span>
              </div>
            </div>
          )}

          {/* Document/File Message */}
          {(messageType === 'document' || messageType === 'file') && mediaUrl && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="message-document"
              onClick={(e) => {
                if (e.target.closest('.document-download-btn')) {
                  e.preventDefault();
                  handleDownload(mediaUrl, fileName, e);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(mediaUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              aria-label={`Arquivo: ${fileName || 'Documento'}, ${formatFileSize(fileSize)}`}
            >
              <div className="document-icon" aria-hidden="true">
                {getFileIcon(fileName, fileType, messageType)}
              </div>
              <div className="document-info">
                <span className="document-name">{fileName || content || 'Documento'}</span>
                <span className="document-meta">
                  {formatFileSize(fileSize)}
                  {fileType && ` • ${fileType}`}
                </span>
              </div>
              <button
                type="button"
                className="document-download-btn"
                onClick={(e) => handleDownload(mediaUrl, fileName, e)}
                aria-label={`Baixar ${fileName || 'documento'}`}
                tabIndex={0}
              >
                <Download size={18} aria-hidden="true" />
              </button>
            </a>
          )}

          {/* Text Message */}
          {(messageType === 'text' || !mediaUrl) && content && (
            <div className="message-text" dir="auto">
              {content}
            </div>
          )}

          {/* Sending/Error Indicator */}
          {(isSending || isError) && (
            <div className="message-status-indicator" role="status" aria-live="polite">
              {isSending && (
                <span className="sending-spinner" aria-label="Enviando...">⏳</span>
              )}
              {isError && (
                <button
                  type="button"
                  className="error-retry-btn"
                  onClick={() => onRetry?.(message.id)}
                  aria-label="Tentar novamente"
                >
                  <X size={12} aria-hidden="true" />
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>

        {/* Message Footer: Time + Read Receipts (sent) or just Time (received) */}
        <div className="message-footer">
          <time className="message-time" dateTime={createdAt}>{time}</time>

          {isSent && (
            <span
              className={`message-read-receipt ${isRead ? 'read' : isDelivered ? 'delivered' : 'sent'}`}
              aria-label={getStatusText()}
              role="img"
            >
              {isRead ? (
                <>
                  <CheckCheck size={14} aria-hidden="true" />
                  <span className="sr-only">Lida</span>
                </>
              ) : isDelivered ? (
                <>
                  <CheckCheck size={14} aria-hidden="true" />
                  <span className="sr-only">Entregue</span>
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden="true" />
                  <span className="sr-only">Enviada</span>
                </>
              )}
            </span>
          )}

          {isError && (
            <span className="message-error-icon" aria-label="Erro no envio" role="img">
              ⚠
            </span>
          )}
        </div>

        {/* Context Menu (on right-click or long press) - optional */}
        {/* <div className="message-context-menu">...</div> */}
      </div>

      {/* Image Expansion Modal with Zoom/Pan */}
      {isImageExpanded && mediaUrl && messageType === 'image' && (
        <div
          className="image-modal-overlay"
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Imagem ampliada${content ? `: ${content}` : ''}`}
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsImageExpanded(false);
            }
          }}
        >
          <div className="image-modal-content" ref={imageContainerRef}>
            <div className="image-modal-toolbar" aria-label="Controles de imagem">
              <button
                type="button"
                className="image-modal-toolbar-btn"
                onClick={() => setZoom(Math.min(zoom + 0.5, 5))}
                aria-label="Aumentar zoom"
                disabled={zoom >= 5}
              >
                <ZoomIn size={20} />
              </button>
              <button
                type="button"
                className="image-modal-toolbar-btn"
                onClick={() => setZoom(Math.max(zoom - 0.5, 0.5))}
                aria-label="Diminuir zoom"
                disabled={zoom <= 0.5}
              >
                <ZoomOut size={20} />
              </button>
              <button
                type="button"
                className="image-modal-toolbar-btn"
                onClick={() => setRotation(rotation + 90)}
                aria-label="Rotacionar"
              >
                <RotateCw size={20} />
              </button>
              <button
                type="button"
                className="image-modal-toolbar-btn"
                onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); setRotation(0); }}
                aria-label="Resetar zoom"
              >
                <Maximize2 size={20} />
              </button>
              <span className="zoom-level" aria-live="polite">{Math.round(zoom * 100)}%</span>
            </div>
            <button
              type="button"
              className="image-modal-close"
              onClick={() => setIsImageExpanded(false)}
              aria-label="Fechar imagem ampliada"
            >
              <X size={24} />
            </button>
            <div
              className="image-modal-image-wrapper"
              onWheel={(e) => handleWheel(e)}
              onMouseDown={(e) => handleMouseDown(e)}
              onTouchStart={(e) => handleTouchStart(e)}
            >
              <img
                src={mediaUrl}
                alt={content || 'Imagem compartilhada'}
                className="image-modal-image"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in'
                }}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
            </div>
            {content && (
              <div className="image-modal-caption">{content}</div>
            )}
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

export default MessageBubble;