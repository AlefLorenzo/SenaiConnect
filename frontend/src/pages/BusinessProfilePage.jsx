import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { Building2, MapPin, Mail, Phone, Globe, Users, ChevronRight, UserPlus, UserX, Loader2, X, MoreHorizontal, Building, Plus } from 'lucide-react';
import BusinessPostCard from '../components/Business/BusinessPostCard';
import './BusinessProfilePage.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const BusinessProfilePage = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const { socket } = useContext(SocketContext);

    const [business, setBusiness] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [showReport, setShowReport] = useState(false);
    const [reportReason, setReportReason] = useState('spam');
    const [reportDesc, setReportDesc] = useState('');
    const [postsPage, setPostsPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const observerTarget = useRef(null);

    const token = () => sessionStorage.getItem('token');

    const fetchBusiness = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/business/businesses/${id}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBusiness(data);
                setIsFollowing(data.is_following || false);
                setFollowersCount(data.followers_count || 0);
            } else if (res.status === 404) {
                // Navigate using window.location since we don't have navigate
                window.location.href = '/divulgacao';
            }
        } catch (err) {
            console.error('Erro ao buscar empresa:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
        if (pageNum === 1) setLoadingPosts(true);
        try {
            const res = await fetch(`${API_URL}/api/business/posts?businessId=${id}&page=${pageNum}&limit=10`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (append) {
                    setPosts(prev => [...prev, ...data.posts]);
                } else {
                    setPosts(data.posts);
                }
                setHasMorePosts(data.page < data.totalPages);
                setPostsPage(data.page);
            }
        } catch (err) {
            console.error('Erro ao buscar posts:', err);
        } finally {
            setLoadingPosts(false);
        }
    }, [id]);

    // Infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMorePosts && !loadingPosts) {
                    fetchPosts(postsPage + 1, true);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }
        return () => observer.disconnect();
    }, [hasMorePosts, loadingPosts, postsPage, fetchPosts]);

    // Real-time updates
    useEffect(() => {
        if (!socket) return;

        const handleNewPost = (post) => {
            if (post.business_id === parseInt(id)) {
                setPosts(prev => [post, ...prev].slice(0, 50));
            }
        };

        const handlePostUpdate = (post) => {
            if (post.business_id === parseInt(id)) {
                setPosts(prev => prev.map(p => p.id === post.id ? post : p));
            }
        };

        const handlePostDelete = ({ id: postId }) => {
            setPosts(prev => prev.filter(p => p.id !== postId));
        };

        const handleFollow = () => {
            setIsFollowing(true);
            setFollowersCount(prev => prev + 1);
        };

        socket.on('business_post_created', handleNewPost);
        socket.on('business_post_updated', handlePostUpdate);
        socket.on('business_post_deleted', handlePostDelete);
        socket.on('new_business_follower', handleFollow);

        return () => {
            socket.off('business_post_created', handleNewPost);
            socket.off('business_post_updated', handlePostUpdate);
            socket.off('business_post_deleted', handlePostDelete);
            socket.off('new_business_follower', handleFollow);
        };
    }, [socket, id]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            await fetchBusiness();
            if (!cancelled) {
                await fetchPosts(1);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [id, fetchBusiness, fetchPosts]);

    const handleFollow = async () => {
        try {
            const res = await fetch(`${API_URL}/api/business/businesses/${id}/follow`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        } catch (err) {
            console.error('Erro ao seguir:', err);
        }
    };

    const handleUnfollow = async () => {
        try {
            const res = await fetch(`${API_URL}/api/business/businesses/${id}/follow`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error('Erro ao deixar de seguir:', err);
        }
    };

    const handleReport = async () => {
        try {
            const res = await fetch(`${API_URL}/api/business/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token()}`
                },
                body: JSON.stringify({
                    target_type: 'business',
                    target_id: id,
                    reason: reportReason,
                    description: reportDesc
                })
            });
            if (res.ok) {
                alert('Denúncia enviada!');
                setShowReport(false);
                setReportDesc('');
            }
        } catch (err) {
            console.error('Erro ao denunciar:', err);
        }
    };

    if (loading) {
        return (
            <div className="business-profile-loading">
                <Loader2 size={40} className="spin" />
                <p>Carregando empresa...</p>
            </div>
        );
    }

    if (!business) {
        return (
            <div className="business-profile-not-found">
                <Building size={64} />
                <h3>Empresa não encontrada</h3>
                <p>Esta empresa não existe ou não foi aprovada.</p>
                <Link to="/divulgacao" className="btn-primary">Voltar à Divulgação</Link>
            </div>
        );
    }

    const isOwner = user?.id === business.owner_user_id || user?.admin_role;

    const websiteDomain = business.website ? new URL(business.website).hostname : null;

    return (
        <div className="business-profile-page">
            {/* Cover & Profile */}
            <header className="profile-header" style={{ backgroundImage: business.cover_image_url ? `url(${business.cover_image_url})` : 'none' }}>
                <div className="header-overlay">
                    <div className="header-content">
                        <div className="profile-avatar-section">
                            <div className="avatar-wrapper">
                                <img
                                    src={business.logo_url ? `${API_URL}/uploads/logos/${business.logo_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(business.company_name)}&background=0D8ABC&color=fff&size=200`}
                                    alt={business.company_name}
                                    className="profile-avatar"
                                />
                            </div>
                            {isOwner && (
                                <Link to="/business/dashboard" className="edit-profile-btn">
                                    <X size={18} />
                                </Link>
                            )}
                        </div>
                        <div className="profile-info">
                            <div className="profile-name-row">
                                <h1 className="profile-name">{business.company_name}</h1>
                                {business.status === 'approved' && <span className="verified-badge">✓ Verificada</span>}
                            </div>
                            <p className="profile-sector">{business.sector || 'Setor não informado'}</p>
                            <div className="profile-location">
                                <MapPin size={16} /> {business.location || 'Localização não informada'}
                            </div>
                        </div>
                        <div className="profile-stats">
                            <div className="stat">
                                <span className="stat-value">{followersCount}</span>
                                <span className="stat-label">Seguidores</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{business.posts_count || 0}</span>
                                <span className="stat-label">Publicações</span>
                            </div>
                        </div>
                        <div className="profile-actions">
                            {isOwner ? (
                                <Link to="/business/dashboard" className="btn-primary">
                                    Painel da Empresa
                                </Link>
                            ) : (
                                <>
                                    <button
                                        className={`btn-secondary ${isFollowing ? 'following' : ''}`}
                                        onClick={isFollowing ? handleUnfollow : handleFollow}
                                    >
                                        {isFollowing ? (
    <> <UserX size={18} /> Deixar de seguir </>
) : (
    <> <UserPlus size={18} /> Seguir </>
)}
                                    </button>
                                    <button className="btn-report" onClick={() => setShowReport(true)}>
                                        <MoreHorizontal size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Contact Links */}
                {(business.website || business.contact_email || business.contact_phone || business.social_links) && (
                    <div className="profile-contacts">
                        {business.website && (
                            <a href={business.website} target="_blank" rel="noopener noreferrer" className="contact-link">
                                <Globe size={18} /> {websiteDomain}
                            </a>
                        )}
                        {business.contact_email && (
                            <a href={`mailto:${business.contact_email}`} className="contact-link">
                                <Mail size={18} /> {business.contact_email}
                            </a>
                        )}
                        {business.contact_phone && (
                            <a href={`tel:${business.contact_phone}`} className="contact-link">
                                <Phone size={18} /> {business.contact_phone}
                            </a>
                        )}
                        {business.social_links && (
                            <div className="social-links">
                                {Object.entries(business.social_links).map(([platform, url]) => (
                                    url && <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="social-link" title={platform}>
                                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Description */}
                {business.description && (
                    <div className="profile-description">
                        <h3>Sobre</h3>
                        <p>{business.description}</p>
                    </div>
                )}

                {/* Follow Button Mobile */}
                {!isOwner && (
                    <div className="mobile-follow-bar">
                        <button
                            className={`btn-primary ${isFollowing ? 'following' : ''}`}
                            onClick={isFollowing ? handleUnfollow : handleFollow}
                            style={{ width: '100%' }}
                        >
                            {isFollowing ? (
    <> <UserX size={18} /> Deixar de seguir </>
) : (
    <> <UserPlus size={18} /> Seguir ({followersCount}) </>
)}
                        </button>
                    </div>
                )}
            </header>

            {/* Tabs */}
            <nav className="profile-tabs" role="tablist">
                <button
                    role="tab"
                    className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('posts')}
                >
                    Publicações <span className="tab-count">{business.posts_count || 0}</span>
                </button>
                <button
                    role="tab"
                    className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
                    onClick={() => setActiveTab('about')}
                >
                    Sobre
                </button>
                <button
                    role="tab"
                    className={`tab-btn ${activeTab === 'followers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('followers')}
                >
                    Seguidores <span className="tab-count">{followersCount}</span>
                </button>
            </nav>

            {/* Tab Content */}
            <main className="profile-content">
                {activeTab === 'posts' && (
                    <div className="tab-panel">
                        {loadingPosts && posts.length === 0 ? (
                            <div className="loading-posts">
                                <Loader2 size={32} className="spin" />
                                <p>Carregando publicações...</p>
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="no-posts">
                                <Building2 size={48} />
                                <h3>Nenhuma publicação</h3>
                                <p>{isOwner ? 'Crie sua primeira publicação no painel da empresa' : 'Esta empresa ainda não publicou nada'}</p>
                                {isOwner && (
                                    <Link to="/business/dashboard/posts/new" className="btn-primary">
                                        <Plus size={18} /> Criar Publicação
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <>
                                {posts.map(post => (
                                    <BusinessPostCard
                                        key={post.id}
                                        post={post}
                                        currentUserId={user?.id}
                                        onUpdate={() => fetchPosts(1)}
                                    />
                                ))}

                                <div ref={observerTarget} className="load-more-trigger">
                                    {loadingPosts && (
                                        <div className="loading-more">
                                            <Loader2 size={24} className="spin" />
                                            <span>Carregando mais...</span>
                                        </div>
                                    )}
                                    {!hasMorePosts && posts.length > 0 && (
                                        <div className="end-of-feed">Fim das publicações</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'about' && (
                    <div className="tab-panel about-panel">
                        <div className="about-section">
                            <h3>Informações da Empresa</h3>
                            <div className="about-grid">
                                <div className="about-item">
                                    <label>Nome</label>
                                    <span>{business.company_name}</span>
                                </div>
                                <div className="about-item">
                                    <label>Setor</label>
                                    <span>{business.sector || 'Não informado'}</span>
                                </div>
                                <div className="about-item">
                                    <label>Localização</label>
                                    <span>{business.location || 'Não informado'}</span>
                                </div>
                                <div className="about-item">
                                    <label>Site</label>
                                    <span>{business.website ? <a href={business.website} target="_blank" rel="noopener">{websiteDomain}</a> : 'Não informado'}</span>
                                </div>
                                <div className="about-item">
                                    <label>E-mail</label>
                                    <span>{business.contact_email || 'Não informado'}</span>
                                </div>
                                <div className="about-item">
                                    <label>Telefone</label>
                                    <span>{business.contact_phone || 'Não informado'}</span>
                                </div>
                                <div className="about-item">
                                    <label>Endereço</label>
                                    <span>{business.address || 'Não informado'}</span>
                                </div>
                                <div className="about-item full-width">
                                    <label>Descrição</label>
                                    <span>{business.description || 'Não informado'}</span>
                                </div>
                            </div>
                        </div>

                        {business.social_links && Object.keys(business.social_links).length > 0 && (
                            <div className="about-section">
                                <h3>Redes Sociais</h3>
                                <div className="social-links-grid">
                                    {Object.entries(business.social_links).map(([platform, url]) => url && (
                                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="social-link-card">
                                            <span className="platform-name">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                                            <ChevronRight size={16} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'followers' && (
                    <div className="tab-panel followers-panel">
                        {followersCount === 0 ? (
                            <div className="no-followers">
                                <Users size={48} />
                                <h3>Nenhum seguidor ainda</h3>
                                <p>{isOwner ? 'Sua empresa aparecerá aqui quando pessoas começarem a segui-la' : 'Seja o primeiro a seguir esta empresa!'}</p>
                            </div>
                        ) : (
                            <div className="followers-list">
                                <p className="followers-note">Lista de seguidores será implementada com paginação</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Report Modal */}
            {showReport && (
                <div className="modal-overlay" onClick={() => setShowReport(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h4>Denunciar Empresa</h4>
                        <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="modal-select">
                            <option value="spam">Spam</option>
                            <option value="fake">Informações falsas</option>
                            <option value="scam">Golpe/Fraude</option>
                            <option value="inappropriate">Conteúdo inadequado</option>
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

export default BusinessProfilePage;