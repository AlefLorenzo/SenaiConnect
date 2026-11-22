import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Image, Video, Send, AtSign, Smile, MoreHorizontal, PenTool, Crop, Lock, Users, UserMinus, UserPlus, MessageSquare, Heart } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import { storiesService } from '../services/storiesService';
import './CreateStory.css';

const MAX_STORY_TEXT = 2200;
const STORY_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Emoji categories for picker
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠'],
  'Gestos': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣'],
  'Corações': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '♠️', '♣️', '♦️', '♣️'],
  'Objetos': ['📷', '📸', '🎥', '🎬', '📹', '📼', '🔍', '🔎', '💡', '💭', '💬', '💭', '💤', '💨', '💥', '💫', '💦', '💧', '🌊', '🔥', '✨', '⭐', '🌟', '💯', '🎯', '🎪', '🎨', '🎭', '🎪', '🎨', '🎭', '🎪', '🎨', '🎭'],
};

const backgroundColors = [
  '#0D8ABC', '#0056D2', '#00C6FF', '#3178c6',
  '#667eea', '#764ba2', '#f093fb', '#f5576c',
  '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
  '#fa709a', '#fee140', '#ff6b6b', '#feca57',
  '#1e90ff', '#32cd32', '#ff69b4', '#ffa500',
];

const privacyOptions = [
  { value: 'public', label: 'Público', description: 'Todos podem ver', icon: '🌍' },
  { value: 'followers', label: 'Meus contatos', description: 'Apenas quem te segue', icon: '👥' },
  { value: 'close_friends', label: 'Melhores amigos', description: 'Lista selecionada', icon: '⭐' },
];

