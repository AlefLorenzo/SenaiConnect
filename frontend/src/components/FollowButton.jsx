import { useState, useRef, useEffect, useCallback } from 'react';
import { UserPlus, MessageCircle, BellOff, UserMinus, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { USE_MOCK, API_URL } from '../config/api';
import messagesService from '../services/messagesService';
import './FollowButton.css';

// Mock mute status storage
const mockMuteStatus = new Map();

const FollowButton = ({ isFollowing, loading, onToggle, targetUserId }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Handle click outside to close dropdown
  const handleClickOutside = useCallback((event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // Fetch mute status
  useEffect(() => {
    if (!targetUserId) return;

    // If in mock mode, use mock data
    if (USE_MOCK) {
      setMuted(mockMuteStatus.get(targetUserId) || false);
      return;
    }

    fetch(`${API_URL}/api/users/${targetUserId}/status`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then((d) => setMuted(!!d.muted))
      .catch(() => {});
  }, [targetUserId]);

  const toggleMute = async () => {
    const newMuted = !muted;

    // If in mock mode, update mock data
    if (USE_MOCK) {
      mockMuteStatus.set(targetUserId, newMuted);
      setMuted(newMuted);
      setDropdownOpen(false);
      return;
    }

    const method = muted ? 'DELETE' : 'POST';
    await fetch(`${API_URL}/api/users/${targetUserId}/mute`, {
      method,
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    });
    setMuted(newMuted);
    setDropdownOpen(false);
  };

  // Handle keyboard navigation for dropdown
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      return;
    }

    if (e.key === 'Tab' && dropdownOpen) {
      // Only consider focusable elements within the dropdown menu, not the main button
      const menu = dropdownRef.current?.querySelector('.follow-dropdown-menu');
      const focusableElements = menu?.querySelectorAll(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
  }, [dropdownOpen]);

  useEffect(() => {
    if (dropdownOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen, handleKeyDown]);

  // Focus first dropdown item when opened
  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => {
        // Use more specific selector to target only dropdown menu items, not the main button
        const firstItem = dropdownRef.current?.querySelector('.follow-dropdown-menu button:not(:disabled)');
        firstItem?.focus();
      }, 0);
    }
  }, [dropdownOpen]);

  if (loading) {
    return (
      <button className="follow-btn loading" disabled aria-busy="true">
        <span className="visually-hidden">Carregando...</span>
      </button>
    );
  }

  if (!isFollowing) {
    return (
      <button
        className="follow-btn"
        onClick={onToggle}
        aria-label="Seguir"
      >
        <UserPlus size={18} aria-hidden="true" />
        <span>Seguir</span>
      </button>
    );
  }

  return (
    <div className="follow-dropdown-container" ref={dropdownRef}>
      <button
        className="follow-btn following"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        aria-label={dropdownOpen ? 'Fechar opções de seguimento' : 'Opções de seguimento'}
      >
        <span>Seguindo</span>
        <ChevronDown size={16} className="chevron-down" aria-hidden="true" />
      </button>

      {dropdownOpen && (
        <div className="follow-dropdown-menu" role="menu" onKeyDown={handleKeyDown}>
          <button
            role="menuitem"
            className="message-action"
            onClick={async () => {
              setDropdownOpen(false);
              try {
                const conversation = await messagesService.createConversation(targetUserId);
                if (conversation) {
                  navigate(`/messages?conversationId=${conversation.id}`);
                } else {
                  navigate('/messages');
                }
              } catch (err) {
                console.error('Erro ao criar conversa:', err);
                navigate('/messages');
              }
            }}
          >
            <span className="dropdown-icon-wrapper" aria-hidden="true">
              <MessageCircle size={16} />
            </span>
            <span>Enviar mensagem</span>
          </button>
          <button
            role="menuitem"
            className="mute-action"
            onClick={toggleMute}
          >
            <span className="dropdown-icon-wrapper" aria-hidden="true">
              <BellOff size={16} />
            </span>
            <span>{muted ? 'Reativar notificações' : 'Silenciar'}</span>
          </button>
          <div className="dropdown-divider" role="separator" />
          <button
            role="menuitem"
            className="unfollow-action"
            onClick={() => { setDropdownOpen(false); onToggle(); }}
          >
            <span className="dropdown-icon-wrapper" aria-hidden="true">
              <UserMinus size={16} />
            </span>
            <span>Deixar de seguir</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default FollowButton;
