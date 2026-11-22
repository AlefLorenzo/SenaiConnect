import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2, Eye, Target, Play, Pause, AlertTriangle } from 'lucide-react';
import './BusinessDashboardCampaigns.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const STATUS_CONFIG = {
    draft: { label: 'Rascunho', class: 'status-draft', icon: '✏️' },
    pending_approval: { label: 'Aguardando Aprovação', class: 'status-pending', icon: '⏳' },
    approved: { label: 'Aprovada', class: 'status-approved', icon: '✅' },
    scheduled: { label: 'Agendada', class: 'status-scheduled', icon: '📅' },
    active: { label: 'Ativa', class: 'status-active', icon: '▶️' },
    paused: { label: 'Pausada', class: 'status-paused', icon: '⏸️' },
    completed: { label: 'Concluída', class: 'status-completed', icon: '✅' },
    rejected: { label: 'Rejeitada', class: 'status-rejected', icon: '❌' }
};

const BILLING_MODELS = {
    CPM: { label: 'CPM (por mil impressões)', unit: 'R$/mil imp.' },
    CPC: { label: 'CPC (por clique)', unit: 'R$/clique' },
    FIXED: { label: 'Preço Fixo (período)', unit: 'R$/período' }
};

const BusinessDashboardCampaigns = () => {
    const { socket } = useContext(SocketContext);

    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });

    const token = () => sessionStorage.getItem('token');

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });
            if (search) params.append('search', search);
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`${API_URL}/api/business/my-campaigns?${params}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });

            if (res.ok) {
                const data = await res.json();
                setCampaigns(data.campaigns);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (err) {
            console.error('Erro ao buscar campanhas:', err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, search, statusFilter]);

    // Ref to hold latest fetchCampaigns for socket handlers
    const fetchCampaignsRef = useRef(null);

    useEffect(() => {
        fetchCampaignsRef.current = fetchCampaigns;
    }, [fetchCampaigns]);

    useEffect(() => {
        if (!socket) return;

        const handleCampaignUpdate = () => fetchCampaignsRef.current?.();

        socket.on('campaign_status_changed', handleCampaignUpdate);

        return () => {
            socket.off('campaign_status_changed', handleCampaignUpdate);
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

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getBudgetUsage = (campaign) => {
        if (!campaign.budget || campaign.budget === 0) return 0;
        return ((campaign.spent || 0) / campaign.budget * 100).toFixed(1);
    };

    const handlePause = async (id, pause) => {
        try {
            const res = await fetch(`${API_URL}/api/business/my-campaigns/${id}/pause`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token()}`
                },
                body: JSON.stringify({ pause })
            });
            if (res.ok) fetchCampaigns();
        } catch (err) {
            console.error('Erro ao pausar/reativar:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta campanha? (Apenas rascunho/rejeitada)')) return;
        try {
            const res = await fetch(`${API_URL}/api/business/my-campaigns/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) fetchCampaigns();
        } catch (err) {
            console.error('Erro ao excluir:', err);
        }
    };

    const handleSubmitApproval = async (id) => {
        if (!window.confirm('Enviar esta campanha para aprovação administrativa?')) return;
        try {
            const res = await fetch(`${API_URL}/api/business/my-campaigns/${id}/submit`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) fetchCampaigns();
        } catch (err) {
            console.error('Erro ao enviar para aprovação:', err);
        }
    };

    if (loading) return <div className="loading-state">Carregando campanhas...</div>;

    return (
        <div className="business-dashboard-campaigns">
            <div className="page-header">
                <div>
                    <h1>Minhas Campanhas</h1>
                    <p>Gerencie suas campanhas publicitárias, orçamentos e desempenho</p>
                </div>
                <Link to="/business/campaigns/new" className="btn-primary">
                    <Plus size={18} /> Nova Campanha
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Todas as Campanhas</h2>
                    <div className="filters">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nome, objetivo..."
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="filter-group">
                            <select value={statusFilter} onChange={handleStatusChange}>
                                <option value="">Todos os status</option>
                                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                    <option key={key} value={key}>{val.icon} {val.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Campanha</th>
                                <th>Objetivo</th>
                                <th>Modelo</th>
                                <th>Orçamento</th>
                                <th>Gasto</th>
                                <th>Período</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.length > 0 ? campaigns.map(campaign => {
                                const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
                                const budgetUsage = getBudgetUsage(campaign);

                                return (
                                    <tr key={campaign.id}>
                                        <td>
                                            <strong>{campaign.name}</strong>
                                            <br />
                                            <small>{campaign.objective}</small>
                                        </td>
                                        <td>{campaign.objective}</td>
                                        <td>
                                            <span className="billing-badge">
                                                {BILLING_MODELS[campaign.billing_model]?.label || campaign.billing_model}
                                            </span>
                                        </td>
                                        <td>{formatCurrency(campaign.budget)}</td>
                                        <td>
                                            <div className="spent-cell">
                                                <span>{formatCurrency(campaign.spent)}</span>
                                                <div className="budget-bar">
                                                    <div className="budget-fill" style={{ width: `${Math.min(100, budgetUsage)}%` }} />
                                                </div>
                                                <small>{budgetUsage}% usado</small>
                                            </div>
                                        </td>
                                        <td>
                                            {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${statusConfig.class}`}>
                                                {statusConfig.icon} {statusConfig.label}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="actions">
                                                <Link to={`/business/dashboard/campaigns/${campaign.id}`} className="action-btn" title="Ver detalhes">
                                                    <Eye size={16} />
                                                </Link>
                                                {campaign.status === 'draft' && (
                                    <>
                                        <Link to={`/business/dashboard/campaigns/${campaign.id}/edit`} className="action-btn" title="Editar">
                                            <Edit size={16} />
                                        </Link>
                                        <button className="action-btn" onClick={() => handleSubmitApproval(campaign.id)} title="Enviar para aprovação">
                                            <Target size={16} />
                                        </button>
                                        <button className="action-btn danger" onClick={() => handleDelete(campaign.id)} title="Excluir">
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                                                {campaign.status === 'pending_approval' && (
                                    <>
                                        <span className="action-btn waiting" title="Aguardando aprovação">
                                            <AlertTriangle size={16} />
                                        </span>
                                    </>
                                )}
                                                {campaign.status === 'active' && (
                                    <>
                                        <button className="action-btn pause" onClick={() => handlePause(campaign.id, true)} title="Pausar">
                                            <Pause size={16} />
                                        </button>
                                    </>
                                )}
                                                {campaign.status === 'paused' && (
                                    <>
                                        <button className="action-btn play" onClick={() => handlePause(campaign.id, false)} title="Reativar">
                                            <Play size={16} />
                                        </button>
                                    </>
                                )}
                                                {campaign.status === 'rejected' && (
                                    <>
                                        <button className="action-btn danger" onClick={() => handleDelete(campaign.id)} title="Excluir">
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="empty-row">Nenhuma campanha encontrada</td>
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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} campanhas)
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

export default BusinessDashboardCampaigns;