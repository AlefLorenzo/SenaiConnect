import { useState, useEffect, useContext, useCallback, Fragment } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { LayoutDashboard, Building2, FileText, Target, BarChart2, DollarSign, Settings, Plus, Users, Bell, LogOut, Shield, Zap, CheckCircle, AlertCircle, Loader2, Menu, X as XIcon, MessageSquare, Image } from 'lucide-react';
import './BusinessDashboard.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const navItems = [
    { path: '/business/dashboard', icon: LayoutDashboard, label: 'Visão Geral', section: 'painel' },
    { path: '/business/dashboard/posts', icon: FileText, label: 'Publicações', section: 'conteudo', badge: null },
    { path: '/business/dashboard/stories', icon: Image, label: 'Stories', section: 'conteudo', badge: null },
    { path: '/business/dashboard/campaigns', icon: Target, label: 'Campanhas', section: 'ads', badge: null },
    { path: '/business/dashboard/analytics', icon: BarChart2, label: 'Analytics', section: 'ads' },
    { path: '/business/dashboard/billing', icon: DollarSign, label: 'Faturamento', section: 'ads' },
    { path: '/business/dashboard/settings', icon: Settings, label: 'Configurações', section: 'config' },
];

const getSectionTitle = (section) => {
    const titles = { painel: 'PAINEL', conteudo: 'CONTEÚDO', ads: 'PUBLICIDADE', config: 'CONFIGURAÇÕES' };
    return titles[section] || section.toUpperCase();
};

const BusinessDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useContext(AuthContext);
    const { socket } = useContext(SocketContext);

    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const token = () => sessionStorage.getItem('token');

    const fetchBusinessData = useCallback(async () => {
        try {
            // Get business
            const bizRes = await fetch(`${API_URL}/api/business/my-business`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (bizRes.ok) {
                const data = await bizRes.json();
                setBusiness(data);
            }

            // Get notifications
            const notifRes = await fetch(`${API_URL}/api/business/notifications?unreadOnly=true&limit=5`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (notifRes.ok) {
                const data = await notifRes.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }

        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchBusinessData();

        // Real-time updates
        if (socket) {
            socket.on('campaign_status_changed', () => fetchBusinessData());
            socket.on('business_post_created', () => fetchBusinessData());
            socket.on('business_story_created', () => fetchBusinessData());
            socket.on('new_business_notification', (data) => {
                setNotifications(prev => [data, ...prev.slice(0, 4)]);
                setUnreadCount(prev => prev + 1);
            });
            socket.on('business_post_liked', () => fetchBusinessData());
            socket.on('business_post_commented', () => fetchBusinessData());
        }

        return () => {
            if (socket) {
                socket.off('campaign_status_changed');
                socket.off('business_post_created');
                socket.off('business_story_created');
                socket.off('new_business_notification');
                socket.off('business_post_liked');
                socket.off('business_post_commented');
            }
        };
    }, [socket, fetchBusinessData]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleNotifications = () => {
        setShowNotifications(!showNotifications);
        if (showNotifications) return;
        // Mark as read when opening
        fetch(`${API_URL}/api/business/notifications/read-all`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` }
        }).then(() => {
            setUnreadCount(0);
        });
    };

    if (loading) {
        return (
            <div className="business-dashboard-loading">
                <Loader2 size={40} className="spin" />
                <p>Carregando painel da empresa...</p>
            </div>
        );
    }

    if (!business) {
        return (
            <div className="business-dashboard-no-business">
                <Building2 size={64} />
                <h2>Nenhuma empresa vinculada</h2>
                <p>Você precisa ter uma empresa aprovada para acessar o painel.</p>
                <Link to="/business/dashboard/setup" className="btn-primary">
                    <Plus size={18} /> Cadastrar Empresa
                </Link>
            </div>
        );
    }

    return (
        <div className="business-dashboard">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`business-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <Link to="/business/dashboard" className="sidebar-brand">
                        <Shield size={28} color="white" />
                        <span>SENAI CONNECT</span>
                        <span className="brand-sub">Painel da Empresa</span>
                    </Link>
                    <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                        <XIcon size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {['painel', 'conteudo', 'ads', 'config'].map(section => (
                        <Fragment key={section}>
                            <p className="nav-section-title">{getSectionTitle(section)}</p>
                            {navItems.filter(item => item.section === section).map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon size={20} />
                                    {item.label}
                                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                                </Link>
                            ))}
                        </Fragment>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="business-info">
                        <img
                            src={business.logo_url ? `${API_URL}/uploads/logos/${business.logo_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(business.company_name)}&background=0D8ABC&color=fff&size=40`}
                            alt={business.company_name}
                            className="business-avatar"
                        />
                        <div>
                            <span className="business-name">{business.company_name}</span>
                            <span className="business-status approved">Verificada</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} /> Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="business-main">
                {/* Topbar */}
                <header className="business-topbar">
                    <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                        <Menu size={24} />
                    </button>

                    <div className="topbar-center">
                        <h1 className="page-title">{location.pathname === '/business/dashboard' ? 'Dashboard' : 'Painel da Empresa'}</h1>
                    </div>

                    <div className="topbar-right">
                        <div className="notification-wrapper" onClick={toggleNotifications}>
                            <Bell size={24} />
                            {unreadCount > 0 && (
                                <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </div>

                        {showNotifications && (
                            <div className="notification-dropdown">
                                <div className="notification-dropdown-header">
                                    <h3>Notificações</h3>
                                    {unreadCount > 0 && (
                                        <button className="mark-all-read" onClick={(e) => {
                                            e.stopPropagation();
                                            fetch(`${API_URL}/api/business/notifications/read-all`, {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${token()}` }
                                            }).then(() => {
                                                setUnreadCount(0);
                                            });
                                        }}>
                                            Marcar todas como lidas
                                        </button>
                                    )}
                                </div>
                                <div className="notification-list">
                                    {notifications.length > 0 ? (
                                        notifications.map(n => (
                                            <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`}>
                                                <div className="notification-icon">
                                                    {n.type === 'campaign_approved' && <CheckCircle size={20} color="#059669" />}
                                                    {n.type === 'campaign_rejected' && <AlertCircle size={20} color="#DC2626" />}
                                                    {n.type === 'new_follower' && <Users size={20} color="#3B82F6" />}
                                                    {n.type === 'like' && <Zap size={20} color="#F59E0B" />}
                                                    {n.type === 'comment' && <MessageSquare size={20} color="#8B5CF6" />}
                                                </div>
                                                <div className="notification-content">
                                                    <p>{n.content}</p>
                                                    <span className="notification-time">{new Date(n.created_at).toLocaleString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="notification-empty">
                                            <span>🔔</span>
                                            <p>Nenhuma notificação</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="user-menu">
                            <img
                                src={business.logo_url ? `${API_URL}/uploads/logos/${business.logo_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(business.company_name)}&background=0D8ABC&color=fff&size=40`}
                                alt={business.company_name}
                                className="user-avatar"
                            />
                            <div className="user-info">
                                <span className="user-name">{business.company_name}</span>
                                <span className="user-role">Administrador da Empresa</span>
                            </div>
                            <button className="logout-btn" onClick={handleLogout}>
                                <LogOut size={18} /> Sair
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="business-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default BusinessDashboard;