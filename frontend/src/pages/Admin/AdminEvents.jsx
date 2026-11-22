import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2, Users, Send, X } from 'lucide-react';
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
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [registrationSummary, setRegistrationSummary] = useState(null);
    const [loadingRegistrations, setLoadingRegistrations] = useState(false);
    const [message, setMessage] = useState('');
    const [audience, setAudience] = useState('registered');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [feedback, setFeedback] = useState('');

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

    const openRegistrations = async (event) => {
        setSelectedEvent(event);
        setRegistrations([]);
        setRegistrationSummary(null);
        setFeedback('');
        setLoadingRegistrations(true);
        try {
            const response = await fetch(`${API_URL}/api/admin/events/${event.id}/registrations`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os inscritos.');
            setRegistrations(data.registrations || []);
            setRegistrationSummary(data);
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setLoadingRegistrations(false);
        }
    };

    const sendEventMessage = async (event) => {
        if (!message.trim()) { setFeedback('Digite uma mensagem antes de enviar.'); return; }
        setSendingMessage(true);
        setFeedback('');
        try {
            const response = await fetch(`${API_URL}/api/admin/events/${event.id}/message`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message.trim(), audience })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a mensagem.');
            setFeedback(`Mensagem enviada para ${data.sent} usuário(s).`);
            setMessage('');
        } catch (error) {
            setFeedback(error.message);
        } finally {
            setSendingMessage(false);
        }
    };

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
                                <th>Inscritos / Vagas</th>
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
                                    <td>{Number(event.enrolled_count || 0)} / {Number(event.vacancies || 0) === 0 ? 'Ilimitadas' : event.vacancies}</td>
                                    <td><StatusBadge status={event.status} /></td>
                                    <td>
                                        <div className="actions">
                                            <button type="button" className="action-btn" onClick={() => openRegistrations(event)} title="Ver inscritos"><Users size={16} /></button>
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

                {selectedEvent && (
                    <section className="event-registrations-panel" aria-label={`Inscritos em ${selectedEvent.title}`}>
                        <div className="event-registrations-heading">
                            <div>
                                <h2>Inscritos — {selectedEvent.title}</h2>
                                <p>{registrationSummary ? `${registrationSummary.enrolled_count} inscrição(ões) • ${registrationSummary.available_vacancies === null ? 'Vagas ilimitadas' : `${registrationSummary.available_vacancies} vaga(s) disponível(is)`}` : 'Carregando dados do evento…'}</p>
                            </div>
                            <button type="button" className="action-btn" onClick={() => setSelectedEvent(null)} aria-label="Fechar inscritos"><X size={17} /></button>
                        </div>
                        {loadingRegistrations ? <p className="event-registrations-empty">Carregando inscritos…</p> : (
                            <div className="event-registrations-table-wrap">
                                <table className="event-registrations-table">
                                    <thead><tr><th>Nome informado</th><th>Conta</th><th>Participação</th><th>Turno</th><th>Curso</th><th>Observações</th><th>Inscrição</th></tr></thead>
                                    <tbody>
                                        {registrations.map((person) => (
                                            <tr key={`${person.event_id}-${person.user_id}`}>
                                                <td><strong>{person.registration_name || person.account_name || '—'}</strong>{person.team_name && <small>Equipe: {person.team_name}</small>}</td>
                                                <td>{person.account_name || '—'}<small>{person.email || ''}</small></td>
                                                <td>{person.participation_type === 'group' ? 'Em grupo' : 'Individual'}</td>
                                                <td>{person.shift || '—'}</td><td>{person.course || '—'}</td><td>{person.notes || '—'}</td>
                                                <td>{person.created_at ? new Date(person.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                                            </tr>
                                        ))}
                                        {!registrations.length && <tr><td colSpan={7} className="event-registrations-empty">Ainda não há inscrições neste evento.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="event-message-composer">
                            <h3><Send size={17} /> Enviar mensagem sobre o evento</h3>
                            <div className="event-message-controls">
                                <select value={audience} onChange={e => setAudience(e.target.value)}>
                                    <option value="registered">Somente inscritos</option>
                                    <option value="unit">Todos os usuários da unidade / todas as unidades</option>
                                </select>
                                <textarea rows={3} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva um convite, lembrete ou atualização sobre o evento…" />
                                <button type="button" className="btn-primary" disabled={sendingMessage || !message.trim()} onClick={() => sendEventMessage(selectedEvent)}>
                                    <Send size={16} /> {sendingMessage ? 'Enviando…' : 'Enviar mensagem'}
                                </button>
                            </div>
                            {feedback && <p className="event-message-feedback" role="status">{feedback}</p>}
                        </div>
                    </section>
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