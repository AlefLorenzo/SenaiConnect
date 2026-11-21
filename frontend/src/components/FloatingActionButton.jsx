import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import MobileCreateSheet from './MobileCreateSheet';
import './FloatingActionButton.css';

const FloatingActionButton = ({
  isVisible = true,
  onCreatePost,
  onCreateStory,
  onNavigateHome
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const fabRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (isSheetOpen) {
        setIsSheetOpen(false);
      } else if (isExpanded) {
        setIsExpanded(false);
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (!isExpanded && !isSheetOpen) {
        e.preventDefault();
        setIsSheetOpen(true);
      }
    }
  }, [isExpanded, isSheetOpen]);

  // Focus management for accessibility
  useEffect(() => {
    if (isSheetOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      // Focus will be handled by MobileCreateSheet
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSheetOpen, handleKeyDown]);

  // Close expanded menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isExpanded && fabRef.current && !fabRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const handleFabClick = () => {
    // On mobile, open the sheet directly for better UX
    setIsSheetOpen(true);
    setIsExpanded(false);
  };

  const handleFabKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFabClick();
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fab-container" ref={fabRef}>
        <button
          className={`fab-main ${isExpanded ? 'expanded' : ''} ${isSheetOpen ? 'sheet-open' : ''}`}
          onClick={handleFabClick}
          onKeyDown={handleFabKeyDown}
          aria-label={isExpanded ? 'Fechar opções de criação' : 'Criar nova publicação'}
          aria-expanded={isExpanded || isSheetOpen}
          aria-haspopup="dialog"
          aria-controls="mobile-create-sheet"
          type="button"
        >
          <span className="fab-icon-wrapper" aria-hidden="true">
            <Plus size={24} strokeWidth={2.5} className="fab-icon-plus" />
            <X size={24} strokeWidth={2.5} className="fab-icon-close" />
          </span>
          <span className="fab-label" aria-hidden="true">Criar</span>
        </button>

        {/* Speed dial menu - quick actions */}
        <div className="fab-speed-dial" role="menu" aria-label="Ações rápidas de criação">
          <button
            className="fab-speed-dial-item"
            role="menuitem"
            onClick={() => {
              setIsSheetOpen(true);
              setIsExpanded(false);
            }}
            aria-label="Nova publicação"
          >
            <span className="speed-dial-icon" style={{ '--fab-accent': '#0066CC' }}>
              <span className="speed-dial-icon-inner" aria-hidden="true">📝</span>
            </span>
            <span className="speed-dial-label">Publicação</span>
          </button>
          <button
            className="fab-speed-dial-item"
            role="menuitem"
            onClick={() => {
              setIsSheetOpen(true);
              setIsExpanded(false);
            }}
            aria-label="Nova história"
          >
            <span className="speed-dial-icon" style={{ '--fab-accent': '#F58529' }}>
              <span className="speed-dial-icon-inner" aria-hidden="true">📖</span>
            </span>
            <span className="speed-dial-label">História</span>
          </button>
          <button
            className="fab-speed-dial-item"
            role="menuitem"
            onClick={() => {
              setIsSheetOpen(true);
              setIsExpanded(false);
            }}
            aria-label="Nova foto"
          >
            <span className="speed-dial-icon" style={{ '--fab-accent': '#0066CC' }}>
              <span className="speed-dial-icon-inner" aria-hidden="true">📷</span>
            </span>
            <span className="speed-dial-label">Foto</span>
          </button>
          <button
            className="fab-speed-dial-item"
            role="menuitem"
            onClick={() => {
              setIsSheetOpen(true);
              setIsExpanded(false);
            }}
            aria-label="Novo vídeo"
          >
            <span className="speed-dial-icon" style={{ '--fab-accent': '#DD2A7B' }}>
              <span className="speed-dial-icon-inner" aria-hidden="true">🎥</span>
            </span>
            <span className="speed-dial-label">Vídeo</span>
          </button>
        </div>
      </div>

      {/* Mobile Create Sheet */}
      <MobileCreateSheet
        id="mobile-create-sheet"
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onCreatePost={onCreatePost}
        onCreateStory={onCreateStory}
        onNavigateHome={onNavigateHome}
      />
    </>
  );
};

export default FloatingActionButton;