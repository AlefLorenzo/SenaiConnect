import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import StoryBar from '../components/Business/StoryBar';
import BusinessPostCard from '../components/Business/BusinessPostCard';
import BusinessStoryViewer from '../components/Business/BusinessStoryViewer';
import { companiesService } from '../services/companiesService';
import { Search, Filter, Building2, Loader2, X, Plus, Bell } from 'lucide-react';
import './DivulgacaoPage.css';

const POST_TYPES = {
    general: { label: 'Geral', icon: '📝' },
    job: { label: 'Vaga', icon: '💼' },
    internship: { label: 'Estágio', icon: '🎓' },
    course: { label: 'Curso', icon: '📚' },
    event: { label: 'Evento', icon: '📅' },
    product: { label: 'Produto', icon: '🛍️' },
    news: { label: 'Notícia', icon: '📰' },
    project: { label: 'Projeto', icon: '🚀' }
};

const DivulgacaoPage = () => {
    const { user } = useContext(AuthContext);
    const { socket } = useContext(SocketContext);

    // Stories state
    const [storyGroups, setStoryGroups] = useState([]);
    const [activeStoryGroup, setActiveStoryGroup] = useState(null);
    const [activeStoryIndex, setActiveStoryIndex] = useState(0);

    // Feed state
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const observerTarget = useRef(null);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        postType: '',
        category: '',
        sort: 'recent'
    });
    const [showFilters, setShowFilters] = useState(false);

    // Categories from posts
    const [categories, setCategories] = useState([]);

    const token = () => sessionStorage.getItem('token');

    // Fetch stories
    const fetchStories = useCallback(async () => {
        try {
            const data = await companiesService.getBusinessStories();
            setStoryGroups(data);
        } catch (err) {
            console.error('Erro ao buscar stories:', err);
        }
    }, []);

    // Fetch posts
    const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        try {
            const params = {
                page: pageNum,
                limit: 10,
                sort: filters.sort
            };
            if (filters.search) params.search = filters.search;
            if (filters.postType) params.category = filters.postType;
            if (filters.category) params.category = filters.category;

            const data = await companiesService.getBusinessFeed(params);
            if (append) {
                setPosts(prev => [...prev, ...data.data]);
            } else {
                setPosts(data.data);
                // Extrair categorias únicas
                const cats = [...new Set(data.data.map(p => p.category).filter(Boolean))];
                setCategories(cats);
            }
            setHasMore(data.pagination.hasMore);
            setPage(data.pagination.page);
        } catch (err) {
            console.error('Erro ao buscar posts:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters]);

    // Refs to hold latest callbacks for socket handlers
    const fetchStoriesRef = useRef(fetchStories);
    const fetchPostsRef = useRef(fetchPosts);

    useEffect(() => {
        fetchStoriesRef.current = fetchStories;
        fetchPostsRef.current = fetchPosts;
    }, [fetchStories, fetchPosts]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    fetchPostsRef.current(page + 1, true);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }
        return () => observer.disconnect();
    }, [hasMore, loadingMore, page, fetchPostsRef]);

    // Real-time updates
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

        const handleNewStory = (story) => {
            setStoryGroups(prev => {
                const existing = prev.find(g => g.business_id === story.business_id);
                if (existing) {
                    return prev.map(g =>
                        g.business_id === story.business_id
                            ? { ...g, stories: [story, ...g.stories], has_unseen: true }
                            : g
                    );
                } else {
                    return [{
                        business_id: story.business_id,
                        business_name: story.company_name,
                        business_logo: story.logo_url,
                        business_slug: story.slug,
                        stories: [story],
                        has_unseen: true
                    }, ...prev];
                }
            });
        };

        const handleStoryUpdate = (story) => {
            setStoryGroups(prev => prev.map(g => ({
                ...g,
                stories: g.stories.map(s => s.id === story.id ? story : s)
            })));
        };

        const handleBusinessPostCreated = (post) => {
            if (!filters.search && !filters.postType && !filters.category) {
                setPosts(prev => [post, ...prev].slice(0, 50));
            }
        };

        socket.on('business_post_created', handleBusinessPostCreated);
        socket.on('new_business_post', handleNewPost);
        socket.on('business_post_updated', handlePostUpdate);
        socket.on('business_post_deleted', handlePostDelete);
        socket.on('business_story_created', handleNewStory);
        socket.on('business_story_updated', handleStoryUpdate);

        return () => {
            socket.off('business_post_created', handleBusinessPostCreated);
            socket.off('new_business_post', handleNewPost);
            socket.off('business_post_updated', handlePostUpdate);
            socket.off('business_post_deleted', handlePostDelete);
            socket.off('business_story_created', handleNewStory);
            socket.off('business_story_updated', handleStoryUpdate);
        };
    }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

    // Initial load
    useEffect(() => {
         
        fetchStoriesRef.current();
         
        fetchPostsRef.current(1);
    }, []);

    // Refetch when filters change
    useEffect(() => {
        fetchPostsRef.current(1);
    }, [filters.search, filters.postType, filters.category, filters.sort, fetchPostsRef]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({ search: '', postType: '', category: '', sort: 'recent' });
    };

    const hasActiveFilters = filters.search || filters.postType || filters.category;

    const openStoryViewer = (group, index) => {
        setActiveStoryGroup(group);
        setActiveStoryIndex(index);
    };

    const closeStoryViewer = () => {
        setActiveStoryGroup(null);
    };

    const handleStoryComplete = () => {
        // Move to next group or close
        const currentIndex = storyGroups.findIndex(g => g.business_id === activeStoryGroup?.business_id);
        if (currentIndex < storyGroups.length - 1) {
            setActiveStoryGroup(storyGroups[currentIndex + 1]);
            setActiveStoryIndex(0);
        } else {
            closeStoryViewer();
        }
    };

    return (
        <div className="divulgacao-page">
            {/* Header */}
            <header className="divulgacao-header">
                <div className="header-left">
                    <Building2 size={28} className="header-icon" />
                    <div>
                        <h1>Divulgação</h1>
                        <p className="header-subtitle">Empresas, oportunidades e networking</p>
                    </div>
                </div>
                <div className="header-right">
                    {user?.is_business_owner && (
                        <Link to="/business/dashboard" className="btn-primary">
                            <Plus size={18} /> Painel da Empresa
                        </Link>
                    )}
                    <Link to="/notifications" className="icon-btn">
                        <Bell size={22} />
                    </Link>
                </div>
            </header>

            {/* Stories Bar */}
            <StoryBar
                storyGroups={storyGroups}
                currentUserId={user?.id}
                onOpenStory={openStoryViewer}
            />

            {/* Filters */}
            <div className={`filters-bar ${showFilters ? 'expanded' : ''}`}>
                <div className="filters-main">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar empresas, vagas, cursos..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>

                    <button className={`filter-toggle ${hasActiveFilters ? 'has-filters' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={18} />
                        Filtros
                        {hasActiveFilters && <span className="filter-badge">{[filters.postType, filters.category].filter(Boolean).length}</span>}
                    </button>

                    <select
                        value={filters.sort}
                        onChange={(e) => handleFilterChange('sort', e.target.value)}
                        className="sort-select"
                    >
                        <option value="recent">Mais Recentes</option>
                        <option value="popular">Mais Populares</option>
                        <option value="oldest">Mais Antigos</option>
                    </select>
                </div>

                {showFilters && (
                    <div className="filters-expanded">
                        <div className="filter-group">
                            <label>Tipo de Publicação</label>
                            <select value={filters.postType} onChange={(e) => handleFilterChange('postType', e.target.value)}>
                                <option value="">Todos os tipos</option>
                                {Object.entries(POST_TYPES).map(([key, val]) => (
                                    <option key={key} value={key}>{val.icon} {val.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Categoria</label>
                            <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
                                <option value="">Todas as categorias</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        {hasActiveFilters && (
                            <button className="btn-clear-filters" onClick={clearFilters}>
                                <X size={16} /> Limpar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Feed */}
            <main className="divulgacao-feed">
                {loading ? (
                    <div className="feed-loading">
                        <Loader2 size={32} className="spin" />
                        <p>Carregando publicações...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="feed-empty">
                        <Building2 size={64} />
                        <h3>Nenhuma publicação encontrada</h3>
                        <p>{hasActiveFilters ? 'Tente ajustar os filtros' : 'Seja o primeiro a seguir empresas e descobrir oportunidades!'}</p>
                        <Link to="/business/directory" className="btn-secondary">
                            <Building2 size={18} /> Explorar Empresas
                        </Link>
                    </div>
                ) : (
                    <>
                        {posts.map((post) => (
                            <BusinessPostCard
                                key={post.id}
                                post={post}
                                currentUserId={user?.id}
                                onUpdate={() => fetchPosts(page, false)}
                            />
                        ))}

                        {/* Infinite scroll trigger */}
                        <div ref={observerTarget} className="load-more-trigger">
                            {loadingMore && (
                                <div className="loading-more">
                                    <Loader2 size={24} className="spin" />
                                    <span>Carregando mais...</span>
                                </div>
                            )}
                            {!hasMore && posts.length > 0 && (
                                <div className="end-of-feed">Fim do feed</div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {/* Story Viewer Modal */}
            {activeStoryGroup && (
                <BusinessStoryViewer
                    storyGroup={activeStoryGroup}
                    initialIndex={activeStoryIndex}
                    onClose={closeStoryViewer}
                    onComplete={handleStoryComplete}
                    currentUserId={user?.id}
                />
            )}
        </div>
    );
};

export default DivulgacaoPage;