import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Flag, CheckCircle, Trash2, AlertTriangle, Shield, FileText, Clock, Eye, Archive } from 'lucide-react';
import './AdminReportDetail.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const StatusBadge = ({ status }) => {
    const configs = {
        pending: { label: 'Pendente', class: 'status-pending', icon: Clock },
        reviewing: { label: 'Em Análise', class: 'status-reviewing', icon: AlertTriangle },
        resolved: { label: 'Resolvida', class: 'status-resolved', icon: CheckCircle },
        dismissed: { label: 'Arquivada', class: 'status-dismissed', icon: Archive }
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
        <span className={`status-badge ${config.class}`}>
            <Icon size={10} />
            {config.label}
        </span>
    );
};

const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ActionButton = ({ action, label, icon: Icon, colorClass, actionLoading, onAction, onOpenModal }) => {
    const loadingState = actionLoading === action;
    return (
        <button
            className={`action-main-btn ${colorClass} ${loadingState ? 'loading' : ''}`}
            onClick={() => action === 'view' ? onAction(action) : onOpenModal(action)}
            disabled={loadingState}
        >
            <Icon size={18} />
            {loadingState ? 'Processando...' : label}
        </button>
    );
};

const AdminReportDetail = () => {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [modalAction, setModalAction] = useState(null);
    const [modalNotes, setModalNotes] = useState('');
    const [restrictionDays, setRestrictionDays] = useState(3);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('admin_token');
            const res = await fetch(`${API_URL}/api/admin/reports/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setReport(data);
            }
        } catch (error) {
            console.error('Erro ao buscar denúncia:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchReport();
    }, [fetchReport]);

    const handleAction = async (action) => {
        if (!modalNotes.trim() && action !== 'view') {
            alert('Observações administrativas são obrigatórias');
            return;
        }
        setActionLoading(action);
        try {
            const token = sessionStorage.getItem('admin_token');
            let res;

            switch (action) {
                case 'startReview':
                    res = await fetch(`${API_URL}/api/admin/reports/${id}/review`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    break;
                case 'resolve':
                    res = await fetch(`${API_URL}/api/admin/reports/${id}/resolve`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'remove_content', notes: modalNotes })
                    });
                    break;
                case 'warn':
                    res = await fetch(`${API_URL}/api/admin/reports/${id}/resolve`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'warn', notes: modalNotes })
                    });
                    break;
                case 'restrict':
                    res = await fetch(`${API_URL}/api/admin/reports/${id}/resolve`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'restrict', notes: modalNotes, restriction_days: restrictionDays })
                    });
                    break;
                case 'dismiss':
                    res = await fetch(`${API_URL}/api/admin/reports/${id}/dismiss`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: modalNotes })
                    });
                    break;
            }

            if (res?.ok) {
                closeModal();
                fetchReport();
            }
        } catch (error) {
            console.error('Erro na ação:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const openModal = (action) => {
        setModalAction(action);
        setModalNotes('');
    };

    const closeModal = () => {
        setModalAction(null);
        setModalNotes('');
    };

    if (loading) return <div className="detail-loading">Carregando detalhes da denúncia...</div>;
    if (!report) return <div className="detail-error">Denúncia não encontrada</div>;

    return (
        <div className="admin-report-detail">
            <div className="detail-header">
                <Link to="/admin/reports" className="back-link">
                    <ArrowLeft size={20} /> Voltar à Lista
                </Link>
                <div className="header-content">
                    <div className="report-id">Denúncia #{id}</div>
                    <h1>{report.reason === 'inappropriate' ? 'Conteúdo Inadequado' :
                        report.reason === 'harassment' ? 'Assédio/Desrespeito' :
                        report.reason === 'spam' ? 'Spam' :
                        report.reason === 'fake' ? 'Informações Falsas' :
                        report.reason === 'abusive' ? 'Comportamento Abusivo' : 'Outros'
                    }</h1>
                    <div className="report-meta">
                        <StatusBadge status={report.status} />
                        <span className="report-date">Reportada em {formatDateTime(report.created_at)}</span>
                    </div>
                </div>
                <div className="header-actions">
                    <Link to="/admin/reports" className="btn-secondary">Voltar à Lista</Link>
                </div>
            </div>

            <div className="detail-grid">
                {/* Left Column */}
                <div className="detail-main">
                    {/* Denunciante */}
                    <section className="detail-card">
                        <div className="card-header">
                            <Flag size={18} />
                            <h2>Denunciante</h2>
                        </div>
                        <div className="user-profile-card">
                            <div className="user-avatar-large">{report.reporter_name?.charAt(0) || '?'}</div>
                            <div className="user-info">
                                <h3>{report.reporter_name}</h3>
                                <p>{report.reporter_email}</p>
                                <span className="user-role">{report.reporter_role || 'Aluno'}</span>
                            </div>
                            <div className="user-stats">
                                <div className="stat"><span>8</span> Denúncias anteriores</div>
                                <div className="stat"><span>6</span> Resolvidas</div>
                            </div>
                        </div>
                    </section>

                    {/* Conteúdo Denunciado */}
                    <section className="detail-card">
                        <div className="card-header">
                            <FileText size={18} />
                            <h2>Conteúdo Denunciado</h2>
                        </div>
                        <div className="target-info">
                            <div className="target-type">
                                <span className="type-badge">{report.target_type === 'user' ? 'Usuário' :
                                    report.target_type === 'post' ? 'Post' :
                                    report.target_type === 'comment' ? 'Comentário' :
                                    report.target_type === 'message' ? 'Mensagem' :
                                    report.target_type === 'group' ? 'Grupo' : 'Evento'
                                }</span>
                            </div>
                            <div className="target-name">{report.target_name || `ID: ${report.target_id}`}</div>
                            <div className="target-content-full">
                                <p>{report.description}</p>
                            </div>
                            {report.target_post && (
                                <div className="target-preview">
                                    <h4>Contexto do Post:</h4>
                                    <p>{report.target_post.content?.substring(0, 200)}...</p>
                                    <small>Autor: {report.target_post.author_name}</small>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Usuário Alvo */}
                    {report.target_user && (
                        <section className="detail-card">
                            <div className="card-header">
                                <Flag size={18} />
                                <h2>Usuário Denunciado</h2>
                            </div>
                            <div className="target-user-card">
                                <div className="user-avatar-large">{report.target_user.name?.charAt(0) || '?'}</div>
                                <div className="user-info">
                                    <h3>{report.target_user.name}</h3>
                                    <p>@{report.target_user.name.toLowerCase().replace(/\s+/g, '.')}</p>
                                    <span className="user-role">{report.target_user.role}</span>
                                </div>
                                <div className="target-user-actions">
                                    <button className="btn-secondary">Ver Perfil</button>
                                </div>
                            </div>
                            {report.target_warnings && report.target_warnings.length > 0 && (
                                <div className="target-history">
                                    <h4>Histórico de Advertências ({report.target_warnings.length})</h4>
                                    <ul>
                                        {report.target_warnings.map((w, i) => (
                                            <li key={i}>
                                                <strong>{w.reason}</strong> - {w.admin_name} - {formatDateTime(w.created_at)}
                                                <br />
                                                <small>{w.description}</small>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {report.target_restrictions && report.target_restrictions.length > 0 && (
                                <div className="target-history">
                                    <h4>Restrições Ativas</h4>
                                    <ul>
                                        {report.target_restrictions.map((r, i) => (
                                            <li key={i}>
                                                <strong>Restrição de {r.expires_at ? new Date(r.expires_at).toLocaleDateString('pt-BR') : '?'} dias</strong> - {r.admin_name}
                                                <br />
                                                <small>Funcionalidades: {r.features?.join(', ')}</small>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Evidências */}
                    <section className="detail-card">
                        <div className="card-header">
                            <Eye size={18} />
                            <h2>Descrição da Denúncia</h2>
                        </div>
                        <div className="evidence-content">
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{report.description}</p>
                        </div>
                    </section>
                </div>

                {/* Right Column - Actions & Timeline */}
                <div className="detail-sidebar">
                    {/* Ações Administrativas */}
                    <section className="detail-card actions-panel">
                        <div className="card-header">
                            <Shield size={18} />
                            <h2>Ações Administrativas</h2>
                        </div>
                        <div className="action-buttons">
                            {report.status === 'pending' && (
                                <ActionButton
                                    action="startReview"
                                    label="Iniciar Análise"
                                    icon={AlertTriangle}
                                    colorClass="primary"
                                    actionLoading={actionLoading}
                                    onAction={handleAction}
                                    onOpenModal={openModal}
                                />
                            )}
                            {report.status === 'reviewing' && (
                                <>
                                    <ActionButton
                                        action="resolve"
                                        label="Remover Conteúdo"
                                        icon={Trash2}
                                        colorClass="danger"
                                        actionLoading={actionLoading}
                                        onAction={handleAction}
                                        onOpenModal={openModal}
                                    />
                                    <ActionButton
                                        action="warn"
                                        label="Emitir Advertência"
                                        icon={Flag}
                                        colorClass="warning"
                                        actionLoading={actionLoading}
                                        onAction={handleAction}
                                        onOpenModal={openModal}
                                    />
                                    <ActionButton
                                        action="restrict"
                                        label="Restringir Usuário"
                                        icon={Shield}
                                        colorClass="secondary"
                                        actionLoading={actionLoading}
                                        onAction={handleAction}
                                        onOpenModal={openModal}
                                    />
                                    <ActionButton
                                        action="dismiss"
                                        label="Arquivar (Improcedente)"
                                        icon={Archive}
                                        colorClass="ghost"
                                        actionLoading={actionLoading}
                                        onAction={handleAction}
                                        onOpenModal={openModal}
                                    />
                                </>
                            )}
                        </div>
                    </section>

                    {/* Timeline */}
                    <section className="detail-card timeline-card">
                        <div className="card-header">
                            <Clock size={18} />
                            <h2>Histórico da Denúncia</h2>
                        </div>
                        <div className="timeline">
                            <div className="timeline-item">
                                <div className="timeline-time">{formatDateTime(report.created_at)}</div>
                                <div className="timeline-content">
                                    <div className="timeline-action">Denúncia criada por {report.reporter_name}</div>
                                    <div className="timeline-details">Categoria: {report.reason} • Status: {report.status}</div>
                                </div>
                            </div>
                            {report.assigned_to && report.status !== 'pending' && (
                                <div className="timeline-item">
                                    <div className="timeline-time">{report.assigned_at ? formatDateTime(report.assigned_at) : '-'}</div>
                                    <div className="timeline-content">
                                        <div className="timeline-action">Análise iniciada por {report.assigned_admin_name || 'Admin'}</div>
                                        <div className="timeline-details">Status alterado para "Em Análise"</div>
                                    </div>
                                </div>
                            )}
                            {report.resolved_at && (
                                <div className="timeline-item resolved">
                                    <div className="timeline-time">{formatDateTime(report.resolved_at)}</div>
                                    <div className="timeline-content">
                                        <div className="timeline-action">Denúncia {report.status === 'resolved' ? 'resolvida' : 'arquivada'}</div>
                                        <div className="timeline-details">Ação: {report.action_taken} • {report.admin_notes || 'Sem observações'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Modals */}
            {modalAction && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {modalAction === 'resolve' ? 'Confirmar Remoção de Conteúdo' :
                                    modalAction === 'warn' ? 'Emitir Advertência Formal' :
                                    modalAction === 'restrict' ? 'Restringir Usuário Temporariamente' :
                                    'Arquivar Denúncia (Improcedente)'
                                }
                            </h3>
                            <button className="modal-close" onClick={closeModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>
                                {modalAction === 'resolve' ? 'Esta ação removerá permanentemente o conteúdo denunciado. O conteúdo não poderá be recuperado.' :
                                    modalAction === 'warn' ? 'O usuário denunciado receberá uma advertência formal. Após 3 advertências, a conta poderá ser suspensa automaticamente.' :
                                    modalAction === 'restrict' ? `O usuário terá funcionalidades limitadas por ${restrictionDays} dias. Acesso à leitura será mantido.` :
                                    'A denúncia será arquivada como improcedente. Nenhuma penalidade será aplicada ao usuário denunciado.'
                                }
                            </p>
                            {modalAction === 'restrict' && (
                                <div className="form-group">
                                    <label>Período de Restrição (dias)</label>
                                    <select value={restrictionDays} onChange={e => setRestrictionDays(Number(e.target.value))}>
                                        <option value={1}>1 dia</option>
                                        <option value={3}>3 dias</option>
                                        <option value={7}>7 dias</option>
                                        <option value={14}>14 dias</option>
                                        <option value={30}>30 dias</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Observações Administrativas <span className="required">*</span></label>
                                <textarea
                                    value={modalNotes}
                                    onChange={e => setModalNotes(e.target.value)}
                                    placeholder="Justificativa e detalhes da ação..."
                                    rows={4}
                                    required
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
                            <button
                                className={`btn-primary ${modalAction === 'resolve' ? 'btn-danger' : modalAction === 'warn' ? 'btn-warning' : modalAction === 'restrict' ? '' : 'btn-secondary'}`}
                                onClick={() => handleAction(modalAction)}
                                disabled={actionLoading === modalAction}
                            >
                                {actionLoading === modalAction ? 'Processando...' :
                                    modalAction === 'resolve' ? 'Remover Conteúdo' :
                                    modalAction === 'warn' ? 'Emitir Advertência' :
                                    modalAction === 'restrict' ? 'Aplicar Restrição' :
                                    'Arquivar Denúncia'
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReportDetail;