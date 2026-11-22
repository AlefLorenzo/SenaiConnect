import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, ThumbsUp, MessageSquare, Share2, Bookmark, FileText, Trash2, Edit2, Send, X, Hash, GraduationCap } from 'lucide-react';
import { AuthContext } from '../context/AuthContext.jsx';
import Avatar from './Avatar';
import { postsService } from '../services/postsService';
import { API_URL } from '../config/api';
import './Post.css';

/**
 * Parse content and convert hashtags to clickable links
 * @param {string} content - Post content
 * @returns {React.ReactNode} - Parsed content with hashtag links
 */
const parseHashtags = (content) => {
  if (!content) return content;

  // Match hashtags: # followed by word characters (including accented characters)
  const hashtagRegex = /(#[\p{L}\p{N}_]+)/gu;
  const parts = content.split(hashtagRegex);

  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      const hashtag = part.slice(1); // Remove the # for the URL
      return (
        <Link
          key={index}
          to={`/hashtag/${encodeURIComponent(hashtag)}`}
          className="hashtag-link"
          style={{ textDecoration: 'none' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <Hash size={14} style={{ flexShrink: 0 }} />
            {part}
          </span>
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

const Post = ({ post, onDeleted }) => {
  const { user } = useContext(AuthContext);

  // Use post data directly from mock structure
  const [liked, setLiked] = useState(post.is_liked || false);
  const [saved, setSaved] = useState(post.is_saved || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [postContent, setPostContent] = useState(post.content);

  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Initialize from post data
  useEffect(() => {
    setLiked(post.is_liked || false);
    setSaved(post.is_saved || false);
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
  }, [post.id, post.is_liked, post.is_saved, post.likes_count, post.comments_count]);

  // Fetch comments when comments section is opened
  useEffect(() => {
    if (isCommentsOpen) {
      fetchComments();
    }
  }, [isCommentsOpen]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_URL}/api/posts/${post.id}/comments`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
        setCommentsCount(data.length);
      }
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleLike = async () => {
    try {
      const result = await postsService.toggleLike(post.id);
      setLiked(result.is_liked);
      setLikesCount(result.likes_count);
    } catch (err) {
      console.error('Erro ao curtir post:', err);
    }
  };

  const handleSave = async () => {
    try {
      const result = await postsService.toggleSave(post.id);
      setSaved(result.is_saved);
    } catch (err) {
      console.error('Erro ao salvar post:', err);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await postsService.updatePost(post.id, { content: editContent });
      setPostContent(editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Erro ao editar post:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta publicação?')) return;
    try {
      await postsService.deletePost(post.id);
      if (onDeleted) onDeleted(post.id);
    } catch (err) {
      console.error('Erro ao deletar post:', err);
    }
  };

  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ content: newCommentText.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível publicar o comentário.');
      setNewCommentText('');
      await fetchComments();
    } catch (error) {
      window.alert(error.message || 'Erro ao comentar.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Tem certeza que deseja excluir seu comentário?')) return;
    try {
      const response = await fetch(`${API_URL}/api/posts/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível excluir o comentário.');
      setComments(prev => prev.filter(c => String(c.id) !== String(commentId)));
      setCommentsCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      window.alert(error.message || 'Erro ao excluir comentário.');
    }
  };

  // Handle user data from mock structure (post.user object)
  const postUser = post.user || {};
  const authorRole = String(postUser.role || post.user_role || '').toLowerCase();
  const userAvatar = postUser.avatar ? `/uploads/avatars/${postUser.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(postUser.name || 'User')}&background=0D8ABC&color=fff`;

  const isImageUrl = (url) => {
    if (!url) return false;
    if (post.attachment_type === 'image') return true;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.endsWith(ext));
  };

  return (
    <div className="post-card card">
      <div className="post-header">
        <div className="post-user-info">
          <Link to={`/profile/${postUser.id}`}>
            <Avatar user={{ avatar: postUser.avatar, name: postUser.name }} className="post-avatar" />
          </Link>
          <div>
            <div className="post-user-name">
              <Link to={`/profile/${postUser.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                {postUser.name}
              </Link>
              {(authorRole === 'professor' || authorRole === 'instrutor') && <span className="role-badge role-badge-professor"><GraduationCap size={12} aria-hidden="true" /> PROFESSOR SENAI</span>}
              {postUser.isVerified && <span className="verified-badge" title="Verificado">✓</span>}
            </div>
            <div className="post-time">
              {new Date(post.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })} • 🌍
            </div>
          </div>
        </div>
        
        {user?.id === postUser.id && (
          <div className="post-options-container">
            <button className="icon-btn-transparent" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <MoreHorizontal size={20} color="#65676B" />
            </button>
            {isMenuOpen && (
              <div className="post-dropdown-menu">
                <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }}>
                  <Edit2 size={14} /> Editar
                </button>
                <button onClick={() => { handleDelete(); setIsMenuOpen(false); }} className="delete-option">
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="post-content">
        {isEditing ? (
          <div className="edit-post-container">
            <textarea
              className="edit-post-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
            <div className="edit-post-actions">
              <button className="btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleEdit}>Salvar</button>
            </div>
          </div>
        ) : (
          <p>{parseHashtags(postContent)}</p>
        )}
        
        {post.attachment_url && (
          isImageUrl(post.attachment_url) ? (
            <img src={post.attachment_url} alt="Anexo do post" style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: 'var(--radius-md)', backgroundColor: '#000', marginTop: '12px' }} />
          ) : (
            <div className="post-attachment-doc">
              <div className="doc-icon">
                <FileText size={24} color="#E53935" />
              </div>
              <div className="doc-info">
                <span className="doc-name">Arquivo Anexo</span>
                <a href={post.attachment_url} target="_blank" rel="noopener noreferrer" className="download-link">
                  Visualizar / Baixar
                </a>
              </div>
            </div>
          )
        )}
      </div>

      <div className="post-stats">
        <div className="likes-count">
          <div className="reactions-icons">👍</div>
          <span>{likesCount} curtidas</span>
        </div>
        <div className="comments-count" onClick={() => setIsCommentsOpen(!isCommentsOpen)} style={{ cursor: 'pointer' }}>
          <span>{commentsCount} comentários</span>
        </div>
      </div>

      <div className="post-actions">
        <button 
          className={`action-btn ${liked ? 'liked' : ''}`} 
          onClick={handleLike}
        >
          <ThumbsUp size={20} fill={liked ? "#0056D2" : "none"} />
          <span>Curtir</span>
        </button>
        <button className="action-btn" onClick={() => setIsCommentsOpen(!isCommentsOpen)}>
          <MessageSquare size={20} />
          <span>Comentar</span>
        </button>
        <button className="action-btn" onClick={() => alert('Link copiado para a área de transferência!')}>
          <Share2 size={20} />
          <span>Compartilhar</span>
        </button>
        <button className={`action-btn ${saved ? 'saved' : ''}`} onClick={handleSave} style={{ color: saved ? '#FF9800' : '' }}>
          <Bookmark size={20} fill={saved ? "#FF9800" : "none"} />
          <span>{saved ? 'Salvo' : 'Salvar'}</span>
        </button>
      </div>

      {isCommentsOpen && (
        <div className="comments-section">
          <div className="comments-header">
            <h4>Comentários</h4>
          </div>
          
          <form className="comment-input-form" onSubmit={handleAddComment}>
            <Avatar user={user} className="comment-avatar" />
            <input 
              type="text" 
              placeholder="Escreva um comentário..." 
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="comment-input-field"
            />
            <button type="submit" className="comment-send-btn" disabled={!newCommentText.trim()}>
              <Send size={16} />
            </button>
          </form>

          {loadingComments ? (
            <div className="comments-loading">Carregando comentários...</div>
          ) : (
            <div className="comments-list">
              {comments.length > 0 ? (
                comments.map(comment => {
                  const commAvatar = comment.user_avatar ? `/uploads/avatars/${comment.user_avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user_name || 'User')}`;
                  return (
                    <div key={comment.id} className="comment-item">
                      <Avatar user={{ avatar: comment.user_avatar, name: comment.user_name }} className="comment-avatar" />
                      <div className="comment-bubble-wrapper">
                        <div className="comment-bubble">
                          <div className="comment-bubble-header">
                            <span className="comment-user-name">{comment.user_name}</span>
                            {user?.id === comment.user_id && (
                              <button className="delete-comment-btn" onClick={() => handleDeleteComment(comment.id)}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          <p className="comment-content-text">{parseHashtags(comment.content)}</p>
                        </div>
                        <span className="comment-time">
                          {new Date(comment.created_at).toLocaleDateString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-comments">Nenhum comentário. Seja o primeiro a comentar!</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Post;
