import { Home, Search, Plus, Heart, User, MessageCircle, LayoutGrid, X } from 'lucide-react';
import { useContext, useState, useRef, useCallback, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { SocketContext } from '../context/SocketContext.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileCreateSheet from './MobileCreateSheet';
import './MobileBottomNav.css';

const MobileBottomNav = ({ onCreatePost, onCreateStory, onNavigateHome }) => {
  const { user } = useContext(AuthContext);
  const { unreadCount, unreadMessagesCount } = useContext(SocketContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const navItemsRef = useRef(null);
  const previousActiveElement = useRef(null);

  const navItems = [
    { path: '/feed', icon: LayoutGrid, label: 'Feed', testId: 'nav-feed', index: 0 },
    { path: '/', icon: Home, label: 'Início', testId: 'nav-home', index: 1 },
    { path: '/explore', icon: Search, label: 'Explorar', testId: 'nav-explore', index: 2 },
    { path: '/create', icon: Plus, label: 'Criar', isCreate: true, testId: 'nav-create', index: 3 },
    { path: '/messages', icon: MessageCircle, label: 'Mensagens', testId: 'nav-messages', index: 4 },
    { path: '/activity', icon: Heart, label: 'Atividade', testId: 'nav-activity', index: 5 },
    { path: user ? `/profile/${user.id}` : '/login', icon: User, label: 'Perfil', testId: 'nav-profile', index: 6 },
  ];

  // Filter out create item for swipe navigation (it's an action, not a page)
  const swipeableItems = navItems.filter(item => !item.isCreate);

  const getActivePath = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Find current active index among swipeable items
  const activeIndex = swipeableItems.findIndex(item => getActivePath(item.path));

  // Swipe navigation handlers
  const handleTouchStart = useCallback((e) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  }, []);

  const handleTouchMove = useCallback((e) => {
    // Prevent horizontal scroll on nav
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Only handle horizontal swipes (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        // Swipe left - next tab
        const nextIndex = Math.min(activeIndex + 1, swipeableItems.length - 1);
        if (nextIndex !== activeIndex) {
          navigate(swipeableItems[nextIndex].path);
        }
      } else {
        // Swipe right - previous tab
        const prevIndex = Math.max(activeIndex - 1, 0);
        if (prevIndex !== activeIndex) {
          navigate(swipeableItems[prevIndex].path);
        }
      }
    }
  }, [touchStartX, activeIndex, swipeableItems, navigate]);

  // Handle keyboard for sheet
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isSheetOpen) {
      setIsSheetOpen(false);
    }
  }, [isSheetOpen]);

  // Focus management for sheet
  useEffect(() => {
    if (isSheetOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSheetOpen, handleKeyDown]);

  return (
    <>
      <nav
        className="mobile-bottom-nav"
        role="navigation"
        aria-label="Navegação principal"
        ref={navItemsRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mobile-bottom-nav-inner">
          {navItems.map((item) => {
            const isActive = getActivePath(item.path);
            const Icon = item.icon;

            if (item.isCreate) {
              return (
                <button
                  key={item.testId}
                  className="mobile-nav-item mobile-nav-create"
                  onClick={() => setIsSheetOpen(true)}
                  aria-label={item.label}
                  aria-expanded={isSheetOpen}
                  aria-haspopup="dialog"
                  aria-controls="mobile-create-sheet"
                  data-testid={item.testId}
                >
                  <span className="create-button-inner" aria-hidden="true">
                    <Icon size={24} strokeWidth={2.5} />
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.testId}
                to={item.path}
                className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                data-testid={item.testId}
              >
                <Icon
                  size={24}
                  strokeWidth={isActive ? 3 : 2}
                  className="nav-icon"
                  aria-hidden="true"
                />
                {(() => {
                  const count = item.path === '/messages'
                    ? unreadMessagesCount
                    : item.path === '/activity'
                      ? unreadCount
                      : 0;
                  return count > 0 ? (
                    <span className="mobile-nav-badge" aria-label={`${count} ${item.label.toLowerCase()} não lidas`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null;
                })()}
                {/* Active indicator dot */}
                {isActive && <span className="active-indicator" aria-hidden="true" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Create Sheet */}
      <MobileCreateSheet
        id="mobile-create-sheet"
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onCreatePost={onCreatePost}
        onCreateStory={onCreateStory}
        onNavigateHome={onNavigateHome}
      />
    </>
  );
};

export default MobileBottomNav;