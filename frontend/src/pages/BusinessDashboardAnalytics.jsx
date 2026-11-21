import { useState, useEffect, useContext, useCallback } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';
import { Loader2, TrendingUp, Users, Eye, Zap, DollarSign } from 'lucide-react';
import { Chart as ChartJS, ArcElement, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import './BusinessDashboardAnalytics.css';

ChartJS.register(ArcElement, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const BusinessDashboardAnalytics = () => {
    const { socket } = useContext(SocketContext);

    const [overview, setOverview] = useState({
        impressions: 0,
        clicks: 0,
        ctr: 0,
        spent: 0,
        followers: 0,
        posts: 0,
        stories: 0
    });
    const [impressionsData, setImpressionsData] = useState({ labels: [], datasets: [] });
    const [ctrData, setCtrData] = useState({ labels: [], datasets: [] });
    const [spentData, setSpentData] = useState({ labels: [], datasets: [] });
    const [topPosts, setTopPosts] = useState([]);
    const [topCampaigns, setTopCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('30d');

    const token = () => sessionStorage.getItem('token');

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/business/analytics?period=${period}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOverview(data.overview);
                setImpressionsData(data.impressionsChart);
                setCtrData(data.ctrChart);
                setSpentData(data.spentChart);
                setTopPosts(data.topPosts || []);
                setTopCampaigns(data.topCampaigns || []);
            }
        } catch (err) {
            console.error('Erro ao buscar analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAnalytics();
    }, [fetchAnalytics]);

    useEffect(() => {
        if (!socket) return;
        socket.on('analytics_update', fetchAnalytics);
        return () => socket.off('analytics_update', fetchAnalytics);
    }, [socket, fetchAnalytics]);

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString('pt-BR');
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const kpiCards = [
        { label: 'Impressões', value: formatNumber(overview.impressions), icon: Eye, color: '#3B82F6', trend: '+12%' },
        { label: 'Cliques', value: formatNumber(overview.clicks), icon: Zap, color: '#F59E0B', trend: '+8%' },
        { label: 'CTR', value: `${overview.ctr}%`, icon: TrendingUp, color: '#8B5CF6', trend: '+0.2%' },
        { label: 'Investido', value: formatCurrency(overview.spent), icon: DollarSign, color: '#059669', trend: '+5%' },
        { label: 'Seguidores', value: formatNumber(overview.followers), icon: Users, color: '#EC4899', trend: '+23' },
        { label: 'Publicações', value: formatNumber(overview.posts), icon: TrendingUp, color: '#14B8A6', trend: '+5' }
    ];

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12,
                cornerRadius: 8
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
            y: { grid: { color: '#E2E8F0' }, ticks: { color: '#94A3B8' } }
        }
    };

    const doughnutChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#64748B', padding: 16, usePointStyle: true } },
            tooltip: { backgroundColor: '#1E293B', padding: 12, cornerRadius: 8 }
        }
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1E293B', padding: 12, cornerRadius: 8 } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
            y: { grid: { color: '#E2E8F0' }, ticks: { color: '#94A3B8' } }
        }
    };

    if (loading) return <div className="analytics-loading"><Loader2 size={40} className="spin" /><p>Carregando analytics...</p></div>;

    return (
        <div className="business-dashboard-analytics">
            <div className="page-header">
                <div>
                    <h1>Analytics</h1>
                    <p>Acompanhe o desempenho da sua empresa e campanhas</p>
                </div>
                <div className="period-selector">
                    <select value={period} onChange={e => setPeriod(e.target.value)}>
                        <option value="7d">Últimos 7 dias</option>
                        <option value="30d">Últimos 30 dias</option>
                        <option value="90d">Últimos 90 dias</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {kpiCards.map((kpi, i) => (
                    <div key={i} className="kpi-card">
                        <div className="kpi-icon" style={{ background: `${kpi.color}15` }}>
                            <kpi.icon size={24} style={{ color: kpi.color }} />
                        </div>
                        <div className="kpi-content">
                            <div className="kpi-value">{kpi.value}</div>
                            <div className="kpi-label">{kpi.label}</div>
                            <div className="kpi-trend positive">{kpi.trend}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div className="charts-row">
                <div className="chart-card">
                    <div className="chart-header">
                        <h3>Impressões ao longo do tempo</h3>
                        <p className="chart-subtitle">Visualizações de posts, stories e anúncios</p>
                    </div>
                    <div className="chart-container">
                        {impressionsData.labels?.length > 0 ? (
                            <Line data={impressionsData} options={lineChartOptions} />
                        ) : (
                            <div className="chart-empty">Sem dados de impressões no período</div>
                        )}
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-header">
                        <h3>CTR (Taxa de Clique)</h3>
                        <p className="chart-subtitle">Performance de cliques por impressão</p>
                    </div>
                    <div className="chart-container">
                        {ctrData.labels?.length > 0 ? (
                            <Line data={ctrData} options={lineChartOptions} />
                        ) : (
                            <div className="chart-empty">Sem dados de CTR no período</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="charts-row">
                <div className="chart-card">
                    <div className="chart-header">
                        <h3>Investimento por dia</h3>
                        <p className="chart-subtitle">Gasto diário em campanhas ativas</p>
                    </div>
                    <div className="chart-container">
                        {spentData.labels?.length > 0 ? (
                            <Bar data={spentData} options={barChartOptions} />
                        ) : (
                            <div className="chart-empty">Sem dados de investimento no período</div>
                        )}
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-header">
                        <h3>Distribuição de Impressões</h3>
                        <p className="chart-subtitle">Por tipo de conteúdo</p>
                    </div>
                    <div className="chart-container">
                        <Doughnut
                            data={{
                                labels: ['Posts', 'Stories', 'Anúncios'],
                                datasets: [{
                                    data: [overview.posts * 100 || 1, overview.stories * 50 || 1, overview.clicks * 10 || 1],
                                    backgroundColor: ['#3B82F6', '#8B5CF6', '#F59E0B'],
                                    borderWidth: 0
                                }]
                            }}
                            options={doughnutChartOptions}
                        />
                    </div>
                </div>
            </div>

            {/* Top Content */}
            <div className="charts-row">
                <div className="chart-card full-width">
                    <div className="chart-header">
                        <h3>Top Publicações</h3>
                        <p className="chart-subtitle">Posts com melhor engajamento no período</p>
                    </div>
                    <div className="top-content-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Publicação</th>
                                    <th>Tipo</th>
                                    <th>Visualizações</th>
                                    <th>Curtidas</th>
                                    <th>Comentários</th>
                                    <th>CTR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topPosts.length > 0 ? topPosts.map((post, i) => (
                                    <tr key={post.id}>
                                        <td>
                                            <span className="rank">#{i + 1}</span>
                                            <strong>{post.content?.substring(0, 50) || 'Sem título'}</strong>
                                        </td>
                                        <td><span className="post-type-badge">{post.post_type}</span></td>
                                        <td>{post.views_count?.toLocaleString() || 0}</td>
                                        <td>{post.likes_count?.toLocaleString() || 0}</td>
                                        <td>{post.comments_count?.toLocaleString() || 0}</td>
                                        <td>{post.ctr?.toFixed(2)}%</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="empty-row">Nenhuma publicação no período</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Top Campaigns */}
            <div className="charts-row">
                <div className="chart-card full-width">
                    <div className="chart-header">
                        <h3>Top Campanhas</h3>
                        <p className="chart-subtitle">Campanhas com melhor ROI</p>
                    </div>
                    <div className="top-content-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Campanha</th>
                                    <th>Modelo</th>
                                    <th>Impressões</th>
                                    <th>Cliques</th>
                                    <th>CTR</th>
                                    <th>Investido</th>
                                    <th>ROI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topCampaigns.length > 0 ? topCampaigns.map((campaign, i) => (
                                    <tr key={campaign.id}>
                                        <td>
                                            <span className="rank">#{i + 1}</span>
                                            <strong>{campaign.name}</strong>
                                        </td>
                                        <td><span className="billing-badge">{campaign.billing_model}</span></td>
                                        <td>{campaign.impressions?.toLocaleString() || 0}</td>
                                        <td>{campaign.clicks?.toLocaleString() || 0}</td>
                                        <td>{campaign.ctr?.toFixed(2)}%</td>
                                        <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(campaign.spent || 0)}</td>
                                        <td className="roi-positive">+{((campaign.clicks * 10) / (campaign.spent || 1) * 100).toFixed(0)}%</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={7} className="empty-row">Nenhuma campanha ativa no período</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessDashboardAnalytics;