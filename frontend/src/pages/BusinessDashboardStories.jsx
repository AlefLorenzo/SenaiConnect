import { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2, Image, Video, Clock } from 'lucide-react';
import './BusinessDashboardStories.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const BusinessDashboardStories = () => {
    const { socket } = useContext(SocketContext);

    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });

    const token = () => sessionStorage.getItem('token');

    const fetchStories = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);

            const res = await fetch(`${API_URL}/api/business/my-stories?${params}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });

            if (res.ok) {
                const data = await res.json();
                setStories(data.stories);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (err) {
            console.error('Erro ao buscar stories:', err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchStories();
    }, [fetchStories]);

    useEffect(() => {
        if (!socket) return;

        const handleNewStory = (story) => {
            setStories(prev => [story, ...prev].slice(0, 50));
        };

        socket.on('business_story_created', handleNewStory);

        return () => {
            socket.off('business_story_created', handleNewStory);
        };
    }, [socket]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este story?')) return;
        try {
            const res = await fetch(`${API_URL}/api/business/my-stories/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) fetchStories();
        } catch (err) {
            console.error('Erro ao excluir:', err);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const isExpired = (expiresAt) => new Date(expiresAt) < new Date();

    if (loading) {
        return <div className="loading-state">Carregando stories...</div>;
    }

    return (
        <div className="business-dashboard-stories">
            <div className="page-header">
                <div>
                    <h1>Meus Stories</h1>
                    <p>Gerencie os stories da sua empresa (duração: 24h)</p>
                </div>
                <Link to="/business/dashboard/stories/new" className="btn-primary">
                    <Plus size={18} /> Novo Story
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Todos os Stories</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por conteúdo..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                    </div>
                </div>

                <div className="stories-grid">
                    {stories.length > 0 ? stories.map(story => {
                        const expired = isExpired(story.expires_at);
                        const isVideo = story.media_type === 'video' || story.media_url?.match(/\.(mp4|mov|webm)$/i);

                        return (
                            <article key={story.id} className={`story-card ${expired ? 'expired' : ''}`}>
                                <div className="story-preview">
                                    {isVideo ? (
                                        <video src={story.media_url} muted loop className="story-media" />
                                    ) : (
                                        <img src={story.media_url} alt="" className="story-media" />
                                    )}
                                    {expired && <span className="expired-badge">Expirado</span>}
                                </div>
                                <div className="story-info">
                                    <div className="story-header">
                                        <span className={`story-type ${story.media_type}`}>
                                            {story.media_type === 'video' ? <Video size={14} /> : <Image size={14} />}
                                            {story.media_type === 'video' ? 'Vídeo' : 'Imagem'}
                                        </span>
                                        <span className="story-date">
                                            <Clock size={14} /> {formatDate(story.created_at)}
                                        </span>
                                    </div>
                                    {story.text_content && (
                                        <p className="story-text">{story.text_content.substring(0, 100)}...</p>
                                    )}
                                    {story.link_url && (
                                        <div className="story-link">
                                            <span className="link-badge">🔗 Link ativo</span>
                                        </div>
                                    )}
                                    <div className="story-stats">
                                        <span>👁 {story.views_count || 0} visualizações</span>
                                        <span>👆 {story.clicks_count || 0} cliques</span>
                                    </div>
                                    <div className="story-actions">
                                        <Link to={`/business/dashboard/stories/${story.id}/edit`} className="action-btn" title="Editar">
                                            <Edit size={16} />
                                        </Link>
                                        <button className="action-btn danger" onClick={() => handleDelete(story.id)} title="Excluir">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    }) : (
                        <div className="empty-state">
                            <p>Nenhum story publicado</p>
                            <Link to="/business/dashboard/stories/new" className="btn-primary">
                                <Plus size={18} /> Criar primeiro story
                            </Link>
                        </div>
                    )}
                </div>

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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} stories)
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
    );
};

export default BusinessDashboardStories;