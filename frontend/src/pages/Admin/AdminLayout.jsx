import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import {
    LayoutDashboard,
    Users,
    BookOpen,
    Calendar,
    Bell,
    Settings,
    LogOut,
    ShieldAlert,
    Flag,
    FileText,
    Menu,
    X
} from 'lucide-react';
import './AdminLayout.css';
import './AdminResponsive.css';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAdmin, logout } = useContext(AuthContext);
    const [admin, setAdmin] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        // Verificar se usuário tem permissão de admin
        if (!user || !isAdmin) {
            navigate('/admin/login', { replace: true });
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAdmin({
            id: user.id,
            name: user.name,
            email: user.email,
            admin_role: user.admin_role,
            unit_id: user.unit_id
        });
    }, [user, isAdmin, navigate]);

    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/admin/login', { replace: true });
    };

    if (!admin) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando Painel...</div>;

    const navItems = [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'painel' },
        { path: '/admin/notices', icon: Bell, label: 'Avisos', section: 'gestao' },
        { path: '/admin/reports', icon: Flag, label: 'Denúncias', section: 'gestao' },
        { path: '/admin/users', icon: Users, label: 'Usuários', section: 'gestao' },
        { path: '/admin/courses', icon: BookOpen, label: 'Cursos', section: 'gestao' },
        { path: '/admin/events', icon: Calendar, label: 'Eventos', section: 'gestao' },
        { path: '/admin/audit', icon: FileText, label: 'Auditoria', section: 'sistema' },
        { path: '/admin/settings', icon: Settings, label: 'Configurações', section: 'sistema' },
    ];

    const pageTitles = [
        ['/admin/dashboard', 'Dashboard'],
        ['/admin/notices', 'Avisos'],
        ['/admin/reports', 'Denúncias'],
        ['/admin/users', 'Usuários'],
        ['/admin/courses', 'Cursos'],
        ['/admin/events', 'Eventos'],
        ['/admin/audit', 'Auditoria'],
        ['/admin/settings', 'Configurações']
    ];
    const currentPageTitle = pageTitles.find(([path]) =>
        location.pathname === path || location.pathname.startsWith(path + '/')
    )?.[1] || 'Painel administrativo';

    const getSectionTitle = (section) => {
        const titles = { painel: 'PAINEL', gestao: 'GESTÃO', sistema: 'SISTEMA' };
        return titles[section] || section.toUpperCase();
    };

    return (
        <div className="admin-layout">
            {/* Sidebar Corporativa */}
            <button
                type="button"
                className={'admin-sidebar-overlay' + (sidebarOpen ? ' is-open' : '')}
                aria-label="Fechar menu administrativo"
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={() => setSidebarOpen(false)}
            />

            <aside id="admin-sidebar" className={'admin-sidebar' + (sidebarOpen ? ' open' : '')}>
                <div className="admin-brand">
                    <ShieldAlert size={24} color="white" />
                    <span>SENAI CONNECT</span>
                </div>

                <nav id="admin-primary-navigation" className="admin-nav">
                    {['painel', 'gestao', 'sistema'].map(section => (
                        <React.Fragment key={section}>
                            <p className="admin-nav-title">{getSectionTitle(section)}</p>
                            {navItems.filter(item => item.section === section).map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={'admin-nav-item ' + (location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path + '/')) ? 'active' : '')}
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                </Link>
                            ))}
                        </React.Fragment>
                    ))}
                </nav>
            </aside>

            {/* Conteúdo Principal */}
            <div className="admin-main">
                {/* Topbar */}
                <header className="admin-topbar">
                    <div className="admin-topbar-left">
                        <button
                            type="button"
                            className="admin-menu-toggle"
                            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
                            aria-expanded={sidebarOpen}
                            aria-controls="admin-sidebar"
                            onClick={() => setSidebarOpen((open) => !open)}
                        >
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <h2>{currentPageTitle}</h2>
                    </div>
                    <div className="admin-topbar-right">
                        <div className="admin-profile-info">
                            <span className="admin-name">{admin.name}</span>
                            <span className="admin-role-badge">{admin.admin_role}</span>
                        </div>
                        <button onClick={handleLogout} className="admin-logout-btn">
                            <LogOut size={18} /> Sair
                        </button>
                    </div>
                </header>

                {/* Renderiza as sub-rotas */}
                <div className="admin-content-area" id="admin-main-content">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;