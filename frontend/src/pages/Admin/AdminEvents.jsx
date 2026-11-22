import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import './AdminEvents.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const StatusBadge = ({ status }) => {
    const configs = {
        ativo: { label: 'Ativo', class: 'status-active' },
        active: { label: 'Ativo', class: 'status-active' },
        rascunho: { label: 'Rascunho', class: 'status-draft' },
        draft: { label: 'Rascunho', class: 'status-draft' },
        arquivado: { label: 'Arquivado', class: 'status-archived' },
        archived: { label: 'Arquivado', class: 'status-archived' }
    };
    const config = configs[status] || configs.draft;
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
};

const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AdminEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`${API_URL}/api/admin/events?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setEvents(data.events);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar eventos:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, statusFilter]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchEvents();
    }, [fetchEvents]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/events/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchEvents();
        } catch (error) {
            console.error('Erro ao excluir:', error);
        }
    };

    if (loading) return <div className="loading-state">Carregando eventos...</div>;

    return (
        <div className="admin-events">
            <div className="page-header">
                <div>
                    <h1>Gerenciamento de Eventos</h1>
                    <p>Gerencie eventos e atividades da comunidade SENAI</p>
                </div>
                <Link to="/admin/events/new" className="btn-primary">
                    <Plus size={18} /> Novo Evento
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Lista de Eventos</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por título, local..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <select value={statusFilter} onChange={handleStatusChange} className="filter-select">
                            <option value="">Todos os status</option>
                            <option value="ativo">Ativo</option>
                            <option value="rascunho">Rascunho</option>
                            <option value="arquivado">Arquivado</option>
                        </select>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Título</th>
                                <th>Data/Hora</th>
                                <th>Local</th>
                                <th>Unidade</th>
                                <th>Categoria</th>
                                <th>Vagas</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.length > 0 ? events.map((event, index) => (
                                <tr key={event.id}>
                                    <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                    <td>
                                        <div className="event-title">{event.title}</div>
                                        <div className="event-author">Por {event.author_name}</div>
                                    </td>
                                    <td>
                                        {event.event_date ? formatDate(event.event_date) : '-'}
                                        {event.event_time && (
                                            <>
                                                <br />
                                                <small>{event.event_time}</small>
                                            </>
                                        )}
                                    </td>
                                    <td>{event.location || '-'}</td>
                                    <td>{event.unit || '-'}</td>
                                    <td>{event.category || '-'}</td>
                                    <td>{event.vacancies || 0}</td>
                                    <td><StatusBadge status={event.status} /></td>
                                    <td>
                                        <div className="actions">
                                            <Link to={`/admin/events/${event.id}/edit`} className="action-btn" title="Editar">
                                                <Edit size={16} />
                                            </Link>
                                            <button className="action-btn danger" onClick={() => handleDelete(event.id)} title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="empty-row">Nenhum evento encontrado</td>
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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} eventos)
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

export default AdminEvents;