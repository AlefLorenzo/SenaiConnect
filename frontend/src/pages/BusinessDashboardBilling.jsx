import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';
import { DollarSign, FileText, Clock, AlertCircle, CheckCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import './BusinessDashboardBilling.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const INVOICE_STATUS = {
    pending: { label: 'Pendente', class: 'status-pending', icon: Clock },
    paid: { label: 'Paga', class: 'status-paid', icon: CheckCircle },
    failed: { label: 'Falhou', class: 'status-failed', icon: AlertCircle },
    refunded: { label: 'Estornada', class: 'status-refunded', icon: AlertCircle },
    cancelled: { label: 'Cancelada', class: 'status-cancelled', icon: X }
};

const BusinessDashboardBilling = () => {
    const { socket } = useContext(SocketContext);

    const [invoices, setInvoices] = useState([]);
    const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0, totalRevenue: 0, thisMonth: 0 });
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
    const [showPixModal, setShowPixModal] = useState(null);

    const token = () => sessionStorage.getItem('token');

    const fetchBilling = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit
            });

            const res = await fetch(`${API_URL}/api/business/billing?${params}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });

            if (res.ok) {
                const data = await res.json();
                setInvoices(data.invoices);
                setSummary(data.summary);
                setPagination(prev => ({
                    ...prev,
                    total: data.total,
                    totalPages: data.totalPages
                }));
            }
        } catch (err) {
            console.error('Erro ao buscar faturamento:', err);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit]);

    // Ref to hold latest fetchBilling for socket handlers
    const fetchBillingRef = useRef(null);

    useEffect(() => {
        fetchBillingRef.current = fetchBilling;
    }, [fetchBilling]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    page: pagination.page,
                    limit: pagination.limit
                });

                const res = await fetch(`${API_URL}/api/business/billing?${params}`, {
                    headers: { Authorization: `Bearer ${token()}` }
                });

                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setInvoices(data.invoices);
                    setSummary(data.summary);
                    setPagination(prev => ({
                        ...prev,
                        total: data.total,
                        totalPages: data.totalPages
                    }));
                }
            } catch (err) {
                console.error('Erro ao buscar faturamento:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [pagination.page, pagination.limit]);

    useEffect(() => {
        if (!socket) return;
        const handleUpdate = () => fetchBillingRef.current?.();
        socket.on('invoice_update', handleUpdate);
        socket.on('payment_received', handleUpdate);
        return () => {
            socket.off('invoice_update', handleUpdate);
            socket.off('payment_received', handleUpdate);
        };
    }, [socket]);

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatDateTime = (dateStr) => {
        return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const showPix = (invoice) => {
        if (invoice.pix_qr_code || invoice.pix_code) {
            setShowPixModal(invoice);
        } else {
            alert('PIX não disponível para esta fatura');
        }
    };

    const downloadInvoice = async (invoiceId) => {
        try {
            const res = await fetch(`${API_URL}/api/business/billing/${invoiceId}/download`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fatura-${invoiceId}.pdf`;
                a.click();
            }
        } catch (err) {
            console.error('Erro ao baixar fatura:', err);
        }
    };

    if (loading) return <div className="loading-state">Carregando faturamento...</div>;

    return (
        <div className="business-dashboard-billing">
            <div className="page-header">
                <div>
                    <h1>Faturamento e Pagamentos</h1>
                    <p>Gerencie suas faturas, pagamentos e receitas</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid">
                <div className="summary-card paid">
                    <div className="summary-icon"><DollarSign size={24} /></div>
                    <div className="summary-content">
                        <div className="summary-value">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalPaid || 0)}</div>
                        <div className="summary-label">Total Pago</div>
                    </div>
                </div>
                <div className="summary-card pending">
                    <div className="summary-icon"><Clock size={24} /></div>
                    <div className="summary-content">
                        <div className="summary-value">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalPending || 0)}</div>
                        <div className="summary-label">Pendente</div>
                    </div>
                </div>
                <div className="summary-card revenue">
                    <div className="summary-icon"><DollarSign size={24} /></div>
                    <div className="summary-content">
                        <div className="summary-value">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalRevenue || 0)}</div>
                        <div className="summary-label">Receita Total</div>
                    </div>
                </div>
                <div className="summary-card month">
                    <div className="summary-icon"><FileText size={24} /></div>
                    <div className="summary-content">
                        <div className="summary-value">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.thisMonth || 0)}</div>
                        <div className="summary-label">Este Mês</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>Faturas</h2>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Número</th>
                                <th>Campanha</th>
                                <th>Período</th>
                                <th>Vencimento</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Pagamento</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length > 0 ? invoices.map(invoice => {
                                const statusConfig = INVOICE_STATUS[invoice.status] || INVOICE_STATUS.pending;
                                return (
                                    <tr key={invoice.id}>
                                        <td>
                                            <strong>{invoice.invoice_number}</strong>
                                        </td>
                                        <td>{invoice.campaign_name || 'Fatura avulsa'}</td>
                                        <td>
                                            {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                                        </td>
                                        <td>{formatDate(invoice.due_date)}</td>
                                        <td>
                                            <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}</strong>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${statusConfig.class}`}>
                                                <statusConfig.icon size={12} /> {statusConfig.label}
                                            </span>
                                        </td>
                                        <td>
                                            {invoice.payment_method ? (
                                                <span className="payment-method">{invoice.payment_method}</span>
                                            ) : (
                                                <span className="no-payment">Não pago</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="actions">
                                                {invoice.pix_qr_code && (
                                                    <button className="action-btn" onClick={() => showPix(invoice)} title="Ver PIX">
                                                        <FileText size={16} />
                                                    </button>
                                                )}
                                                <button className="action-btn" onClick={() => downloadInvoice(invoice.id)} title="Baixar PDF">
                                                    <FileText size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="empty-row">Nenhuma fatura encontrada</td>
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
                            Página {pagination.page} de {pagination.totalPages} ({pagination.total} faturas)
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

            {/* PIX Modal */}
            {showPixModal && (
                <div className="modal-overlay" onClick={() => setShowPixModal(null)}>
                    <div className="modal large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Pagamento via PIX</h3>
                            <button className="modal-close" onClick={() => setShowPixModal(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="pix-info">
                                <h4>Fatura: {showPixModal.invoice_number}</h4>
                                <p>Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(showPixModal.amount)}</p>
                                <p>Vencimento: {formatDate(showPixModal.due_date)}</p>
                            </div>
                            {showPixModal.pix_qr_code && (
                                <div className="pix-qrcode">
                                    <img src={`data:image/png;base64,${showPixModal.pix_qr_code}`} alt="QR Code PIX" />
                                </div>
                            )}
                            {showPixModal.pix_code && (
                                <div className="pix-code">
                                    <label>Código PIX (Copie e Cole)</label>
                                    <div className="code-container">
                                        <input type="text" value={showPixModal.pix_code} readOnly />
                                        <button className="copy-btn" onClick={() => {
                                            navigator.clipboard.writeText(showPixModal.pix_code);
                                            alert('Código copiado!');
                                        }}>Copiar</button>
                                    </div>
                                </div>
                            )}
                            <p className="pix-warning">⚠️ O código PIX expira em {showPixModal.pix_expires_at ? formatDateTime(showPixModal.pix_expires_at) : '24h'}. Pagamentos após o vencimento podem gerar juros.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowPixModal(null)}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessDashboardBilling;