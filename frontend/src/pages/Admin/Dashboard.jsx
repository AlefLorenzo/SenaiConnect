import { useEffect, useState, useCallback } from 'react';
import {
    Users, Bell, Flag, CheckCircle, TrendingUp,
    UserPlus, Activity, AlertTriangle, Calendar, Settings, BookOpen, Shield
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

import Card from '../../components/ui/Card/Card';
import Alert from '../../components/ui/Alert/Alert';
import Link from '../../components/ui/Link/Link';

import { API_URL, getAuthHeader } from '../../config/api';
import './Dashboard.css';

ChartJS.register(ArcElement, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler);

const StatCard = ({ title, value, change, changeLabel, icon: Icon, color, bgColor, link, loading }) => (
    <Card className="stat-card" padding="lg" elevation="md" hoverable>
        <Link to={link} className="stat-link">
            <div className="stat-icon" style={{ background: bgColor, color: color }}>
                <Icon size={24} />
            </div>
            <div className="stat-content">
                <div className="stat-value">{loading ? '—' : value}</div>
                <div className="stat-label">{title}</div>
                {change !== undefined && !loading && (
                    <div className={`stat-trend ${change >= 0 ? 'positive' : 'negative'}`}>
                        <TrendingUp size={12} />
                        <span>{change >= 0 ? '+' : ''}{change}%</span>
                        <span className="trend-label">{changeLabel}</span>
                    </div>
                )}
            </div>
        </Link>
    </Card>
);

const ChartCard = ({ title, children, subtitle, loading }) => (
    <Card className="chart-card" padding="lg" elevation="md">
        <div className="chart-header">
            <div>
                <h3 className="chart-title">{title}</h3>
                {subtitle && <p className="chart-subtitle">{subtitle}</p>}
            </div>
        </div>
        <div className="chart-container">
            {loading ? (
                <div className="chart-loading">
                    <div className="loading-spinner" />
                    <span>Carregando...</span>
                </div>
            ) : (
                children
            )}
        </div>
    </Card>
);

const ActivityItem = ({ icon: Icon, iconColor, iconBg, title, description, time }) => (
    <div className="activity-item">
        <div className="activity-icon" style={{ background: iconBg, color: iconColor }}>
            <Icon size={16} />
        </div>
        <div className="activity-content">
            <div className="activity-title">{title}</div>
            <div className="activity-description">{description}</div>
        </div>
        <div className="activity-time">{time}</div>
    </div>
);

// Helper para converter códigos de ação em descrições amigáveis
const getActionDescription = (action, targetType, targetName, description) => {
    const actionMap = {
        'NOTICE_CREATED': { label: 'Aviso criado', desc: 'Novo aviso publicado' },
        'NOTICE_UPDATED': { label: 'Aviso atualizado', desc: 'Aviso editado' },
        'NOTICE_DELETED': { label: 'Aviso removido', desc: 'Aviso excluído' },
        'NOTICE_PUBLISHED': { label: 'Aviso publicado', desc: 'Aviso publicado para os usuários' },
        'NOTICE_UNPUBLISHED': { label: 'Aviso despublicado', desc: 'Aviso removido da visualização pública' },
        'NOTICE_PINNED': { label: 'Aviso fixado', desc: 'Aviso fixado no topo' },
        'NOTICE_UNPINNED': { label: 'Aviso desfixado', desc: 'Aviso removido do topo' },
        'REPORT_RESOLVED': { label: 'Denúncia resolvida', desc: 'Denúncia analisada e resolvida' },
        'REPORT_DISMISSED': { label: 'Denúncia arquivada', desc: 'Denúncia considerada improcedente' },
        'REPORT_REVIEW_STARTED': { label: 'Análise iniciada', desc: 'Denúncia em análise' },
        'USER_BLOCKED': { label: 'Usuário bloqueado', desc: 'Usuário bloqueado pela moderação' },
        'USER_UNBLOCKED': { label: 'Usuário desbloqueado', desc: 'Usuário teve acesso restaurado' },
        'USER_WARNED': { label: 'Advertência emitida', desc: 'Usuário advertido pela moderação' },
        'USER_RESTRICTED': { label: 'Usuário restrito', desc: 'Restrições aplicadas ao usuário' },
        'EVENT_CREATED': { label: 'Evento criado', desc: 'Novo evento agendado' },
        'EVENT_UPDATED': { label: 'Evento atualizado', desc: 'Evento editado' },
        'EVENT_DELETED': { label: 'Evento removido', desc: 'Evento cancelado' },
        'COURSE_CREATED': { label: 'Curso criado', desc: 'Novo curso disponível' },
        'COURSE_UPDATED': { label: 'Curso atualizado', desc: 'Informações do curso atualizadas' },
        'COURSE_DELETED': { label: 'Curso removido', desc: 'Curso excluído do sistema' },
        'ADMIN_LOGIN': { label: 'Login administrativo', desc: 'Acesso ao painel administrativo' },
        'ADMIN_LOGIN_FAILED': { label: 'Tentativa de login falhou', desc: 'Tentativa de acesso não autorizado' },
        'ADMIN_LOGIN_SUCCESS': { label: 'Login bem-sucedido', desc: 'Acesso autorizado ao painel' },
        'SETTINGS_UPDATED': { label: 'Configurações alteradas', desc: 'Configurações do sistema alteradas' },
        'NOTICE_READ': { label: 'Aviso lido', desc: 'Aviso marcado como lido' },
        'REPORT_CREATED': { label: 'Denúncia recebida', desc: 'Nova denúncia registrada' },
        'USER_CREATED': { label: 'Usuário cadastrado', desc: 'Novo usuário registrado' },
    };

    const actionInfo = actionMap[action] || { label: action, desc: description || `Ação ${action}` };

    // Se tiver targetName, usa ele na descrição
    let desc = actionInfo.desc;
    if (targetName && targetName !== `-`) {
        desc = `${actionInfo.desc} - ${targetName}`;
    } else if (description && description !== `-`) {
        desc = description;
    }

    return {
        label: actionInfo.label,
        description: desc
    };
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeUsers: 0,
        totalNotices: 0,
        pendingReports: 0,
        resolvedReports: 0,
        reviewingReports: 0
    });
    const [charts, setCharts] = useState({ userGrowth: [], reportsByCategory: [], postsPerDay: [], usersByRole: [], noticesByPriority: [] });
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);

        const requestJson = async (endpoint) => {
            const response = await fetch(`${API_URL}${endpoint}`, {
                headers: getAuthHeader(),
                credentials: 'include'
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload.error ||
                    payload.message ||
                    `Não foi possível carregar ${endpoint} (HTTP ${response.status}).`
                );
            }

            return payload;
        };

        // Cada bloco é independente: uma falha nos gráficos ou na auditoria
        // não pode derrubar os indicadores principais nem a página inteira.
        const [statsResult, chartsResult, activityResult] = await Promise.allSettled([
            requestJson('/api/admin/dashboard'),
            requestJson('/api/admin/dashboard/charts'),
            requestJson('/api/admin/dashboard/activity')
        ]);

        if (statsResult.status === 'fulfilled' && statsResult.value?.stats) {
            const received = statsResult.value.stats;
            setStats({
                totalStudents: Number(received.totalStudents) || 0,
                activeUsers: Number(received.activeUsers) || 0,
                totalNotices: Number(received.totalNotices) || 0,
                pendingReports: Number(received.pendingReports) || 0,
                resolvedReports: Number(received.resolvedReports) || 0,
                reviewingReports: Number(received.reviewingReports) || 0
            });
        } else {
            const reason = statsResult.status === 'rejected'
                ? statsResult.reason
                : new Error('O servidor retornou um formato inválido para as estatísticas.');
            console.error('Erro ao carregar estatísticas do dashboard:', reason);
            setStats({
                totalStudents: 0,
                activeUsers: 0,
                totalNotices: 0,
                pendingReports: 0,
                resolvedReports: 0,
                reviewingReports: 0
            });
            setError(reason.message || 'Não foi possível carregar as estatísticas do dashboard.');
        }

        if (chartsResult.status === 'fulfilled') {
            const received = chartsResult.value?.charts || {};
            setCharts({
                userGrowth: Array.isArray(received.userGrowth) ? received.userGrowth : [],
                reportsByCategory: Array.isArray(received.reportsByCategory) ? received.reportsByCategory : [],
                postsPerDay: Array.isArray(received.postsPerDay) ? received.postsPerDay : [],
                usersByRole: Array.isArray(received.usersByRole) ? received.usersByRole : [],
                noticesByPriority: Array.isArray(received.noticesByPriority) ? received.noticesByPriority : []
            });
        } else {
            console.warn('Não foi possível carregar os gráficos do dashboard:', chartsResult.reason);
            setCharts({ userGrowth: [], reportsByCategory: [], postsPerDay: [], usersByRole: [], noticesByPriority: [] });
        }

        if (activityResult.status === 'fulfilled') {
            const received = activityResult.value?.activity;
            setActivity(Array.isArray(received) ? received : []);
        } else {
            console.warn('Não foi possível carregar as atividades do dashboard:', activityResult.reason);
            setActivity([]);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Chart data preparation
    const userGrowthData = {
        labels: charts.userGrowth?.map(d => new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })) || [],
        datasets: [
            {
                label: 'Novos Cadastros',
                data: charts.userGrowth?.map(d => d.new_users) || [],
                borderColor: 'var(--color-primary)',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ]
    };

    const reportsCategoryData = {
        labels: charts.reportsByCategory?.map(d => d.category) || [],
        datasets: [{
            data: charts.reportsByCategory?.map(d => d.count) || [],
            backgroundColor: ['var(--color-error)', 'var(--color-senai-orange)', 'var(--color-primary)', 'var(--color-warning)', 'var(--color-red-500)', 'var(--color-gray-400)'],
            borderWidth: 0,
            hoverOffset: 8
        }]
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, padding: 20, font: { size: 11 } } },
            tooltip: { backgroundColor: 'var(--color-gray-900)', padding: 12, cornerRadius: 8 }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10, family: 'var(--font-family-base)' } } },
            y: { grid: { color: 'var(--color-border)' }, ticks: { font: { size: 10, family: 'var(--font-family-base)' }, stepSize: 10 } }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 10, family: 'var(--font-family-base)' } } },
            tooltip: { backgroundColor: 'var(--color-gray-900)', padding: 12, cornerRadius: 8 }
        }
    };

    const renderChartLine = (data) => (
        <Line
            data={data}
            options={{
                ...lineChartOptions,
                plugins: {
                    ...lineChartOptions.plugins,
                    legend: { display: false }
                }
            }}
        />
    );

    const renderChartDoughnut = (data) => (
        <Doughnut data={data} options={doughnutOptions} />
    );

    if (loading) {
        return (
            <div className="admin-dashboard">
                <div className="dashboard-loading">
                    <div className="loading-spinner" />
                    <p>Carregando dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            {error && (
                <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatCard
                    title="Total de Alunos"
                    value={stats.totalStudents.toLocaleString("pt-BR")}
                    icon={Users}
                    color="var(--color-primary)"
                    bgColor="var(--color-primary-light)"
                    link="/admin/users"
                    loading={loading}
                />
                <StatCard
                    title="Usuários Ativos (7d)"
                    value={stats.activeUsers.toLocaleString("pt-BR")}
                    icon={UserPlus}
                    color="var(--color-success)"
                    bgColor="var(--color-success-light)"
                    link="/admin/users"
                    loading={loading}
                />
                <StatCard
                    title="Avisos Publicados"
                    value={stats.totalNotices}
                    icon={Bell}
                    color="var(--color-primary)"
                    bgColor="var(--color-primary-light)"
                    link="/admin/notices"
                    loading={loading}
                />
                <StatCard
                    title="Denúncias Pendentes"
                    value={stats.pendingReports}
                    icon={Flag}
                    color="var(--color-error)"
                    bgColor="var(--color-error-light)"
                    link="/admin/reports"
                    loading={loading}
                />
            </div>

            {/* Charts Grid */}
            <div className="charts-grid">
                <ChartCard title="Crescimento de Usuários" subtitle="Últimos 30 dias" loading={loading}>
                    {charts.userGrowth?.length > 0 ? (
                        renderChartLine(userGrowthData)
                    ) : (
                        <div className="chart-empty">
                            <div className="chart-empty-icon">📈</div>
                            <div className="chart-empty-title">Sem dados de crescimento</div>
                            <div className="chart-empty-desc">Não há dados de novos usuários nos últimos 30 dias.</div>
                        </div>
                    )}
                </ChartCard>
                <ChartCard title="Denúncias por Categoria" subtitle="Distribuição atual" loading={loading}>
                    {charts.reportsByCategory?.length > 0 ? (
                        renderChartDoughnut(reportsCategoryData)
                    ) : (
                        <div className="chart-empty">
                            <div className="chart-empty-icon">📊</div>
                            <div className="chart-empty-title">Sem denúncias registradas</div>
                            <div className="chart-empty-desc">Nenhuma denúncia foi registrada até o momento.</div>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* Secondary Charts */}
            <div className="charts-grid">
                <ChartCard title="Posts por Dia" subtitle="Últimos 30 dias" loading={loading}>
                    {charts.postsPerDay?.length > 0 ? (
                        renderChartLine({
                            labels: charts.postsPerDay?.map(d => new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })) || [],
                            datasets: [{
                                label: 'Posts',
                                data: charts.postsPerDay?.map(d => d.posts) || [],
                                borderColor: 'var(--color-success)',
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                fill: true,
                                tension: 0.4
                            }]
                        })
                    ) : (
                        <div className="chart-empty">
                            <div className="chart-empty-icon">📝</div>
                            <div className="chart-empty-title">Sem posts recentes</div>
                            <div className="chart-empty-desc">Nenhum post foi publicado nos últimos 30 dias.</div>
                        </div>
                    )}
                </ChartCard>
                <ChartCard title="Usuários por Perfil" subtitle="Distribuição" loading={loading}>
                    {charts.usersByRole?.length > 0 ? (
                        renderChartDoughnut({
                            labels: charts.usersByRole?.map(d => d.role) || [],
                            datasets: [{
                                data: charts.usersByRole?.map(d => d.count) || [],
                                backgroundColor: ['var(--color-primary)', 'var(--color-purple-500)', 'var(--color-senai-orange)'],
                                borderWidth: 0
                            }]
                        })
                    ) : (
                        <div className="chart-empty">
                            <div className="chart-empty-icon">👥</div>
                            <div className="chart-empty-title">Sem usuários cadastrados</div>
                            <div className="chart-empty-desc">Nenhum usuário encontrado no sistema.</div>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* Activity Feed */}
            <Card className="activity-section" padding="lg" elevation="md">
                <div className="section-header">
                    <h3>Atividades Recentes</h3>
                    <Link to="/admin/audit" variant="inline" icon="arrow-right">
                        Ver todas
                    </Link>
                </div>
                <div className="activity-list">
                    {activity.map((act, i) => {
                        const icons = {
                            NOTICE_CREATED: { Icon: Bell, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                            NOTICE_UPDATED: { Icon: Bell, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                            NOTICE_DELETED: { Icon: Bell, color: 'var(--color-error)', bg: 'var(--color-error-light)' },
                            NOTICE_PUBLISHED: { Icon: Bell, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
                            NOTICE_UNPUBLISHED: { Icon: Bell, color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)' },
                            NOTICE_PINNED: { Icon: Bell, color: 'var(--color-senai-orange)', bg: 'var(--color-senai-orange-light)' },
                            NOTICE_UNPINNED: { Icon: Bell, color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)' },
                            REPORT_RESOLVED: { Icon: CheckCircle, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
                            REPORT_DISMISSED: { Icon: Flag, color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)' },
                            REPORT_REVIEW_STARTED: { Icon: Flag, color: 'var(--color-senai-orange)', bg: 'var(--color-senai-orange-light)' },
                            USER_BLOCKED: { Icon: AlertTriangle, color: 'var(--color-error)', bg: 'var(--color-error-light)' },
                            USER_UNBLOCKED: { Icon: UserPlus, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
                            USER_WARNED: { Icon: AlertTriangle, color: 'var(--color-senai-orange)', bg: 'var(--color-senai-orange-light)' },
                            EVENT_CREATED: { Icon: Calendar, color: 'var(--color-senai-orange)', bg: 'var(--color-senai-orange-light)' },
                            EVENT_UPDATED: { Icon: Calendar, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                            EVENT_DELETED: { Icon: Calendar, color: 'var(--color-error)', bg: 'var(--color-error-light)' },
                            COURSE_CREATED: { Icon: BookOpen, color: 'var(--color-purple-500)', bg: 'var(--color-purple-100)' },
                            COURSE_UPDATED: { Icon: BookOpen, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                            COURSE_DELETED: { Icon: BookOpen, color: 'var(--color-error)', bg: 'var(--color-error-light)' },
                            ADMIN_LOGIN: { Icon: Shield, color: 'var(--color-purple-500)', bg: 'var(--color-purple-100)' },
                            ADMIN_LOGIN_FAILED: { Icon: AlertTriangle, color: 'var(--color-error)', bg: 'var(--color-error-light)' },
                            ADMIN_LOGIN_SUCCESS: { Icon: CheckCircle, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
                            SETTINGS_UPDATED: { Icon: Settings, color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)' },
                            REPORT_CREATED: { Icon: Flag, color: 'var(--color-senai-orange)', bg: 'var(--color-senai-orange-light)' },
                            USER_CREATED: { Icon: UserPlus, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
                        };
                        const iconConfig = icons[act.action] || { Icon: Activity, color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)' };
                        const { label, description: desc } = getActionDescription(act.action, null, null, act.description);
                        return (
                            <ActivityItem
                                key={i}
                                icon={iconConfig.Icon}
                                iconColor={iconConfig.color}
                                iconBg={iconConfig.bg}
                                title={act.action_label || label}
                                description={desc}
                                time={new Date(act.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            />
                        );
                    })}
                    {activity.length === 0 && (
                        <div className="empty-activity">Nenhuma atividade recente</div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default Dashboard;