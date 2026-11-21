import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2, Briefcase, MapPin, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import './BusinessDirectoryPage.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const BusinessDirectoryPage = () => {

    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sectorFilter, setSectorFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [sortBy, setSortBy] = useState('followers');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 12 });
    const [sectors, setSectors] = useState([]);
    const [locations, setLocations] = useState([]);

    useEffect(() => {
        let cancelled = false;
        const loadBusinesses = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    page: pagination.page,
                    limit: pagination.limit,
                    sort: sortBy
                });
                if (search) params.append('search', search);
                if (sectorFilter) params.append('sector', sectorFilter);
                if (locationFilter) params.append('location', locationFilter);

                const res = await fetch(`${API_URL}/api/business/businesses?${params}`, {
                    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                });

                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setBusinesses(data.businesses);

                    // Extract unique sectors and locations
                    const uniqueSectors = [...new Set(data.businesses.map(b => b.sector).filter(Boolean))];
                    const uniqueLocations = [...new Set(data.businesses.map(b => b.location).filter(Boolean))];
                    setSectors(uniqueSectors.sort());
                    setLocations(uniqueLocations.sort());

                    setPagination(prev => ({
                        ...prev,
                        total: data.total,
                        totalPages: data.totalPages
                    }));
                }
            } catch (err) {
                console.error('Erro ao buscar empresas:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadBusinesses();
        return () => { cancelled = true; };
    }, [pagination.page, pagination.limit, search, sectorFilter, locationFilter, sortBy]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleSectorChange = (e) => {
        setSectorFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleLocationChange = (e) => {
        setLocationFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleSortChange = (e) => {
        setSortBy(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    if (loading && businesses.length === 0) {
        return (
            <div className="directory-loading">
                <Loader2 size={40} className="spin" />
                <p>Carregando empresas...</p>
            </div>
        );
    }

    return (
        <div className="business-directory-page">
            {/* Hero */}
            <header className="directory-hero">
                <div className="hero-content">
                    <Building2 size={48} className="hero-icon" />
                    <h1>Diretório de Empresas</h1>
                    <p>Descubra empresas parceiras, oportunidades de estágio, vagas de emprego e programas de capacitação</p>
                </div>
                <div className="hero-stats">
                    <div className="stat">
                        <span className="stat-value">{businesses.length > 0 ? businesses[0].total || businesses.length : 0}</span>
                        <span className="stat-label">Empresas</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{new Set(businesses.map(b => b.sector)).size}</span>
                        <span className="stat-label">Setores</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{new Set(businesses.map(b => b.location)).size}</span>
                        <span className="stat-label">Localizações</span>
                    </div>
                </div>
            </header>

            {/* Filters */}
            <div className="directory-filters">
                <div className="filters-left">
                    <div className="search-box">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Buscar empresas, setores, localidades..."
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                </div>

                <div className="filters-right">
                    <div className="filter-group">
                        <select value={sectorFilter} onChange={handleSectorChange}>
                            <option value="">Todos os setores</option>
                            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <select value={locationFilter} onChange={handleLocationChange}>
                            <option value="">Todas as localidades</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <select value={sortBy} onChange={handleSortChange}>
                            <option value="followers">Mais Seguidores</option>
                            <option value="recent">Mais Recentes</option>
                            <option value="name">Ordem Alfabética</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <main className="directory-grid">
                {businesses.length > 0 ? (
                    <>
                        {businesses.map(business => (
                            <article key={business.id} className="business-card">
                                <Link to={`/business/${business.slug || business.id}`} className="card-link">
                                    <div className="card-image">
                                        {business.cover_image_url ? (
                                            <img src={business.cover_image_url} alt="" />
                                        ) : business.logo_url ? (
                                            <img src={`${API_URL}/uploads/logos/${business.logo_url}`} alt="" />
                                        ) : (
                                            <div className="placeholder-image">
                                                <Building2 size={32} />
                                            </div>
                                        )}
                                        {business.status === 'approved' && (
                                            <span className="verified-badge">✓ Verificada</span>
                                        )}
                                    </div>
                                    <div className="card-content">
                                        <div className="card-header">
                                            <div className="company-info">
                                                {business.logo_url ? (
                                                    <img src={`${API_URL}/uploads/logos/${business.logo_url}`} alt="" className="company-logo" />
                                                ) : (
                                                    <div className="company-logo-placeholder">
                                                        <Building2 size={20} />
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="company-name">{business.company_name}</h3>
                                                    <span className="company-sector">{business.sector || 'Setor não informado'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="company-description">{business.description || 'Sem descrição disponível'}</p>
                                        <div className="card-meta">
                                            {business.location && (
                                                <span className="meta-item">
                                                    <MapPin size={14} /> {business.location}
                                                </span>
                                            )}
                                            <span className="meta-item">
                                                <Briefcase size={14} /> {business.posts_count || 0} publicações
                                            </span>
                                            <span className="meta-item">
                                                <Users size={14} /> {business.followers_count || 0} seguidores
                                            </span>
                                        </div>
                                        <div className="card-footer">
                                            <span className="followers-count">{business.followers_count || 0} seguidores</span>
                                            <span className="card-cta">Ver perfil →</span>
                                        </div>
                                    </div>
                                </Link>
                            </article>
                        ))}
                    </>
                ) : (
                    <div className="no-results">
                        <Building2 size={64} />
                        <h3>Nenhuma empresa encontrada</h3>
                        <p>Tente ajustar os filtros de busca</p>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <nav className="pagination" aria-label="Paginação">
                        <button
                            className="pagination-btn"
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="pagination-info">
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} empresas)
                        </span>
                        <button
                            className="pagination-btn"
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </nav>
                )}
            </main>
        </div>
    );
};

export default BusinessDirectoryPage;