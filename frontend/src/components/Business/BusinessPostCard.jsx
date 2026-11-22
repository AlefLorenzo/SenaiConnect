import { useState, useEffect, useContext, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SocketContext } from '../../context/SocketContext.jsx';
import { AuthContext } from '../../context/AuthContext.jsx';
import Avatar from '../Avatar';
import { companiesService } from '../../services/companiesService';
import { ThumbsUp, MessageSquare, Share2, Bookmark, Flag, ExternalLink, Building2, Calendar, MapPin, MoreHorizontal, ChevronDown, X, Loader2 } from 'lucide-react';
import './BusinessPostCard.css';
import { getSafeDestination } from '../../utils/safeUrl';

const POST_TYPE_CONFIG = {
    general: { label: 'Geral', icon: '📝', color: '#6B7280' },
    job: { label: 'Vaga', icon: '💼', color: '#059669' },
    internship: { label: 'Estágio', icon: '🎓', color: '#3B82F6' },
    course: { label: 'Curso', icon: '📚', color: '#8B5CF6' },
    event: { label: 'Evento', icon: '📅', color: '#F59E0B' },
    product: { label: 'Produto', icon: '🛍️', color: '#EC4899' },
    news: { label: 'Notícia', icon: '📰', color: '#6366F1' },
    project: { label: 'Projeto', icon: '🚀', color: '#14B8A6' }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const BusinessPostCard = ({ post, onUpdate }) => {
    const { socket } = useContext(SocketContext);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [liked, setLiked] = useState(post.liked || false);
    const [saved, setSaved] = useState(post.saved || false);
    const [likesCount, setLikesCount] = useState(post.likes_count || 0);
    const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
    const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [reportReason, setReportReason] = useState('spam');
    const [reportDesc, setReportDesc] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [shareHint, setShareHint] = useState('');

    const postTypeConfig = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.general;
    const externalDestination = getSafeDestination(post.external_link);
    const ExternalDestinationLink = externalDestination?.startsWith('/') ? Link : 'a';
    const externalDestinationProps = externalDestination?.startsWith('/')
        ? { to: externalDestination }
        : { href: externalDestination || undefined, target: '_blank', rel: 'noopener noreferrer' };

    // Fetch initial status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const data = await companiesService.getBusinessPostStatus(post.id);
                setLiked(data.liked);
                setSaved(data.saved);
            } catch (err) {
                console.error('Erro ao buscar status:', err);
            }
        };
        fetchStatus();
    }, [post.id]);

    // Real-time updates
    useEffect(() => {
        if (!socket) return;

        const handleLikeUpdate = (data) => {
            if (data.postId === post.id) {
                setLikesCount(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
                setLiked(data.liked);
            }
        };

        const handleCommentUpdate = (data) => {
            if (data.postId === post.id) {
                setCommentsCount(prev => prev + 1);
            }
        };

        const handleShareUpdate = (data) => {
            if (data.postId === post.id) {
                setSharesCount(prev => prev + 1);
            }
        };

        socket.on('business_post_liked', handleLikeUpdate);
        socket.on('business_post_commented', handleCommentUpdate);
        socket.on('business_post_shared', handleShareUpdate);

        return () => {
            socket.off('business_post_liked', handleLikeUpdate);
            socket.off('business_post_commented', handleCommentUpdate);
            socket.off('business_post_shared', handleShareUpdate);
        };
    }, [socket, post.id]);

    const handleLike = async () => {
        try {
            const data = await companiesService.likeBusinessPost(post.id);
            setLiked(data.liked);
            setLikesCount(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
        } catch (err) {
            console.error('Erro ao curtir:', err);
        }
    };

    const handleSave = async () => {
        try {
            const data = await companiesService.saveBusinessPost(post.id);
            setSaved(data.saved);
        } catch (err) {
            console.error('Erro ao salvar:', err);
        }
    };

    const handleShare = async () => {
        try {
            await companiesService.shareBusinessPost(post.id);
            setShareHint('Compartilhado!');
            setTimeout(() => setShareHint(''), 2000);
            setSharesCount(prev => prev + 1);
        } catch (err) {
            console.error('Erro ao compartilhar:', err);
        }
    };

    const fetchComments = useCallback(async () => {
        setLoadingComments(true);
        try {
            const data = await companiesService.getBusinessPostComments(post.id);
            setComments(data);
        } catch (err) {
            console.error('Erro ao carregar comentários:', err);
        } finally {
            setLoadingComments(false);
        }
    }, [post.id]);

    useEffect(() => {
        if (isCommentsOpen) {
            // Defer fetchComments to avoid synchronous setState in effect
            setTimeout(() => fetchComments(), 0);
        }
    }, [isCommentsOpen, fetchComments]);

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;

        try {
            const data = await companiesService.commentBusinessPost(post.id, newCommentText);
            if (data.comment) {
                setComments(prev => [...prev, data.comment]);
            }
            setNewCommentText('');
            setCommentsCount(prev => prev + 1);
        } catch (err) {
            console.error('Erro ao comentar:', err);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Excluir comentário?')) return;
        try {
            await companiesService.deleteBusinessPostComment(commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setCommentsCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Erro ao excluir comentário:', err);
        }
    };

    const handleReport = async () => {
        try {
            await companiesService.reportBusinessPost({
                target_type: 'business_post',
                target_id: post.id,
                reason: reportReason,
                description: reportDesc
            });
            alert('Denúncia enviada!');
            setShowReport(false);
            setReportDesc('');
        } catch (err) {
            console.error('Erro ao denunciar:', err);
        }
    };

    const isOwner = user?.id === post.business_id || user?.admin_role;

    return (
        <div className={`business-post-card ${post.is_sponsored ? 'sponsored' : ''}`}>
            {/* Sponsored Badge */}
            {post.is_sponsored && (
                <div className="sponsored-badge">
                    <Building2 size={12} /> Patrocinado
                </div>
            )}

            {/* Header */}
            <div className="post-header">
                <div className="post-business-info">
                    <Link to={`/business/${post.business_slug}`} className="business-link">
                        <Avatar user={{ avatar: post.logo_url, name: post.company_name }} className="business-avatar" />
                    </Link>
                    <div className="business-details">
                        <Link to={`/business/${post.business_slug}`} className="business-name">
                            {post.company_name}
                            {post.is_sponsored && <span className="verified-badge">✓</span>}
                        </Link>
                        <div className="post-meta">
                            <span>{formatDate(post.published_at)}</span>
                            <span className="post-type-badge" style={{ background: `${postTypeConfig.color}15`, color: postTypeConfig.color }}>
                                {postTypeConfig.icon} {postTypeConfig.label}
                            </span>
                            {post.category && post.category !== 'Geral' && (
                                <span className="category-badge">📌 {post.category}</span>
                            )}
                        </div>
                    </div>
                </div>

                {isOwner ? (
                    <div className="post-menu">
                        <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            <MoreHorizontal size={20} />
                        </button>
                        {isMenuOpen && (
                            <div className="post-dropdown">
                                <button onClick={() => { navigate(`/business/dashboard/posts/${post.id}/edit`); setIsMenuOpen(false); }}>
                                    <ChevronDown size={14} /> Editar
                                </button>
                                <button onClick={() => { if(window.confirm('Excluir?')) onUpdate(); setIsMenuOpen(false); }} className="danger">
                                    <X size={14} /> Excluir
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="post-menu">
                        <button className="icon-btn" onClick={() => setShowReport(true)}>
                            <Flag size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="post-content">
                {post.carousel_images && post.carousel_images.length > 0 ? (
                    <div className="post-carousel">
                        {post.carousel_images.map((img, idx) => (
                            <img key={idx} src={img} alt={`Imagem ${idx + 1}`} className="carousel-image" />
                        ))}
                    </div>
                ) : post.attachment_url ? (
                    post.attachment_type === 'video' || post.attachment_url?.match(/\.(mp4|mov|webm)$/i) ? (
                        <video src={post.attachment_url} controls className="post-media" />
                    ) : (
                        <img src={post.attachment_url} alt="Anexo" className="post-media" />
                    )
                ) : null}

                <p className="post-text">{post.content}</p>

                {externalDestination && (
                    <ExternalDestinationLink
                        {...externalDestinationProps}
                        className="external-link"
                    >
                        <ExternalLink size={16} /> {post.link_label || 'Ver oportunidade'}
                    </ExternalDestinationLink>
                )}
            </div>

            {/* Meta Info */}
            {(post.post_type === 'job' || post.post_type === 'internship' || post.post_type === 'event') && (
                <div className="post-meta-details">
                    {post.post_type === 'event' && (
                        <>
                            <span><Calendar size={14} /> Evento: {post.content?.match(/📅\s*([^\n]+)/)?.[1] || 'Data a confirmar'}</span>
                            <span><MapPin size={14} /> Local: {post.content?.match(/📍\s*([^\n]+)/)?.[1] || 'A definir'}</span>
                        </>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="post-stats">
                <span>{likesCount} curtidas</span>
                <span>{commentsCount} comentários</span>
                <span>{sharesCount} compartilhamentos</span>
            </div>

            {/* Actions */}
            <div className="post-actions">
                <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
                    <ThumbsUp size={20} fill={liked ? "#059669" : "none"} />
                    <span>Curtir</span>
                </button>
                <button className="action-btn" onClick={() => setIsCommentsOpen(!isCommentsOpen)}>
                    <MessageSquare size={20} />
                    <span>Comentar</span>
                </button>
                <button className="action-btn" onClick={handleShare}>
                    <Share2 size={20} />
                    <span>{shareHint || 'Compartilhar'}</span>
                </button>
                <button className={`action-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
                    <Bookmark size={20} fill={saved ? "#F59E0B" : "none"} />
                    <span>{saved ? 'Salvo' : 'Salvar'}</span>
                </button>
            </div>

            {/* Comments Section */}
            {isCommentsOpen && (
                <div className="comments-section">
                    <div className="comments-header">
                        <h4>Comentários</h4>
                    </div>

                    <form className="comment-form" onSubmit={handleAddComment}>
                        <Avatar user={user} className="comment-avatar" />
                        <input
                            type="text"
                            placeholder="Escreva um comentário..."
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            className="comment-input"
                        />
                        <button type="submit" className="comment-submit" disabled={!newCommentText.trim()}>
                            <Loader2 size={16} className="spin" />
                        </button>
                    </form>

                    {loadingComments ? (
                        <div className="comments-loading">Carregando...</div>
                    ) : comments.length > 0 ? (
                        <div className="comments-list">
                            {comments.map(comment => (
                                    <div key={comment.id} className="comment">
                                        <Avatar user={{ avatar: comment.user_avatar, name: comment.user_name }} className="comment-avatar" />
                                        <div className="comment-body">
                                            <div className="comment-header">
                                                <strong>{comment.user_name}</strong>
                                                <span className="comment-time">{formatDate(comment.created_at)}</span>
                                            </div>
                                            <p>{comment.content}</p>
                                            {(user?.id === comment.user_id || user?.id === post.business_id || user?.admin_role) && (
                                                <button className="comment-delete" onClick={() => handleDeleteComment(comment.id)}>
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="no-comments">Nenhum comentário. Seja o primeiro!</div>
                    )}
                </div>
            )}

            {/* Report Modal */}
            {showReport && (
                <div className="modal-overlay" onClick={() => setShowReport(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h4>Denunciar publicação</h4>
                        <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="modal-select">
                            <option value="spam">Spam</option>
                            <option value="inappropriate">Conteúdo inadequado</option>
                            <option value="fake">Informações falsas</option>
                            <option value="scam">Golpe/Fraude</option>
                            <option value="other">Outro</option>
                        </select>
                        <textarea
                            value={reportDesc}
                            onChange={(e) => setReportDesc(e.target.value)}
                            placeholder="Detalhes (opcional)..."
                            rows={3}
                            className="modal-textarea"
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowReport(false)}>Cancelar</button>
                            <button className="btn-danger" onClick={handleReport}>Enviar denúncia</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessPostCard;