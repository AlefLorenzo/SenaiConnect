import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Eye, AlertTriangle, Clock, CheckCircle, Archive } from 'lucide-react';
import './AdminReports.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const StatusBadge = ({ status }) => {
    const configs = {
        pending: { label: 'Pendente', class: 'status-pending', icon: Clock },
        reviewing: { label: 'Em Análise', class: 'status-reviewing', icon: AlertTriangle },
        resolved: { label: 'Resolvida', class: 'status-resolved', icon: CheckCircle },
        dismissed: { label: 'Arquivada', class: 'status-dismissed', icon: Archive }
    };
    const config = configs[status] || configs.pending;
    return (
        <span className={`status-badge ${config.class}`}>
            <config.icon size={10} />
            {config.label}
        </span>
    );
};

const CategoryBadge = ({ category }) => {
    const labels = {
        inappropriate: 'Conteúdo Inadequado',
        harassment: 'Assédio/Desrespeito',
        spam: 'Spam',
        fake: 'Informações Falsas',
        abusive: 'Comportamento Abusivo',
        other: 'Outros'
    };
    return <span className="category-badge">{labels[category] || category}</span>;
};

const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const AdminReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, reviewing: 0, resolved: 0, dismissed: 0 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 15 });

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('admin_token');
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            if (categoryFilter) params.append('category', categoryFilter);

            const res = await fetch(`${API_URL}/api/admin/reports?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setReports(data.reports);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar denúncias:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, statusFilter, categoryFilter]);

    const fetchStats = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await fetch(`${API_URL}/api/admin/reports/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data.summary);
            }
        } catch (error) {
            console.error('Erro ao buscar stats:', error);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchReports();
        fetchStats();
    }, [fetchReports, fetchStats]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleCategoryChange = (e) => {
        setCategoryFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    if (loading) return <div className="loading-state">Carregando denúncias...</div>;

    return (
        <div className="admin-reports">
            <div className="page-header">
                <div>
                    <h1>Central de Denúncias</h1>
                    <p>Gerencie e modere denúncias dos usuários</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-row">
                <div className="stat-mini pending">
                    <div className="stat-mini-value">{stats.pending}</div>
                    <div className="stat-mini-label">Pendentes</div>
                </div>
                <div className="stat-mini reviewing">
                    <div className="stat-mini-value">{stats.reviewing}</div>
                    <div className="stat-mini-label">Em Análise</div>
                </div>
                <div className="stat-mini resolved">
                    <div className="stat-mini-value">{stats.resolved}</div>
                    <div className="stat-mini-label">Resolvidas</div>
                </div>
                <div className="stat-mini dismissed">
                    <div className="stat-mini-value">{stats.dismissed}</div>
                    <div className="stat-mini-label">Arquivadas</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Todas as Denúncias</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por motivo, usuário, conteúdo..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="filter-group">
                            <select value={statusFilter} onChange={handleStatusChange}>
                                <option value="">Todos os status</option>
                                <option value="pending">Pendente</option>
                                <option value="reviewing">Em Análise</option>
                                <option value="resolved">Resolvida</option>
                                <option value="dismissed">Arquivada</option>
                            </select>
                            <select value={categoryFilter} onChange={handleCategoryChange}>
                                <option value="">Todas categorias</option>
                                <option value="inappropriate">Conteúdo Inadequado</option>
                                <option value="harassment">Assédio/Desrespeito</option>
                                <option value="spam">Spam</option>
                                <option value="fake">Informações Falsas</option>
                                <option value="abusive">Comportamento Abusivo</option>
                                <option value="other">Outros</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Categoria</th>
                                <th>Denunciante</th>
                                <th>Conteúdo Denunciado</th>
                                <th>Usuário Alvo</th>
                                <th>Data</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.length > 0 ? reports.map((report, index) => (
                                <tr key={report.id}>
                                    <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                    <td><CategoryBadge category={report.reason} /></td>
                                    <td>
                                        <div className="reporter-info">
                                            <div className="reporter-avatar">{report.reporter_name?.charAt(0) || '?'}</div>
                                            <div>
                                                <div className="reporter-name">{report.reporter_name}</div>
                                                <div className="reporter-role">{report.reporter_role || 'Aluno'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="target-content">
                                        <div className="target-preview">{report.description?.substring(0, 100)}...</div>
                                        <div className="target-meta">{report.target_type} • {report.target_name || `ID: ${report.target_id}`}</div>
                                    </td>
                                    <td>
                                        {report.target_user ? (
                                            <>
                                                <strong>{report.target_user.name}</strong>
                                                <br />
                                                <small>@{report.target_user.name.toLowerCase().replace(/\s+/g, '.')}</small>
                                            </>
                                        ) : 'N/A'}
                                    </td>
                                    <td>{formatDateTime(report.created_at)}</td>
                                    <td><StatusBadge status={report.status} /></td>
                                    <td>
                                        <div className="actions">
                                            <Link to={`/admin/reports/${report.id}`} className="action-btn" title="Ver detalhes">
                                                <Eye size={16} />
                                            </Link>
                                            {report.status === 'pending' && (
                                                <button
                                                    className="action-btn review"
                                                    onClick={() => startReview(report.id)}
                                                    title="Iniciar análise"
                                                >
                                                    <AlertTriangle size={16} />
                                                </button>
                                            )}
                                            {report.status === 'reviewing' && (
                                                <Link to={`/admin/reports/${report.id}`} className="action-btn resolve" title="Resolver">
                                                    <CheckCircle size={16} />
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="empty-row">Nenhuma denúncia encontrada</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} denúncias)
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

const startReview = async (id) => {
    try {
        const token = sessionStorage.getItem('admin_token');
        const res = await fetch(`${API_URL}/api/admin/reports/${id}/review`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) window.location.reload();
    } catch (error) {
        console.error('Erro ao iniciar análise:', error);
    }
};

export default AdminReports;