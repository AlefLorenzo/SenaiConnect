import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash, Eye, Flag } from 'lucide-react';
import Card from '../../components/ui/Card/Card';
import Button from '../../components/ui/Button/Button';
import Input from '../../components/ui/Input/Input';
import Alert from '../../components/ui/Alert/Alert';
import Badge from '../../components/ui/Badge/Badge';

import './AdminNoticesList.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const StatusBadge = ({ status, pinned }) => {
    const configs = {
        published: { label: 'Publicado', variant: 'success' },
        draft: { label: 'Rascunho', variant: 'neutral' },
        scheduled: { label: 'Agendado', variant: 'info' },
        expired: { label: 'Expirado', variant: 'error' }
    };
    const config = configs[status] || configs.draft;
    return (
        <Badge variant={config.variant} dot>
            {pinned && <Flag size={10} aria-hidden="true" />}
            {config.label}
        </Badge>
    );
};

const PriorityBadge = ({ priority }) => {
    const configs = {
        urgent: { label: 'URGENTE', variant: 'error' },
        important: { label: 'IMPORTANTE', variant: 'warning' },
        normal: { label: 'NORMAL', variant: 'neutral' }
    };
    const config = configs[priority] || configs.normal;
    return <Badge variant={config.variant}>{config.label}</Badge>;
};

const AdminNoticesList = () => {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });

    const fetchNotices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = sessionStorage.getItem('token');
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);
            if (priorityFilter) params.append('priority', priorityFilter);

            const res = await fetch(`${API_URL}/api/admin/notices?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setNotices(data.notices);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            } else {
                throw new Error('Erro ao buscar avisos');
            }
        } catch (err) {
            console.error('Erro ao buscar avisos:', err);
            setError('Não foi possível carregar os avisos. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, statusFilter, priorityFilter]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchNotices();
    }, [fetchNotices]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePriorityChange = (e) => {
        setPriorityFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este aviso?')) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/notices/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                fetchNotices();
            }
        } catch (error) {
            console.error('Erro ao excluir:', error);
        }
    };

    const handlePublishToggle = async (id, currentStatus) => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/notices/${id}/publish`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ publish: currentStatus !== 'published' })
            });
            if (res.ok) fetchNotices();
        } catch (error) {
            console.error('Erro ao alterar publicação:', error);
        }
    };

    if (loading) {
        return (
            <div className="admin-notices-list">
                <div className="loading-state">
                    <div className="loading-spinner" />
                    <p>Carregando avisos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-notices-list">
            <div className="page-header">
                <div>
                    <h1>Avisos</h1>
                    <p>Gerencie todos os comunicados publicados na plataforma</p>
                </div>
                <RouterLink to="/admin/notices/create">
                    <Button variant="primary">
                        <Plus size={18} /> Novo Aviso
                    </Button>
                </RouterLink>
            </div>

            {error && (
                <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Card className="notices-card" padding="none" elevation="md">
                <div className="card-header">
                    <h2>Lista de Avisos</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} aria-hidden="true" />
                            <Input
                                type="text"
                                placeholder="Buscar por título, descrição..."
                                value={search}
                                onChange={handleSearch}
                                aria-label="Buscar avisos"
                            />
                        </div>
                        <div className="filter-group">
                            <Input
                                as="select"
                                value={statusFilter}
                                onChange={handleStatusChange}
                                options={[
                                    { value: '', label: 'Todos os status' },
                                    { value: 'published', label: 'Publicado' },
                                    { value: 'draft', label: 'Rascunho' },
                                    { value: 'scheduled', label: 'Agendado' },
                                    { value: 'expired', label: 'Expirado' }
                                ]}
                                aria-label="Filtrar por status"
                            />
                            <Input
                                as="select"
                                value={priorityFilter}
                                onChange={handlePriorityChange}
                                options={[
                                    { value: '', label: 'Todas prioridades' },
                                    { value: 'urgent', label: 'Urgente' },
                                    { value: 'important', label: 'Importante' },
                                    { value: 'normal', label: 'Normal' }
                                ]}
                                aria-label="Filtrar por prioridade"
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Título</th>
                                <th>Prioridade</th>
                                <th>Destinatários</th>
                                <th>Publicação</th>
                                <th>Validade</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notices.length > 0 ? notices.map((notice, index) => (
                                <tr key={notice.id}>
                                    <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                    <td>
                                        <div className="notice-title">{notice.title}</div>
                                        <div className="notice-author">Por {notice.author_name}</div>
                                    </td>
                                    <td><PriorityBadge priority={notice.priority} /></td>
                                    <td className="recipients-cell">
                                        {notice.recipients ? (
                                            Array.isArray(notice.recipients) ? (
                                                notice.recipients.map(r => <span key={r} className="recipient-tag">{r}</span>)
                                            ) : typeof notice.recipients === 'object' ? (
                                                notice.recipients.type === 'all' ? 'Todos os alunos' :
                                                `${notice.recipients.type}: ${notice.recipients.values?.join(', ') || ''}`
                                            ) : (
                                                notice.recipients
                                            )
                                        ) : 'Todos'}
                                    </td>
                                    <td>{formatDateTime(notice.published_at)}</td>
                                    <td>{formatDate(notice.expires_at)}</td>
                                    <td><StatusBadge status={notice.status} pinned={notice.is_pinned} /></td>
                                    <td>
                                        <div className="actions">
                                            <RouterLink
                                                to={`/admin/notices/edit/${notice.id}`}
                                                className="btn btn--ghost btn--sm"
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </RouterLink>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handlePublishToggle(notice.id, notice.status)}
                                                title={notice.status === 'published' ? 'Despublicar' : 'Publicar'}
                                            >
                                                {notice.status === 'published' ? <Eye size={16} /> : <Flag size={16} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="danger"
                                                onClick={() => handleDelete(notice.id)}
                                                title="Excluir"
                                            >
                                                <Trash size={16} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="empty-row">Nenhum aviso encontrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="pagination">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                            icon="arrow-left"
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <span className="pagination-info">
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} avisos)
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                            icon="arrow-right"
                            iconPosition="right"
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default AdminNoticesList;