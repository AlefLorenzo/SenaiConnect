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
    FileText
} from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAdmin, logout } = useContext(AuthContext);
    const [admin, setAdmin] = useState(null);

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

    const handleLogout = () => {
        logout();
        navigate('/admin/login', { replace: true });
    };

    if (!admin) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando Painel...</div>;

    const navItems = [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'painel' },
        { path: '/admin/notices', icon: Bell, label: 'Avisos', section: 'gestao', badge: 3 },
        { path: '/admin/reports', icon: Flag, label: 'Denúncias', section: 'gestao', badge: 7 },
        { path: '/admin/users', icon: Users, label: 'Usuários', section: 'gestao' },
        { path: '/admin/courses', icon: BookOpen, label: 'Cursos', section: 'gestao' },
        { path: '/admin/events', icon: Calendar, label: 'Eventos', section: 'gestao' },
        { path: '/admin/audit', icon: FileText, label: 'Auditoria', section: 'sistema' },
        { path: '/admin/settings', icon: Settings, label: 'Configurações', section: 'sistema' },
    ];

    const getSectionTitle = (section) => {
        const titles = { painel: 'PAINEL', gestao: 'GESTÃO', sistema: 'SISTEMA' };
        return titles[section] || section.toUpperCase();
    };

    return (
        <div className="admin-layout">
            {/* Sidebar Corporativa */}
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <ShieldAlert size={24} color="white" />
                    <span>SENAI CONNECT</span>
                </div>

                <nav className="admin-nav">
                    {['painel', 'gestao', 'sistema'].map(section => (
                        <React.Fragment key={section}>
                            <p className="admin-nav-title">{getSectionTitle(section)}</p>
                            {navItems.filter(item => item.section === section).map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                    {item.badge && <span className="admin-nav-badge">{item.badge}</span>}
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
                        <h2>{location.pathname === '/admin/dashboard' ? 'Dashboard' : 'Painel de Controle'}</h2>
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
                <div className="admin-content-area">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;