const CreateStory = ({ isOpen, onClose, onStoryCreated }) => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('camera'); // 'camera', 'text', 'gallery'
  const [textContent, setTextContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#0D8ABC');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video'
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState([]);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgressRef = useRef(false);
  const [error, setError] = useState(null);

  // Text overlay/drawing tools state
  const [overlayElements, setOverlayElements] = useState([]); // Text, emojis, drawings on media
  const [selectedOverlay, setSelectedOverlay] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('Smileys');
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#FFFFFF');
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(4);
  const [cropMode, setCropMode] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [privacy, setPrivacy] = useState('public');
  const [privacyExceptions, setPrivacyExceptions] = useState([]); // { user_id, exception_type: 'exclude' | 'include' }
  const [showExceptionSearch, setShowExceptionSearch] = useState(false);
  const [exceptionQuery, setExceptionQuery] = useState('');
  const [exceptionUsers, setExceptionUsers] = useState([]);
  const [exceptionType, setExceptionType] = useState('exclude');

  const textareaRef = useRef(null);
  const mentionTriggerRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Keep the underlying Home feed fixed while the story composer is open.
  useEffect(() => {
    if (!isOpen) return undefined;

    const body = document.body;
    const html = document.documentElement;
    const appMain = document.querySelector('.app-main');
    const scrollY = window.scrollY;
    const mainScrollTop = appMain?.scrollTop ?? 0;
    const previousStyles = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      mainOverflow: appMain?.style.overflow ?? '',
      mainOverflowY: appMain?.style.overflowY ?? '',
      mainOverscrollBehavior: appMain?.style.overscrollBehavior ?? '',
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    if (appMain) {
      appMain.style.overflow = 'hidden';
      appMain.style.overflowY = 'hidden';
      appMain.style.overscrollBehavior = 'none';
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.position = previousStyles.bodyPosition;
      body.style.top = previousStyles.bodyTop;
      body.style.left = previousStyles.bodyLeft;
      body.style.right = previousStyles.bodyRight;
      body.style.width = previousStyles.bodyWidth;
      body.style.overflow = previousStyles.bodyOverflow;
      html.style.overflow = previousStyles.htmlOverflow;
      html.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;

      if (appMain) {
        appMain.style.overflow = previousStyles.mainOverflow;
        appMain.style.overflowY = previousStyles.mainOverflowY;
        appMain.style.overscrollBehavior = previousStyles.mainOverscrollBehavior;
        appMain.scrollTop = mainScrollTop;
      }

      if (scrollY !== 0) window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      // Focus textarea when text tab is active
      setTimeout(() => {
        if (activeTab === 'text' && textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const resetForm = () => {
    setTextContent('');
    setBackgroundColor('#0D8ABC');
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setShowMentions(false);
    setMentionQuery('');
    setMentionUsers([]);
    setSelectedMentions([]);
    setOverlayElements([]);
    setSelectedOverlay(null);
    setShowEmojiPicker(false);
    setDrawingMode(false);
    setCropMode(false);
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
    setShowPrivacySettings(false);
    setPrivacy('public');
    setPrivacyExceptions([]);
    setShowExceptionSearch(false);
    setExceptionQuery('');
    setExceptionUsers([]);
    setError(null);
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_STORY_TEXT) {
      setTextContent(value);
      handleMentionTrigger(value);
    }
  };

  const handleMentionTrigger = useCallback((value) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && lastAtIndex === textBeforeCursor.length - 1 ||
        (lastAtIndex !== -1 && /^@[\w.]*$/.test(textBeforeCursor.slice(lastAtIndex)))) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      mentionTriggerRef.current = { start: lastAtIndex, end: cursorPos };
      if (query.length > 0 || query.length === 0) {
        setShowMentions(true);
        setMentionQuery(query);
        searchMentions(query);
      }
    } else {
      setShowMentions(false);
    }
  }, []);

  const searchMentions = async (query) => {
    try {
      const users = await storiesService.searchUsersForMentions(query || '');
      setMentionUsers(users.filter(u => u.id !== user?.id));
    } catch (err) {
      console.error('Erro ao buscar usuários para menção:', err);
    }
  };

  const selectMention = (mentionedUser) => {
    const { start, end } = mentionTriggerRef.current || { start: 0, end: 0 };
    const beforeMention = textContent.slice(0, start);
    const afterMention = textContent.slice(end);
    const mentionText = `@${mentionedUser.username} `;

    const newText = beforeMention + mentionText + afterMention;
    setTextContent(newText);
    setSelectedMentions(prev => [...prev, mentionedUser]);
    setShowMentions(false);
    setMentionQuery('');

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = beforeMention.length + mentionText.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleBackgroundColorClick = (color) => {
    setBackgroundColor(color);
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setError('Tipo de arquivo não suportado. Use imagens ou vídeos.');
      return;
    }

    const selectedMediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const maxSize = selectedMediaType === 'video' ? 35 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(selectedMediaType === 'video' ? 'Vídeo deve ter no máximo 35MB' : 'Imagem deve ter no máximo 10MB');
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setOverlayElements([]); // Clear overlays when new media selected
    setError(null);
  };

  const removeMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setOverlayElements([]);
  };

  // Text overlay functions
  const addTextOverlay = () => {
    if (!mediaPreview) return;
    const newOverlay = {
      id: Date.now(),
      type: 'text',
      content: 'Toque para editar',
      x: 50, // percentage
      y: 50,
      fontSize: 24,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.5)',
      fontWeight: 'normal',
      textAlign: 'center',
      rotation: 0,
      scale: 1,
    };
    setOverlayElements(prev => [...prev, newOverlay]);
    setSelectedOverlay(newOverlay.id);
  };

  const addEmojiOverlay = (emoji) => {
    if (!mediaPreview) return;
    const newOverlay = {
      id: Date.now(),
      type: 'emoji',
      content: emoji,
      x: 50,
      y: 50,
      fontSize: 48,
      rotation: 0,
      scale: 1,
    };
    setOverlayElements(prev => [...prev, newOverlay]);
    setSelectedOverlay(newOverlay.id);
    setShowEmojiPicker(false);
  };

  const updateOverlay = (id, updates) => {
    setOverlayElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    if (selectedOverlay === id) {
      setSelectedOverlay({ ...selectedOverlay, ...updates });
    }
  };

  const deleteOverlay = (id) => {
    setOverlayElements(prev => prev.filter(el => el.id !== id));
    if (selectedOverlay === id) setSelectedOverlay(null);
  };

  const selectOverlay = (id) => {
    const overlay = overlayElements.find(el => el.id === id);
    setSelectedOverlay(overlay);
  };

  const handleOverlayDrag = (id, dx, dy) => {
    const overlay = overlayElements.find(el => el.id === id);
    if (!overlay || !overlayContainerRef.current) return;

    const containerRect = overlayContainerRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(100, overlay.x + (dx / containerRect.width) * 100));
    const newY = Math.max(0, Math.min(100, overlay.y + (dy / containerRect.height) * 100));
    updateOverlay(id, { x: newX, y: newY });
  };

  // Drawing functions
  const startDrawing = () => {
    setDrawingMode(true);
    setSelectedOverlay(null);
  };

  const stopDrawing = () => {
    setDrawingMode(false);
  };

  const addDrawingStroke = (stroke) => {
    const newOverlay = {
      id: Date.now(),
      type: 'drawing',
      strokes: [stroke],
      color: drawingColor,
      strokeWidth: drawingStrokeWidth,
    };
    setOverlayElements(prev => [...prev, newOverlay]);
  };

  // Crop functions
  const startCrop = () => {
    if (!mediaPreview || mediaType !== 'image') return;
    setCropMode(true);
    // Initialize crop area to center 80% of image
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
  };

  // Resize the crop rectangle from the selected corner.
  const startCropDrag = (event, handle) => {
    event.preventDefault();
    event.stopPropagation();

    const bounds = overlayContainerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { ...cropArea };
    const minSize = 10;

    const handleMove = (moveEvent) => {
      const dx = ((moveEvent.clientX - startX) / bounds.width) * 100;
      const dy = ((moveEvent.clientY - startY) / bounds.height) * 100;
      let { x, y, width, height } = initial;

      if (handle.includes('l')) {
        const right = initial.x + initial.width;
        x = Math.min(right - minSize, Math.max(0, initial.x + dx));
        width = right - x;
      } else if (handle.includes('r')) {
        width = Math.min(100 - initial.x, Math.max(minSize, initial.width + dx));
      }

      if (handle.includes('t')) {
        const bottom = initial.y + initial.height;
        y = Math.min(bottom - minSize, Math.max(0, initial.y + dy));
        height = bottom - y;
      } else if (handle.includes('b')) {
        height = Math.min(100 - initial.y, Math.max(minSize, initial.height + dy));
      }

      setCropArea({ x, y, width, height });
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd, { once: true });
  };

  const applyCrop = async () => {
    if (!mediaFile || !mediaRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = mediaRef.current;

      // Wait for image to load
      await new Promise((resolve) => {
        if (img.complete) resolve();
        else img.onload = resolve;
      });

      // Calculate crop dimensions
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const cropX = (cropArea.x / 100) * img.naturalWidth;
      const cropY = (cropArea.y / 100) * img.naturalHeight;
      const cropWidth = (cropArea.width / 100) * img.naturalWidth;
      const cropHeight = (cropArea.height / 100) * img.naturalHeight;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Convert to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mediaFile.type, 0.9));
      const croppedFile = new File([blob], mediaFile.name, { type: mediaFile.type });

      // Update preview
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      const newPreview = URL.createObjectURL(croppedFile);
      setMediaFile(croppedFile);
      setMediaPreview(newPreview);
      setCropMode(false);
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
      setError('Erro ao recortar imagem');
    }
  };

  // Privacy exceptions functions
  const searchExceptionUsers = async (query) => {
    try {
      const users = await storiesService.searchUsersForMentions(query || '');
      setExceptionUsers(users.filter(u => u.id !== user?.id));
    } catch (err) {
      console.error('Erro ao buscar usuários para exceção:', err);
    }
  };

  const addPrivacyException = (selectedUser) => {
    setPrivacyExceptions(prev => {
      const exists = prev.find(e => e.user_id === selectedUser.id);
      if (exists) {
        return prev.map(e => e.user_id === selectedUser.id ? { ...e, exception_type: exceptionType } : e);
      }
      return [...prev, { user_id: selectedUser.id, exception_type: exceptionType, name: selectedUser.name, username: selectedUser.username, avatar: selectedUser.avatar }];
    });
    setShowExceptionSearch(false);
    setExceptionQuery('');
  };

  const removePrivacyException = (userId) => {
    setPrivacyExceptions(prev => prev.filter(e => e.user_id !== userId));
  };

  const handleSubmit = async () => {
    if (submitInProgressRef.current) return;
    if (!textContent.trim() && !mediaFile && overlayElements.length === 0) {
      setError('Adicione texto ou mídia para criar a história');
      return;
    }

    submitInProgressRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare text overlay data for media stories
      let textOverlayData = null;
      if (mediaFile && overlayElements.length > 0) {
        textOverlayData = overlayElements.map(el => ({
          id: el.id,
          type: el.type,
          content: el.content,
          x: el.x,
          y: el.y,
          fontSize: el.fontSize,
          color: el.color,
          backgroundColor: el.backgroundColor,
          fontWeight: el.fontWeight,
          textAlign: el.textAlign,
          rotation: el.rotation,
          scale: el.scale,
          strokes: el.strokes,
          strokeWidth: el.strokeWidth,
        }));
      }

      const storyData = {
        text: textContent.trim() || undefined,
        backgroundColor: activeTab === 'text' ? backgroundColor : undefined,
        image: mediaType === 'image' ? mediaFile : undefined,
        video: mediaType === 'video' ? mediaFile : undefined,
        privacy,
        privacy_exceptions: privacyExceptions.length > 0 ? privacyExceptions : undefined,
        text_overlay_data: textOverlayData,
      };

      const newStory = await storiesService.createStory(storyData);

      if (onStoryCreated) {
        onStoryCreated(newStory);
      }

      onClose();
    } catch (err) {
      console.error('Erro ao criar história:', err);
      setError('Erro ao criar história. Tente novamente.');
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const charCount = textContent.length;
  const isOverLimit = charCount > MAX_STORY_TEXT;

  if (!isOpen) return null;

  // Get emojis for active category
  const activeEmojis = EMOJI_CATEGORIES[activeEmojiCategory] || [];

  return createPortal(
    <div className="create-story-overlay" role="dialog" aria-modal="true" aria-label="Criar história">
      <div className="create-story-container">
        {/* Header */}
        <div className="create-story-header">
          <h2>Criar história</h2>
          <div className="header-actions">
            {mediaFile && mediaType === 'image' && !cropMode && (
              <button className="header-tool-btn" onClick={startCrop} aria-label="Recortar">
                <Crop size={22} />
              </button>
            )}
            {mediaFile && (
              <button className="header-tool-btn" onClick={addTextOverlay} aria-label="Adicionar texto">
                <PenTool size={22} />
              </button>
            )}
            {mediaFile && (
              <button className="header-tool-btn" onClick={() => setShowEmojiPicker(true)} aria-label="Adicionar emoji">
                <Smile size={22} />
              </button>
            )}
            {mediaFile && (
              <button className="header-tool-btn" onClick={startDrawing} aria-label="Desenhar">
                <MessageSquare size={22} />
              </button>
            )}
            <button className="header-tool-btn" onClick={() => setShowPrivacySettings(true)} aria-label="Privacidade">
              <Lock size={22} />
            </button>
            <button className="create-story-close" onClick={onClose} aria-label="Fechar">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="create-story-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'camera'}
            className={activeTab === 'camera' ? 'active' : ''}
            onClick={() => { setActiveTab('camera'); setShowMentions(false); }}
          >
            <Image size={20} /> Câmera
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'text'}
            className={activeTab === 'text' ? 'active' : ''}
            onClick={() => { setActiveTab('text'); setShowMentions(false); }}
          >
            <AtSign size={20} /> Texto
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'gallery'}
            className={activeTab === 'gallery' ? 'active' : ''}
            onClick={() => { setActiveTab('gallery'); setShowMentions(false); }}
          >
            <Smile size={20} /> Galeria
          </button>
        </div>

        {/* Content */}
        <div className="create-story-content">
          {activeTab === 'text' && (
            <div className="create-story-text">
              <div className="text-story-preview" style={{ backgroundColor }}>
                <textarea
                  ref={textareaRef}
                  className="story-textarea"
                  value={textContent}
                  onChange={handleTextChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Escreva algo..."
                  maxLength={MAX_STORY_TEXT}
                  spellCheck={false}
                  aria-label="Texto da história"
                />
                <div className="text-story-char-count">
                  <span className={isOverLimit ? 'over-limit' : ''}>
                    {charCount}/{MAX_STORY_TEXT}
                  </span>
                </div>
              </div>

              <div className="background-colors" role="group" aria-label="Cores de fundo">
                {backgroundColors.map((color) => (
                  <button
                    key={color}
                    className={`color-option ${backgroundColor === color ? 'selected' : ''}`}
                    onClick={() => handleBackgroundColorClick(color)}
                    style={{ backgroundColor: color }}
                    aria-label={`Cor de fundo ${color}`}
                    aria-pressed={backgroundColor === color}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="create-story-camera">
              {mediaPreview ? (
                <div className="media-preview-wrapper" ref={overlayContainerRef}>
                  <div className="media-preview" style={{ position: 'relative' }}>
                    {cropMode ? (
                      <div className="crop-overlay">
                        <div
                          className="crop-area"
                          style={{
                            left: `${cropArea.x}%`,
                            top: `${cropArea.y}%`,
                            width: `${cropArea.width}%`,
                            height: `${cropArea.height}%`,
                          }}
                        >
                          <div className="crop-handle handle-tl" onMouseDown={(e) => startCropDrag(e, 'tl')} />
                          <div className="crop-handle handle-tr" onMouseDown={(e) => startCropDrag(e, 'tr')} />
                          <div className="crop-handle handle-bl" onMouseDown={(e) => startCropDrag(e, 'bl')} />
                          <div className="crop-handle handle-br" onMouseDown={(e) => startCropDrag(e, 'br')} />
                        </div>
                        <div className="crop-dimmed" />
                        {mediaType === 'image' ? (
                          <img ref={mediaRef} src={mediaPreview} alt="Prévia para recorte" className="crop-source" />
                        ) : (
                          <video ref={mediaRef} src={mediaPreview} muted className="crop-source" />
                        )}
                      </div>
                    ) : (
                      <>
                        {mediaType === 'image' ? (
                          <img ref={mediaRef} src={mediaPreview} alt="Prévia da imagem" />
                        ) : (
                          <video ref={mediaRef} src={mediaPreview} controls muted />
                        )}
                        {/* Overlay elements (text, emojis, drawings) */}
                        {overlayElements.map((overlay) => (
                          <OverlayElement
                            key={overlay.id}
                            overlay={overlay}
                            isSelected={selectedOverlay === overlay.id}
                            onSelect={selectOverlay}
                            onUpdate={updateOverlay}
                            onDelete={deleteOverlay}
                            onDrag={handleOverlayDrag}
                          />
                        ))}
                        {/* Drawing canvas */}
                        {drawingMode && (
                          <DrawingCanvas
                            onStrokeComplete={addDrawingStroke}
                            color={drawingColor}
                            strokeWidth={drawingStrokeWidth}
                            onCancel={stopDrawing}
                          />
                        )}
                      </>
                    )}
                    <button className="remove-media" onClick={removeMedia} aria-label="Remover mídia">
                      <X size={20} />
                    </button>
                  </div>

                  {/* Crop mode toolbar */}
                  {cropMode && (
                    <div className="crop-toolbar">
                      <button className="crop-btn cancel" onClick={() => setCropMode(false)}>Cancelar</button>
                      <span className="crop-instructions">Arraste as bordas para ajustar o recorte</span>
                      <button className="crop-btn apply" onClick={applyCrop}>Aplicar</button>
                    </div>
                  )}

                  {/* Drawing mode toolbar */}
                  {drawingMode && (
                    <div className="drawing-toolbar">
                      <button className="drawing-btn cancel" onClick={stopDrawing}>Cancelar</button>
                      <div className="drawing-tools">
                        <label>Cor: <input type="color" value={drawingColor} onChange={(e) => setDrawingColor(e.target.value)} /></label>
                        <label>Espessura: <input type="range" min="1" max="20" value={drawingStrokeWidth} onChange={(e) => setDrawingStrokeWidth(Number(e.target.value))} />{drawingStrokeWidth}px</label>
                      </div>
                      <button className="drawing-btn done" onClick={stopDrawing}>Concluir</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="camera-placeholder">
                  <div className="camera-icon">
                    <Image size={48} />
                  </div>
                  <p>Toque para adicionar foto ou vídeo</p>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    className="hidden-file-input"
                    id="story-media-input"
                    capture="environment"
                  />
                  <label htmlFor="story-media-input" className="camera-button">
                    <Image size={24} />
                    <span>Escolher arquivo</span>
                  </label>
                </div>
              )}

              {mediaFile && !cropMode && !drawingMode && (
                <div className="media-caption">
                  <textarea
                    value={textContent}
                    onChange={handleTextChange}
                    placeholder="Adicione uma legenda..."
                    maxLength={MAX_STORY_TEXT}
                    spellCheck={false}
                    aria-label="Legenda da mídia"
                  />
                  <div className="media-caption-char-count">
                    <span className={isOverLimit ? 'over-limit' : ''}>
                      {charCount}/{MAX_STORY_TEXT}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="create-story-gallery">
              <p className="gallery-placeholder">Selecione da galeria (em desenvolvimento)</p>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
                className="hidden-file-input"
                id="gallery-media-input"
              />
              <label htmlFor="gallery-media-input" className="gallery-button">
                <Image size={24} />
                <span>Escolher da galeria</span>
              </label>
            </div>
          )}

          {/* Mentions dropdown */}
          {showMentions && mentionUsers.length > 0 && (
            <div className="mentions-dropdown" role="listbox" aria-label="Usuários para mencionar">
              {mentionUsers.map((u) => (
                <button
                  key={u.id}
                  role="option"
                  className="mention-user"
                  onClick={() => selectMention(u)}
                >
                  <img
                    src={u.avatar ? `/uploads/avatars/${u.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0D8ABC&color=fff`}
                    alt=""
                    className="mention-avatar"
                  />
                  <div className="mention-info">
                    <span className="mention-name">{u.name}</span>
                    <span className="mention-username">@{u.username}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected mentions tags */}
          {selectedMentions.length > 0 && (
            <div className="selected-mentions" aria-label="Menções selecionadas">
              {selectedMentions.map((u) => (
                <span key={u.id} className="mention-tag">
                  @{u.username}
                  <button type="button" onClick={() => setSelectedMentions(prev => prev.filter(m => m.id !== u.id))} aria-label={`Remover @${u.username}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(false)}>
              <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
                <div className="emoji-picker-header">
                  <div className="emoji-categories" role="tablist">
                    {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                      <button
                        key={cat}
                        role="tab"
                        className={activeEmojiCategory === cat ? 'active' : ''}
                        onClick={() => setActiveEmojiCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button className="emoji-close" onClick={() => setShowEmojiPicker(false)} aria-label="Fechar">
                    <X size={20} />
                  </button>
                </div>
                <div className="emoji-grid" role="tabpanel">
                  {activeEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      className="emoji-btn"
                      onClick={() => addEmojiOverlay(emoji)}
                      aria-label={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Privacy Settings Modal */}
          {showPrivacySettings && (
            <div className="privacy-modal-overlay" onClick={() => setShowPrivacySettings(false)}>
              <div className="privacy-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Privacidade da história">
                <div className="privacy-modal-header">
                  <h3>Quem pode ver</h3>
                  <button className="modal-close" onClick={() => setShowPrivacySettings(false)} aria-label="Fechar">
                    <X size={20} />
                  </button>
                </div>
                <div className="privacy-options">
                  {privacyOptions.map((opt) => (
                    <label key={opt.value} className={`privacy-option ${privacy === opt.value ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="story-privacy"
                        value={opt.value}
                        checked={privacy === opt.value}
                        onChange={() => setPrivacy(opt.value)}
                      />
                      <div className="privacy-option-content">
                        <span className="privacy-icon">{opt.icon}</span>
                        <div>
                          <span className="privacy-label">{opt.label}</span>
                          <span className="privacy-desc">{opt.description}</span>
                        </div>
                      </div>
                      <div className="privacy-check" />
                    </label>
                  ))}
                </div>

                {/* Privacy Exceptions for followers/close_friends */}
                {(privacy === 'followers' || privacy === 'close_friends') && (
                  <div className="privacy-exceptions">
                    <h4>
                      {privacy === 'followers' ? 'Meus contatos, exceto...' : 'Compartilhar apenas com...'}
                    </h4>
                    <div className="exception-search">
                      <input
                        type="text"
                        placeholder={privacy === 'followers' ? 'Digite para excluir contatos...' : 'Digite para selecionar contatos...'}
                        value={exceptionQuery}
                        onChange={(e) => {
                          setExceptionQuery(e.target.value);
                          setShowExceptionSearch(true);
                          searchExceptionUsers(e.target.value);
                        }}
                        onFocus={() => {
                          setShowExceptionSearch(true);
                          searchExceptionUsers(exceptionQuery);
                        }}
                      />
                      <select
                        value={exceptionType}
                        onChange={(e) => setExceptionType(e.target.value)}
                        className="exception-type-select"
                      >
                        <option value="exclude">Não mostrar para (exceto)</option>
                        <option value="include">Mostrar apenas para (somente)</option>
                      </select>
                    </div>

                    {showExceptionSearch && exceptionUsers.length > 0 && (
                      <div className="exception-users-dropdown">
                        {exceptionUsers.map((u) => (
                          <button
                            key={u.id}
                            className="exception-user"
                            onClick={() => addPrivacyException(u)}
                          >
                            <img
                              src={u.avatar ? `/uploads/avatars/${u.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0D8ABC&color=fff`}
                              alt=""
                              className="exception-avatar"
                            />
                            <div>
                              <span>{u.name}</span>
                              <span className="exception-username">@{u.username}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {privacyExceptions.length > 0 && (
                      <div className="selected-exceptions">
                        {privacyExceptions.map((exc) => (
                          <span key={exc.user_id} className="exception-tag">
                            {exc.exception_type === 'exclude' ? '🚫' : '✅'} @{exc.username}
                            <button type="button" onClick={() => removePrivacyException(exc.user_id)} aria-label="Remover">
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="privacy-modal-footer">
                  <button className="btn-secondary" onClick={() => setShowPrivacySettings(false)}>Cancelar</button>
                  <button className="btn-primary" onClick={() => setShowPrivacySettings(false)}>Salvar</button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="create-story-error" role="alert">{error}</div>}
        </div>

        {/* Footer */}
        <div className="create-story-footer">
          <button className="create-story-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="create-story-share"
            onClick={handleSubmit}
            disabled={isSubmitting || (!textContent.trim() && !mediaFile && overlayElements.length === 0)}
          >
            {isSubmitting ? 'Compartilhando...' : 'Compartilhar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Overlay Element Component (text, emoji, drawing)
const OverlayElement = ({ overlay, isSelected, onSelect, onUpdate, onDelete, onDrag }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const elementRef = useRef(null);

  const handleMouseDown = (e) => {
    e.stopPropagation();
    onSelect(overlay.id);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e) => {
    e.stopPropagation();
    onSelect(overlay.id);
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX && clientY) {
        onDrag(overlay.id, clientX - dragStart.x, clientY - dragStart.y);
        setDragStart({ x: clientX, y: clientY });
      }
    };
    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, dragStart, overlay.id, onDrag]);

  if (overlay.type === 'text') {
    return (
      <div
        ref={elementRef}
        className={`overlay-text ${isSelected ? 'selected' : ''}`}
        style={{
          left: `${overlay.x}%`,
          top: `${overlay.y}%`,
          transform: `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg) scale(${overlay.scale || 1})`,
          fontSize: `${overlay.fontSize}px`,
          color: overlay.color,
          backgroundColor: overlay.backgroundColor,
          fontWeight: overlay.fontWeight,
          textAlign: overlay.textAlign,
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'move',
          whiteSpace: 'pre-wrap',
          maxWidth: '80%',
          minWidth: '100px',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        contentEditable={isSelected}
        onBlur={(e) => onUpdate(overlay.id, { content: e.target.innerText })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
          }
        }}
        suppressContentEditableWarning
      >
        {overlay.content}
        {isSelected && (
          <div className="overlay-controls">
            <button onClick={(e) => { e.stopPropagation(); onDelete(overlay.id); }} aria-label="Excluir">✕</button>
            <button onClick={(e) => { e.stopPropagation(); onUpdate(overlay.id, { rotation: (overlay.rotation || 0) + 15 }); }} aria-label="Rotacionar">↻</button>
          </div>
        )}
      </div>
    );
  }

  if (overlay.type === 'emoji') {
    return (
      <div
        ref={elementRef}
        className={`overlay-emoji ${isSelected ? 'selected' : ''}`}
        style={{
          left: `${overlay.x}%`,
          top: `${overlay.y}%`,
          transform: `translate(-50%, -50%) rotate(${overlay.rotation || 0}deg) scale(${overlay.scale || 1})`,
          fontSize: `${overlay.fontSize}px`,
          cursor: 'move',
          lineHeight: 1,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {overlay.content}
        {isSelected && (
          <div className="overlay-controls">
            <button onClick={(e) => { e.stopPropagation(); onDelete(overlay.id); }} aria-label="Excluir">✕</button>
            <button onClick={(e) => { e.stopPropagation(); onUpdate(overlay.id, { rotation: (overlay.rotation || 0) + 15 }); }} aria-label="Rotacionar">↻</button>
          </div>
        )}
      </div>
    );
  }

  if (overlay.type === 'drawing') {
    return (
      <canvas
        ref={elementRef}
        className={`overlay-drawing ${isSelected ? 'selected' : ''}`}
        style={{
          left: '0%',
          top: '0%',
          width: '100%',
          height: '100%',
          pointerEvents: isSelected ? 'auto' : 'none',
          cursor: isSelected ? 'move' : 'default',
        }}
        width="100%"
        height="100%"
      />
    );
  }

  return null;
};

// Drawing Canvas Component
const DrawingCanvas = ({ onStrokeComplete, color, strokeWidth, onCancel }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState([]);

  const getCanvasPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleStart = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e, canvas);
    setIsDrawing(true);
    setCurrentStroke([{ x: point.x, y: point.y }]);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(e, canvas);
    setCurrentStroke(prev => [...prev, { x: point.x, y: point.y }]);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      onStrokeComplete({ points: currentStroke, color, strokeWidth });
    }
    setCurrentStroke([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to match container
    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDrawing]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }}
      />
    </>
  );
};

export default CreateStory;