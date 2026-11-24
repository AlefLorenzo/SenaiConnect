import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, Eye, User, AlertTriangle, Trash2, Edit, Plus, Shield, Clock, CheckCircle } from 'lucide-react';
import './AdminAudit.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ActionBadge = ({ action }) => {
    const configs = {
        create: { label: 'Criação', class: 'action-create', icon: Plus },
        update: { label: 'Edição', class: 'action-update', icon: Edit },
        delete: { label: 'Exclusão', class: 'action-delete', icon: Trash2 },
        block: { label: 'Bloqueio', class: 'action-block', icon: User },
        login: { label: 'Login Admin', class: 'action-login', icon: Shield },
        resolve: { label: 'Resolução', class: 'action-resolve', icon: CheckCircle },
        warn: { label: 'Advertência', class: 'action-warn', icon: AlertTriangle },
        restrict: { label: 'Restrição', class: 'action-restrict', icon: Shield }
    };
    const config = configs[action] || { label: action, class: 'action-default', icon: Clock };
    return (
        <span className={`action-badge ${config.class}`}>
            <config.icon size={10} />
            {config.label}
        </span>
    );
};

const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const AdminAudit = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0, thisMonth: 0 });
    const [actions, setActions] = useState([]);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [adminFilter, setAdminFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 50 });
    const [detailModal, setDetailModal] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (actionFilter) params.append('action', actionFilter);
            if (adminFilter) params.append('admin_id', adminFilter);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);

            const res = await fetch(`${API_URL}/api/admin/audit?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar logs:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, actionFilter, adminFilter, dateFrom, dateTo]);

    const fetchStats = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/audit/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // token is used in the headers above
            void token;
            if (res.ok) {
                const data = await res.json();
                setStats(data.overview);
            }
        } catch (error) {
            console.error('Erro ao buscar stats:', error);
        }
    }, []);

    const fetchActions = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/admin/audit/actions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setActions(data);
            }
        } catch (error) {
            console.error('Erro ao buscar ações:', error);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchLogs();
        fetchStats();
        fetchActions();
    }, [fetchLogs, fetchStats, fetchActions]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleActionChange = (e) => {
        setActionFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleAdminChange = (e) => {
        setAdminFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleDateChange = (field, e) => {
        if (field === 'from') setDateFrom(e.target.value);
        else setDateTo(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const exportLogs = async () => {
        const params = new URLSearchParams();
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        if (actionFilter) params.append('action', actionFilter);
        if (adminFilter) params.append('admin_id', adminFilter);

        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/admin/audit/export?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Não foi possível exportar o relatório.');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = 'senai-connect-auditoria.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Erro ao exportar auditoria:', error);
            window.alert(error.message || 'Não foi possível exportar o relatório.');
        }
    };
    const openDetail = (log) => setDetailModal(log);
    const closeDetail = () => setDetailModal(null);

    if (loading) return <div className="loading-state">Carregando logs de auditoria...</div>;

    return (
        <div className="admin-audit">
            <div className="page-header">
                <div>
                    <h1>Histórico de Auditoria</h1>
                    <p>Rastreie todas as ações administrativas realizadas no sistema</p>
                </div>
                <button className="btn-secondary" onClick={exportLogs}>
                    <Download size={18} /> Exportar CSV
                </button>
            </div>

            {/* Stats */}
            <div className="stats-row">
                <div className="stat-mini total">
                    <div className="stat-mini-value">{stats.total?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Total de Ações</div>
                </div>
                <div className="stat-mini today">
                    <div className="stat-mini-value">{stats.today?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Hoje</div>
                </div>
                <div className="stat-mini admins">
                    <div className="stat-mini-value">{stats.thisWeek?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Esta Semana</div>
                </div>
                <div className="stat-mini actions">
                    <div className="stat-mini-value">{stats.thisMonth?.toLocaleString() || 0}</div>
                    <div className="stat-mini-label">Este Mês</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Registros de Auditoria</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por ação, admin, alvo..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="filter-group">
                            <select value={actionFilter} onChange={handleActionChange}>
                                <option value="">Todas as ações</option>
                                {actions.map(a => <option key={a.action} value={a.action}>{a.action_label}</option>)}
                            </select>
                            <select value={adminFilter} onChange={handleAdminChange}>
                                <option value="">Todos administradores</option>
                                {actions.filter(a => a.admin_name).map(a => <option key={a.admin_id} value={a.admin_id}>{a.admin_name} ({a.admin_role})</option>)}
                            </select>
                            <input type="date" value={dateFrom} onChange={e => handleDateChange('from', e)} title="Data inicial" />
                            <input type="date" value={dateTo} onChange={e => handleDateChange('to', e)} title="Data final" />
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Ação</th>
                                <th>Alvo</th>
                                <th>Administrador</th>
                                <th>Data/Hora</th>
                                <th>IP</th>
                                <th>Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length > 0 ? logs.map((log, index) => (
                                <tr key={log.id}>
                                    <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                    <td><ActionBadge action={log.action} /></td>
                                    <td>
                                        <div className="target-info">
                                            <span className="target-type">{log.target_type || '-'}</span>
                                            <span className="target-name">{log.target_name || (log.target_id ? `#${log.target_id}` : '-')}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="admin-cell">
                                            <div className="admin-avatar">{log.admin_name?.charAt(0) || '?'}</div>
                                            <div>
                                                <div className="admin-name">{log.admin_name}</div>
                                                <div className="admin-role">{log.admin_role || 'Admin'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{formatDateTime(log.created_at)}</td>
                                    <td className="ip-cell">{log.ip_address || '-'}</td>
                                    <td>
                                        <button className="action-btn" onClick={() => openDetail(log)} title="Ver detalhes">
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="empty-row">Nenhum registro encontrado</td>
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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
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

            {/* Detail Modal */}
            {detailModal && (
                <div className="modal-overlay" onClick={closeDetail}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes do Log #{detailModal.id}</h2>
                            <button onClick={closeDetail} className="modal-close">&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item full">
                                    <label>Ação</label>
                                    <div className="value"><ActionBadge action={detailModal.action} /></div>
                                </div>
                                <div className="detail-item full">
                                    <label>Descrição</label>
                                    <div className="value">{detailModal.description || '-'}</div>
                                </div>
                                <div className="detail-item">
                                    <label>Alvo</label>
                                    <div className="value">
                                        {detailModal.target_type} #{detailModal.target_id}
                                        {detailModal.target_name && <span> - {detailModal.target_name}</span>}
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <label>Administrador</label>
                                    <div className="value">{detailModal.admin_name} ({detailModal.admin_role})</div>
                                </div>
                                <div className="detail-item">
                                    <label>Data/Hora</label>
                                    <div className="value">{formatDateTime(detailModal.created_at)}</div>
                                </div>
                                <div className="detail-item">
                                    <label>IP</label>
                                    <div className="value">{detailModal.ip_address || '-'}</div>
                                </div>
                                <div className="detail-item">
                                    <label>User Agent</label>
                                    <div className="value user-agent">{detailModal.user_agent || '-'}</div>
                                </div>
                            </div>
                            {detailModal.metadata && (
                                <div className="metadata-section">
                                    <h4>Metadados</h4>
                                    <pre>{JSON.stringify(detailModal.metadata, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeDetail}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAudit;