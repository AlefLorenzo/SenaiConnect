import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Pause, Play, MessageSquare, Heart, MoreVertical, Eye, Users, Flag, Delete, Copy } from 'lucide-react';
import Avatar from './Avatar';
import { storiesService } from '../services/storiesService';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import './StoryViewer.css';

const StoryViewer = ({ storyGroups, initialGroupIndex, onClose, onReply, onReact }) => {
  const { user } = useContext(AuthContext);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showViewerList, setShowViewerList] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [storyReactions, setStoryReactions] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState(null);

  // Guard against empty storyGroups or invalid index - close via effect
  useEffect(() => {
    if (!storyGroups || storyGroups.length === 0 || initialGroupIndex >= storyGroups.length) {
      onClose?.();
    }
  }, [storyGroups, initialGroupIndex, onClose]);

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories?.[currentStoryIndex];

  // Track if current user owns this story
  const isOwner = currentGroup && user && currentGroup.user_id === user.id;
  const storyId = currentStory?.id;
  const storyOwnerId = currentGroup?.user_id;

  const progressRef = useRef(0);
  const requestRef = useRef();
  const lastTimeRef = useRef();
  const holdTimerRef = useRef(null);

  const STORY_DURATION = 30000; // 30 seconds per story

  // Reaction types matching backend
  const REACTION_TYPES = [
    { type: 'heart', emoji: '❤️', label: 'Amei' },
    { type: 'laugh', emoji: '😂', label: 'Ri muito' },
    { type: 'wow', emoji: '😮', label: 'Uau' },
    { type: 'sad', emoji: '😢', label: 'Triste' },
    { type: 'angry', emoji: '😡', label: 'Raiva' },
    { type: 'clap', emoji: '👏', label: 'Aplaudi' },
    { type: 'pray', emoji: '🙏', label: 'Orou' },
    { type: 'fire', emoji: '🔥', label: 'Fogo' },
  ];

  const goToNext = useCallback(() => {
    setProgress(0);
    progressRef.current = 0;

    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentGroupIndex < storyGroups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose(); // End of all stories
    }
  }, [currentGroupIndex, currentStoryIndex, currentGroup, storyGroups.length, onClose]);

  const goToPrev = useCallback(() => {
    setProgress(0);
    progressRef.current = 0;

    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
      const prevGroup = storyGroups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
    }
  }, [currentGroupIndex, currentStoryIndex, storyGroups]);

  const animate = useCallback((time) => {
    if (isPaused) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    if (lastTimeRef.current != null) {
      const deltaTime = time - lastTimeRef.current;
      progressRef.current += (deltaTime / STORY_DURATION) * 100;

      if (progressRef.current >= 100) {
        goToNext();
        return; // wait for next frame
      }
      setProgress(progressRef.current);
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [isPaused, goToNext]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [currentGroupIndex, currentStoryIndex, isPaused, animate]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    setShowReactions(false);
    setShowReplies(false);
    setReplyText('');

    // Load reactions for new story
    if (storyId) {
      loadReactions(storyId);
      // Mark as viewed
      storiesService.viewStory(storyId).catch(console.error);
    }
  }, [storyId]);

  // Load story reactions
  const loadReactions = async (id) => {
    try {
      const reactions = await storiesService.getStoryReactions(id);
      setStoryReactions(reactions);
    } catch (err) {
      console.error('Erro ao carregar reações:', err);
    }
  };

  // Load story viewers (owner only)
  const loadViewers = async () => {
    if (!storyId) return;
    setIsLoadingViewers(true);
    try {
      const data = await storiesService.getStoryViewers(storyId);
      setViewers(data);
      setShowViewerList(true);
    } catch (err) {
      console.error('Erro ao carregar visualizações:', err);
    } finally {
      setIsLoadingViewers(false);
    }
  };

  // Handle story hold (pause)
  const handlePointerDown = useCallback(() => {
    if (!isPaused) {
      holdTimerRef.current = setTimeout(() => {
        setIsPaused(true);
      }, 100); // Small delay to distinguish tap from hold
    }
  }, [isPaused]);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isPaused) {
      setIsPaused(false);
    }
  }, [isPaused]);

  const handlePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isPaused) {
      setIsPaused(false);
    }
  }, [isPaused]);

  // Handle reactions
  const handleReact = async (reactionType) => {
    if (!storyId) return;
    try {
      await storiesService.reactToStory(storyId, reactionType);
      // Optimistic update
      setStoryReactions(prev => {
        const existing = prev.find(r => r.type === reactionType);
        if (existing) {
          return prev.map(r => r.type === reactionType ? { ...r, count: r.count + 1, users: [...r.users, { id: user.id, name: 'Você' }] } : r);
        } else {
          return [...prev, { type: reactionType, count: 1, users: [{ id: user.id, name: 'Você' }] }];
        }
      });
      if (onReact) onReact(storyId, reactionType);
    } catch (err) {
      console.error('Erro ao reagir:', err);
    }
  };

  // Handle reply
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !storyId) return;

    setIsReplying(true);
    try {
      await storiesService.replyToStory(storyId, replyText.trim());
      if (onReply) onReply(storyId, replyText.trim());
      setReplyText('');
      setShowReplies(false);
    } catch (err) {
      console.error('Erro ao responder:', err);
    } finally {
      setIsReplying(false);
    }
  };

  // Handle delete story (owner only)
  const handleDeleteStory = async () => {
    if (!storyId) return;
    try {
      await storiesService.deleteStory(storyId);
      setShowDeleteConfirm(false);
      setShowMoreMenu(false);
      goToNext();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  // Toggle more menu
  const toggleMoreMenu = (e) => {
    e.stopPropagation();
    setShowMoreMenu(prev => !prev);
  };

  // Close more menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowMoreMenu(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (!currentGroup || !currentStory) return null;

  const userAvatar = currentGroup.user_avatar
    ? `/uploads/avatars/${currentGroup.user_avatar}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentGroup.user_name)}&background=0D8ABC&color=fff`;

  // Calculate total progress for all stories in group
  const totalStoriesInGroup = currentGroup.stories.length;
  const completedStories = currentStoryIndex;
  const groupProgress = ((completedStories + progress / 100) / totalStoriesInGroup) * 100;

  return (
    <div className="story-viewer-overlay">
      <div className="story-viewer-container">

        {/* Progress Bars - Overall group progress + individual story progress */}
        <div className="story-progress-container">
          {/* Overall group progress (thin line at top) */}
          <div className="story-group-progress" role="progressbar" aria-valuenow={Math.round(groupProgress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do grupo de histórias">
            <div className="story-group-progress-fill" style={{ width: `${groupProgress}%` }} />
          </div>

          {/* Individual story progress bars */}
          <div className="story-progress-bars">
            {currentGroup.stories.map((s, idx) => (
              <div key={s.id} className="story-progress-bar-bg" role="progressbar" aria-valuenow={idx === currentStoryIndex ? Math.round(progress) : idx < currentStoryIndex ? 100 : 0} aria-valuemin={0} aria-valuemax={100} aria-label={`História ${idx + 1} de ${totalStoriesInGroup}`}>
                <div
                  className="story-progress-bar-fill"
                  style={{
                    width: idx === currentStoryIndex ? `${progress}%` : idx < currentStoryIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="story-header">
          <div className="story-user-info" onClick={() => isOwner && loadViewers()}>
            <Avatar user={{ avatar: currentGroup.user_avatar, name: currentGroup.user_name }} className="story-viewer-avatar" />
            <div>
              <span className="story-viewer-name">{currentGroup.user_name}</span>
              <span className="story-viewer-time">
                {new Date(currentStory.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {isOwner && (
              <div className="story-view-count" title="Ver quem visualizou">
                <Eye size={14} />
                <span>{currentStory.views_count || 0}</span>
              </div>
            )}
          </div>
          <div className="story-header-actions">
            <button className="story-action-btn" onClick={() => setShowReactions(!showReactions)} aria-label="Reações">
              <Heart size={22} color="white" />
            </button>
            <button className="story-action-btn" onClick={() => setShowReplies(!showReplies)} aria-label="Responder">
              <MessageSquare size={22} color="white" />
            </button>
            {isOwner && (
              <button className="story-action-btn" onClick={toggleMoreMenu} aria-label="Mais opções">
                <MoreVertical size={22} color="white" />
              </button>
            )}
            <button className="story-close-btn" onClick={onClose} aria-label="Fechar">
              <X size={24} color="white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="story-content-area"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onTouchStart={handlePointerDown}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerLeave}
        >
          {currentStory.media_url ? (
            <img src={currentStory.media_url} alt="Story" className="story-media" />
          ) : (
            <div className="story-text-only" style={{ background: currentStory.background_color || 'linear-gradient(135deg, #0D8ABC, #0056D2)' }}>
              <p>{currentStory.text_content}</p>
            </div>
          )}

          {currentStory.media_url && currentStory.text_content && (
            <div className="story-caption-overlay">
              <p>{currentStory.text_content}</p>
            </div>
          )}

          {/* Pause indicator */}
          {isPaused && (
            <div className="story-pause-indicator" aria-live="polite">
              <Pause size={48} color="white" />
              <span>Pausado</span>
            </div>
          )}

          {/* Reactions panel */}
          {showReactions && (
            <div className="story-reactions-panel" role="dialog" aria-label="Reações">
              <div className="reactions-header">
                <span>Reagir a esta história</span>
                <button onClick={() => setShowReactions(false)} aria-label="Fechar"><X size={20} color="white" /></button>
              </div>
              <div className="reactions-grid">
                {REACTION_TYPES.map((reaction) => {
                  const reactionData = storyReactions.find(r => r.type === reaction.type);
                  const hasReacted = reactionData?.users?.some(u => u.id === user?.id);
                  const count = reactionData?.count || 0;
                  return (
                    <button
                      key={reaction.type}
                      className={`reaction-btn ${hasReacted ? 'reacted' : ''}`}
                      onClick={() => handleReact(reaction.type)}
                      aria-label={`${reaction.label} ${hasReacted ? '(remover)' : ''}`}
                      aria-pressed={hasReacted}
                    >
                      <span className="reaction-emoji" role="img" aria-label={reaction.emoji}>{reaction.emoji}</span>
                      <span className="reaction-label">{reaction.label}</span>
                      {count > 0 && <span className="reaction-count">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Replies panel */}
          {showReplies && (
            <div className="story-replies-panel" role="dialog" aria-label="Responder">
              <div className="replies-header">
                <span>Responder</span>
                <button onClick={() => setShowReplies(false)} aria-label="Fechar"><X size={20} color="white" /></button>
              </div>
              <form onSubmit={handleReplySubmit} className="reply-form">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escreva uma resposta..."
                  maxLength={500}
                  rows={3}
                  aria-label="Sua resposta"
                />
                <div className="reply-footer">
                  <span className="reply-char-count">{replyText.length}/500</span>
                  <button
                    type="submit"
                    className="reply-send-btn"
                    disabled={!replyText.trim() || isReplying}
                  >
                    {isReplying ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="story-nav-left" onClick={(e) => { e.stopPropagation(); goToPrev(); }} aria-label="História anterior">
          {(currentStoryIndex > 0 || currentGroupIndex > 0) && <ChevronLeft size={36} color="white" />}
        </div>
        <div className="story-nav-right" onClick={(e) => { e.stopPropagation(); goToNext(); }} aria-label="Próxima história">
          <ChevronRight size={36} color="white" />
        </div>

        {/* More Menu Dropdown (Owner only) */}
        {showMoreMenu && isOwner && (
          <div className="story-more-menu" role="menu">
            <button role="menuitem" onClick={() => { loadViewers(); setShowMoreMenu(false); }}>
              <Eye size={18} /> Ver visualizações
            </button>
            <button role="menuitem" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setShowMoreMenu(false);
            }}>
              <Copy size={18} /> Copiar link
            </button>
            <button role="menuitem" className="danger" onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false); }}>
              <Delete size={18} /> Excluir história
            </button>
            <button role="menuitem" className="danger" onClick={() => { setShowMoreMenu(false); }}>
              <Flag size={18} /> Denunciar
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="story-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="story-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="delete-title">
              <h3 id="delete-title">Excluir história</h3>
              <p>Esta ação não pode ser desfeita. Tem certeza?</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancelar</button>
                <button className="btn-danger" onClick={handleDeleteStory}>Excluir</button>
              </div>
            </div>
          </div>
        )}

        {/* Viewer List Modal (Owner only) */}
        {showViewerList && (
          <div className="story-modal-overlay" onClick={() => setShowViewerList(false)}>
            <div className="story-modal story-viewer-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="viewers-title">
              <div className="viewer-modal-header">
                <h3 id="viewers-title">
                  <Users size={20} /> Visualizações
                  <span className="viewer-count">{viewers.length}</span>
                </h3>
                <button onClick={() => setShowViewerList(false)} aria-label="Fechar"><X size={20} /></button>
              </div>
              <div className="viewer-list">
                {isLoadingViewers ? (
                  <div className="viewer-loading">Carregando...</div>
                ) : viewers.length === 0 ? (
                  <div className="viewer-empty">Nenhuma visualização ainda</div>
                ) : (
                  viewers.map((viewer) => (
                    <div key={viewer.id} className="viewer-item">
                      <Avatar
                        user={{ avatar: viewer.avatar, name: viewer.name }}
                        className="viewer-avatar"
                        size={40}
                      />
                      <div className="viewer-info">
                        <span className="viewer-name">{viewer.name}</span>
                        <span className="viewer-username">@{viewer.username}</span>
                      </div>
                      <span className="viewer-time">
                        {new Date(viewer.viewed_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryViewer;