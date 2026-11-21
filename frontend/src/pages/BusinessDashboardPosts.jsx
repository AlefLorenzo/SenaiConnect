import { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import './BusinessDashboardPosts.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const POST_TYPES = {
    general: { label: 'Geral', icon: '📝', color: '#6B7280' },
    job: { label: 'Vaga', icon: '💼', color: '#059669' },
    internship: { label: 'Estágio', icon: '🎓', color: '#3B82F6' },
    course: { label: 'Curso', icon: '📚', color: '#8B5CF6' },
    event: { label: 'Evento', icon: '📅', color: '#F59E0B' },
    product: { label: 'Produto', icon: '🛍️', color: '#EC4899' },
    news: { label: 'Notícia', icon: '📰', color: '#6366F1' },
    project: { label: 'Projeto', icon: '🚀', color: '#14B8A6' }
};

const BusinessDashboardPosts = () => {
    const { socket } = useContext(SocketContext);

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });

    const token = () => sessionStorage.getItem('token');

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            if (typeFilter) params.append('postType', typeFilter);

            const res = await fetch(`${API_URL}/api/business/my-posts?${params}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });

            if (res.ok) {
                const data = await res.json();
                setPosts(data.posts);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (err) {
            console.error('Erro ao buscar posts:', err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, statusFilter, typeFilter]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPosts();
    }, [fetchPosts]);

    // Real-time
    useEffect(() => {
        if (!socket) return;

        const handleNewPost = (post) => {
            setPosts(prev => [post, ...prev].slice(0, 50));
        };

        const handlePostUpdate = (post) => {
            setPosts(prev => prev.map(p => p.id === post.id ? post : p));
        };

        const handlePostDelete = ({ id }) => {
            setPosts(prev => prev.filter(p => p.id !== id));
        };

        socket.on('business_post_created', handleNewPost);
        socket.on('business_post_updated', handlePostUpdate);
        socket.on('business_post_deleted', handlePostDelete);

        return () => {
            socket.off('business_post_created', handleNewPost);
            socket.off('business_post_updated', handlePostUpdate);
            socket.off('business_post_deleted', handlePostDelete);
        };
    }, [socket]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleTypeChange = (e) => {
        setTypeFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta publicação?')) return;
        try {
            const res = await fetch(`${API_URL}/api/business/my-posts/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) fetchPosts();
        } catch (err) {
            console.error('Erro ao excluir:', err);
        }
    };

    if (loading) {
        return <div className="loading-state">Carregando publicações...</div>;
    }

    return (
        <div className="business-dashboard-posts">
            <div className="page-header">
                <div>
                    <h1>Minhas Publicações</h1>
                    <p>Gerencie todas as publicações da sua empresa</p>
                </div>
                <Link to="/business/dashboard/posts/new" className="btn-primary">
                    <Plus size={18} /> Nova Publicação
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Todas as Publicações</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por título, descrição..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="filter-group">
                            <select value={statusFilter} onChange={handleStatusChange}>
                                <option value="">Todos os status</option>
                                <option value="published">Publicado</option>
                                <option value="draft">Rascunho</option>
                                <option value="archived">Arquivado</option>
                            </select>
                            <select value={typeFilter} onChange={handleTypeChange}>
                                <option value="">Todos os tipos</option>
                                {Object.entries(POST_TYPES).map(([key, val]) => (
                                    <option key={key} value={key}>{val.icon} {val.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    {posts.length > 0 ? (
                        posts.map(post => {
                            const typeConfig = POST_TYPES[post.post_type] || POST_TYPES.general;
                            return (
                                <div key={post.id} className="post-row">
                                    <div className="post-info">
                                        <div className="post-type-badge" style={{ background: `${typeConfig.color}15`, color: typeConfig.color }}>
                                            {typeConfig.icon} {typeConfig.label}
                                        </div>
                                        <div className="post-title-cell">
                                            <strong>{post.title || post.content?.substring(0, 50) || 'Sem título'}</strong>
                                            <span className="post-meta">{post.post_type === 'job' ? 'Vaga' : post.post_type === 'event' ? 'Evento' : 'Publicação'}</span>
                                        </div>
                                    </div>
                                    <div className="post-status">
                                        <span className={`status-badge ${post.status}`}>{post.status === 'published' ? 'Publicado' : post.status === 'draft' ? 'Rascunho' : 'Arquivado'}</span>
                                    </div>
                                    <div className="post-stats">
                                        <span>👁 {post.views_count || 0}</span>
                                        <span>👍 {post.likes_count || 0}</span>
                                        <span>💬 {post.comments_count || 0}</span>
                                    </div>
                                    <div className="post-date">
                                        {new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="post-actions">
                                        <Link to={`/business/dashboard/posts/${post.id}/edit`} className="action-btn" title="Editar">
                                            <Edit size={16} />
                                        </Link>
                                        <button className="action-btn danger" onClick={() => handleDelete(post.id)} title="Excluir">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state">
                            <p>Nenhuma publicação encontrada</p>
                            <Link to="/business/dashboard/posts/new" className="btn-primary">
                                <Plus size={18} /> Criar primeira publicação
                            </Link>
                        </div>
                    )}

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="pagination-btn"
                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                disabled={pagination.page === 1}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="pagination-info">
                                Página {pagination.page} de {pagination.totalPages} ({pagination.total} publicações)
                            </span>
                            <button
                                className="pagination-btn"
                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                disabled={pagination.page === pagination.totalPages}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BusinessDashboardPosts;