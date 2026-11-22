import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Bell, CalendarDays, BookOpen } from 'lucide-react';
import './DivulgacaoNavigation.css';

const items = [
  { to: '/divulgacao', label: 'Divulgação', icon: Building2, end: true },
  { to: '/notices', label: 'Avisos', icon: Bell },
  { to: '/events', label: 'Eventos', icon: CalendarDays },
  { to: '/courses', label: 'Cursos', icon: BookOpen }
];

export default function DivulgacaoNavigation({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/divulgacao';

  return (
    <div className="divulgacao-workspace">
      <aside className="divulgacao-navigation" aria-label="Navegação da área de divulgação">
        <div className="divulgacao-navigation-heading">
          <span className="divulgacao-navigation-eyebrow">ÁREA DE DIVULGAÇÃO</span>
          <strong>Central de conteúdo</strong>
          <p>Acompanhe comunicados, eventos e oportunidades da sua unidade.</p>
        </div>

        <nav className="divulgacao-navigation-links">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => 'divulgacao-navigation-link' + (isActive ? ' active' : '')}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {!isHome && (
          <button
            type="button"
            className="divulgacao-back-button"
            onClick={() => navigate('/divulgacao')}
          >
            <ArrowLeft size={18} />
            <span>Voltar para divulgação</span>
          </button>
        )}
      </aside>

      <section className="divulgacao-workspace-content">
        {children}
      </section>
    </div>
  );
}
