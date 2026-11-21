import { Bell, User } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import './MobileHeader.css';

const MobileHeader = ({ onNotificationsClick, onProfileClick }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleNotificationClick = () => {
    if (onNotificationsClick) onNotificationsClick();
    else navigate('/notifications');
  };

  const handleProfileClick = () => {
    if (onProfileClick) onProfileClick();
    else if (user) navigate(`/profile/${user.id}`);
  };

  return (
    <header className="mobile-header" role="banner">
      <div className="mobile-header-content">
        {/* Left: Logo */}
        <button
          className="mobile-header-logo"
          onClick={handleLogoClick}
          aria-label="SENAI Connect - Início"
        >
          <svg viewBox="0 0 32 32" className="logo-icon" aria-hidden="true">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0066CC" />
                <stop offset="100%" stopColor="#004499" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#logoGradient)" />
            <text x="16" y="22" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="bold" fill="white" textAnchor="middle">SC</text>
          </svg>
          <span className="logo-text">SENAI Connect</span>
        </button>

        {/* Right: Actions */}
        <div className="mobile-header-actions">
          <button
            className="mobile-header-icon-btn"
            onClick={handleNotificationClick}
            aria-label="Notificações"
          >
            <Bell size={24} strokeWidth={2} />
            <span className="notification-badge" aria-hidden="true">3</span>
          </button>

          <button
            className="mobile-header-icon-btn"
            onClick={handleProfileClick}
            aria-label="Perfil"
          >
            <User size={24} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;