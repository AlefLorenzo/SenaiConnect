import React, { useState, useEffect, useContext } from 'react';
import { Plus, MoreVertical, X, Edit2, Trash2, Image, Play } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import { storiesService } from '../services/storiesService';
import Avatar from './Avatar';
import './StoryHighlights.css';

const StoryHighlights = ({ userId, userName, userAvatar, isOwnProfile = false, onHighlightUpdate }) => {
  const { user } = useContext(AuthContext);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateHighlight, setShowCreateHighlight] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [showHighlightMenu, setShowHighlightMenu] = useState(null);

  useEffect(() => {
    loadHighlights();
  }, [userId]);

  const loadHighlights = async () => {
    try {
      setLoading(true);
      const data = await storiesService.getUserHighlights(userId);
      setHighlights(data || []);
    } catch (err) {
      console.error('Erro ao carregar destaques:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHighlight = async (highlightData) => {
    try {
      const newHighlight = await storiesService.createHighlight(userId, highlightData);
      setHighlights(prev => [...prev, newHighlight]);
      setShowCreateHighlight(false);
      if (onHighlightUpdate) onHighlightUpdate();
    } catch (err) {
      console.error('Erro ao criar destaque:', err);
    }
  };

  const handleUpdateHighlight = async (highlightId, highlightData) => {
    try {
      const updated = await storiesService.updateHighlight(highlightId, highlightData);
      setHighlights(prev => prev.map(h => h.id === highlightId ? updated : h));
      setEditingHighlight(null);
      if (onHighlightUpdate) onHighlightUpdate();
    } catch (err) {
      console.error('Erro ao atualizar destaque:', err);
    }
  };

  const handleDeleteHighlight = async (highlightId) => {
    if (!window.confirm('Tem certeza que deseja excluir este destaque?')) return;
    try {
      await storiesService.deleteHighlight(highlightId);
      setHighlights(prev => prev.filter(h => h.id !== highlightId));
      setShowHighlightMenu(null);
      if (onHighlightUpdate) onHighlightUpdate();
    } catch (err) {
      console.error('Erro ao excluir destaque:', err);
    }
  };

  const handleAddStoriesToHighlight = async (highlightId, storyIds) => {
    try {
      const updated = await storiesService.addStoriesToHighlight(highlightId, storyIds);
      setHighlights(prev => prev.map(h => h.id === highlightId ? updated : h));
      if (onHighlightUpdate) onHighlightUpdate();
    } catch (err) {
      console.error('Erro ao adicionar stories ao destaque:', err);
    }
  };

  const handleEditClick = (highlight) => {
    setEditingHighlight(highlight);
    setShowHighlightMenu(null);
  };

  const handleMenuClick = (highlightId, e) => {
    e.stopPropagation();
    setShowHighlightMenu(showHighlightMenu === highlightId ? null : highlightId);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowHighlightMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (!isOwnProfile && highlights.length === 0) return null;

  const isCurrentUser = user?.id === userId;

  return (
    <div className="story-highlights" role="region" aria-label="Destaques">
      <div className="highlights-header">
        <h3>Destaques</h3>
        {isCurrentUser && (
          <button
            className="create-highlight-btn"
            onClick={() => setShowCreateHighlight(true)}
            aria-label="Criar novo destaque"
          >
            <Plus size={18} />
            <span>Novo</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="highlights-loading">
          <div className="spinner" />
        </div>
      ) : highlights.length > 0 ? (
        <div className="highlights-list" role="list">
          {highlights.map((highlight) => (
            <div key={highlight.id} className="highlight-item" role="listitem">
              <div className="highlight-cover-wrapper">
                {highlight.coverUrl ? (
                  <img
                    src={highlight.coverUrl}
                    alt={highlight.title}
                    className="highlight-cover"
                  />
                ) : (
                  <div className="highlight-cover-placeholder">
                    <Image size={24} />
                  </div>
                )}
                {isCurrentUser && (
                  <button
                    className="highlight-menu-btn"
                    onClick={(e) => handleMenuClick(highlight.id, e)}
                    aria-label="Opções do destaque"
                    aria-expanded={showHighlightMenu === highlight.id}
                    aria-haspopup="true"
                  >
                    <MoreVertical size={18} />
                  </button>
                )}
              </div>
              <span className="highlight-title">{highlight.title}</span>
              <span className="highlight-count">
                {highlight.stories?.length || 0} story{highlight.stories?.length !== 1 ? 's' : ''}
              </span>

              {/* Highlight Menu Dropdown */}
              {showHighlightMenu === highlight.id && isCurrentUser && (
                <div className="highlight-dropdown" role="menu">
                  <button role="menuitem" onClick={() => handleEditClick(highlight)}>
                    <Edit2 size={16} /> Editar
                  </button>
                  <button role="menuitem" onClick={() => handleDeleteHighlight(highlight.id)} className="delete-option">
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add new highlight button for own profile */}
          {isCurrentUser && (
            <button
              className="highlight-item add-highlight-btn"
              onClick={() => setShowCreateHighlight(true)}
              aria-label="Adicionar novo destaque"
            >
              <div className="highlight-cover-wrapper">
                <div className="highlight-cover-placeholder add-highlight-placeholder">
                  <Plus size={28} />
                </div>
              </div>
              <span className="highlight-title">Novo</span>
            </button>
          )}
        </div>
      ) : (
        isCurrentUser && (
          <div className="highlights-empty">
            <Image size={48} className="empty-icon" />
            <p>Nenhum destaque ainda</p>
            <button className="btn-primary" onClick={() => setShowCreateHighlight(true)}>
              <Plus size={16} /> Criar primeiro destaque
            </button>
          </div>
        )
      )}

      {/* Create/Edit Highlight Modal */}
      {(showCreateHighlight || editingHighlight) && (
        <div className="highlight-modal-overlay" onClick={() => { setShowCreateHighlight(false); setEditingHighlight(null); }}>
          <div className="highlight-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editingHighlight ? 'Editar destaque' : 'Criar destaque'}>
            <div className="highlight-modal-header">
              <h4>{editingHighlight ? 'Editar destaque' : 'Novo destaque'}</h4>
              <button className="modal-close" onClick={() => { setShowCreateHighlight(false); setEditingHighlight(null); }} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <HighlightForm
              highlight={editingHighlight}
              onSubmit={(data) => {
                if (editingHighlight) {
                  handleUpdateHighlight(editingHighlight.id, data);
                } else {
                  handleCreateHighlight(data);
                }
              }}
              onCancel={() => { setShowCreateHighlight(false); setEditingHighlight(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Highlight Form Component
const HighlightForm = ({ highlight, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(highlight?.title || '');
  const [coverUrl, setCoverUrl] = useState(highlight?.coverUrl || '');
  const [selectedStories, setSelectedStories] = useState(highlight?.stories || []);
  const [availableStories, setAvailableStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (highlight) {
      loadAvailableStories();
    }
  }, [highlight]);

  const loadAvailableStories = async () => {
    // In a real app, this would fetch the user's archived stories
    // For now, we'll use mock data
    setAvailableStories([
      { id: 1, url: 'https://picsum.photos/seed/1/1080/1920', type: 'image', createdAt: new Date().toISOString() },
      { id: 2, url: 'https://picsum.photos/seed/2/1080/1920', type: 'image', createdAt: new Date().toISOString() },
      { id: 3, url: 'https://picsum.photos/seed/3/1080/1920', type: 'video', createdAt: new Date().toISOString() },
      { id: 4, url: 'https://picsum.photos/seed/4/1080/1920', type: 'image', createdAt: new Date().toISOString() },
      { id: 5, url: 'https://picsum.photos/seed/5/1080/1920', type: 'image', createdAt: new Date().toISOString() },
    ]);
  };

  const handleStorySelect = (storyId) => {
    setSelectedStories(prev =>
      prev.includes(storyId)
        ? prev.filter(id => id !== storyId)
        : [...prev, storyId]
    );
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Título é obrigatório');
      return;
    }
    onSubmit({
      title: title.trim(),
      coverUrl: coverUrl || (selectedStories.length > 0 ? availableStories.find(s => s.id === selectedStories[0])?.url : ''),
      storyIds: selectedStories,
    });
  };

  return (
    <form onSubmit={handleSubmitForm} className="highlight-form">
      <div className="form-group">
        <label htmlFor="highlight-title">Título do destaque</label>
        <input
          id="highlight-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={30}
          placeholder="Ex: Viagens, Trabalho, Família..."
          required
        />
        {error && <span className="form-error">{error}</span>}
      </div>

      <div className="form-group">
        <label>Capa do destaque</label>
        <div className="cover-preview">
          {coverUrl ? (
            <img src={coverUrl} alt="Capa" />
          ) : selectedStories.length > 0 ? (
            <img src={availableStories.find(s => s.id === selectedStories[0])?.url} alt="Capa" />
          ) : (
            <div className="cover-placeholder">
              <Image size={24} />
              <span>Selecione uma story para a capa</span>
            </div>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Stories para incluir ({selectedStories.length} selecionada{selectedStories.length !== 1 ? 's' : ''})</label>
        <div className="stories-selector">
          {availableStories.map((story) => (
            <label key={story.id} className={`story-select-item ${selectedStories.includes(story.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selectedStories.includes(story.id)}
                onChange={() => handleStorySelect(story.id)}
              />
              <div className="story-thumb">
                {story.type === 'video' && <Play size={20} className="video-badge" />}
                <img src={story.url} alt={`Story ${story.id}`} />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary">
          {highlight ? 'Salvar alterações' : 'Criar destaque'}
        </button>
      </div>
    </form>
  );
};

export default StoryHighlights;