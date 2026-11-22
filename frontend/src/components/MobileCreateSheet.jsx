import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Image, Video, FileText, MessageSquare, HelpCircle, Lightbulb, Calendar, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import './MobileCreateSheet.css';

const MobileCreateSheet = ({ isOpen, onClose, onCreatePost, onCreateStory, onNavigateHome }) => {
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  const previousActiveElement = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetHeight = useRef(0);

  // Create options - Instagram style: Post, Story, Photo, Video, Project, Question, Tip, Event
  const createOptions = [
    {
      id: 'post',
      icon: Image,
      label: 'Publicação',
      description: 'Compartilhe fotos e textos',
      action: () => {
        onCreatePost?.('post');
        onNavigateHome?.();
      },
      color: '#0066CC',
    },
    {
      id: 'story',
      icon: MessageSquare,
      label: 'História',
      description: 'Compartilhe por 24 horas',
      action: () => {
        // Set sessionStorage FIRST before navigation so Home useEffect can pick it up
        sessionStorage.setItem('createStory', 'true');
        onNavigateHome?.();
        // Dispatch event for client-side navigation handling
        console.log('Dispatching createStoryRequested event');
        window.dispatchEvent(new CustomEvent('createStoryRequested'));
      },
      color: '#F58529',
    },
    {
      id: 'photo',
      icon: Camera,
      label: 'Foto',
      description: 'Tire uma foto rápida',
      action: () => {
        onCreatePost?.('photo');
        onNavigateHome?.();
      },
      color: '#0066CC',
    },
    {
      id: 'video',
      icon: Video,
      label: 'Vídeo',
      description: 'Grave um vídeo curto',
      action: () => {
        onCreatePost?.('video');
        onNavigateHome?.();
      },
      color: '#DD2A7B',
    },
    {
      id: 'project',
      icon: Lightbulb,
      label: 'Projeto',
      description: 'Compartilhe seu projeto',
      action: () => {
        onCreatePost?.('project');
        onNavigateHome?.();
      },
      color: '#8134AF',
    },
    {
      id: 'question',
      icon: HelpCircle,
      label: 'Dúvida',
      description: 'Faça uma pergunta',
      action: () => {
        onCreatePost?.('question');
        onNavigateHome?.();
      },
      color: '#515BD4',
    },
    {
      id: 'tip',
      icon: FileText,
      label: 'Dica',
      description: 'Compartilhe uma dica útil',
      action: () => {
        onCreatePost?.('tip');
        onNavigateHome?.();
      },
      color: '#00C9FF',
    },
    {
      id: 'event',
      icon: Calendar,
      label: 'Evento',
      description: 'Crie um evento',
      action: () => {
        onCreatePost?.('event');
        onNavigateHome?.();
      },
      color: '#E53E3E',
    },
  ];

  const handleOptionClick = (option) => {
    option.action();
    onClose();
  };

  // Drag to dismiss handlers
  const handleTouchStart = useCallback((e) => {
    if (!isOpen) return;
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, [isOpen]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartY.current;
    // Only allow dragging down (positive delta)
    if (delta > 0) {
      setDragOffset(Math.min(delta, sheetHeight.current * 0.5));
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    // If dragged more than 100px or 30% of sheet height, dismiss
    if (dragOffset > 100 || dragOffset > sheetHeight.current * 0.3) {
      onClose();
    }
    setDragOffset(0);
  }, [isDragging, dragOffset, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // Trap focus within sheet
    if (e.key === 'Tab') {
      const focusableElements = sheetRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
      return undefined;
    }

    // Lock the document itself, not only body overflow. This also prevents
    // touch-driven background scrolling on mobile browsers (especially iOS).
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const previousStyles = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
    };

    previousActiveElement.current = document.activeElement;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    const focusTimer = window.setTimeout(() => {
      if (sheetRef.current) {
        sheetHeight.current = sheetRef.current.offsetHeight;
      }
      const firstFocusable = sheetRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus({ preventScroll: true });
    }, 50);

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);

      body.style.position = previousStyles.bodyPosition;
      body.style.top = previousStyles.bodyTop;
      body.style.left = previousStyles.bodyLeft;
      body.style.right = previousStyles.bodyRight;
      body.style.width = previousStyles.bodyWidth;
      body.style.overflow = previousStyles.bodyOverflow;
      html.style.overflow = previousStyles.htmlOverflow;
      html.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;

      // Restore the exact position the home feed had before opening the sheet.
      window.scrollTo(0, scrollY);
      previousActiveElement.current?.focus({ preventScroll: true });
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sheetStyle = {
    transform: `translateY(${dragOffset}px)`,
    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
    opacity: isDragging ? Math.max(0.7, 1 - dragOffset / sheetHeight.current) : 1,
  };

  return createPortal((
    <div
      className="mobile-create-sheet-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-sheet-title"
    >
      <div
        className="mobile-create-sheet"
        ref={sheetRef}
        style={sheetStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar */}
        <div className="sheet-handle" aria-hidden="true">
          <div className="handle-bar" />
        </div>

        {/* Header */}
        <header className="sheet-header">
          <h2 id="create-sheet-title" className="sheet-title">Criar</h2>
          <button
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={24} strokeWidth={2} />
          </button>
        </header>

        {/* Options Grid */}
        <div className="sheet-options" role="list" aria-label="Opções de criação">
          {createOptions.map((option) => (
            <button
              key={option.id}
              className="create-option"
              onClick={() => handleOptionClick(option)}
              role="listitem"
              style={{ '--option-color': option.color }}
            >
              <div className="option-icon-wrapper" aria-hidden="true">
                <option.icon size={24} strokeWidth={2.5} className="option-icon" />
              </div>
              <div className="option-content">
                <span className="option-label">{option.label}</span>
                <span className="option-description">{option.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  ), document.body);
};

export default MobileCreateSheet;