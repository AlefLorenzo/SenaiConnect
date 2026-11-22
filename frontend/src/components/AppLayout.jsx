import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { StoryViewerContext } from '../context/StoryViewerContext.jsx';
import { SocketContext } from '../context/SocketContext.jsx';
import MobileBottomNav from './MobileBottomNav';
import DivulgacaoNavigation from './DivulgacaoNavigation';
import { BellRing, X } from 'lucide-react';
import './AppLayout.css';

const AppLayout = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { fetchUnreadCount, fetchUnreadMessagesCount } = useContext(SocketContext);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationPromptBusy, setNotificationPromptBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDisclosureRoute = ['/divulgacao', '/notices', '/events', '/courses'].includes(location.pathname);

  useEffect(() => {
    const refreshPermission = () => setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
    window.addEventListener('focus', refreshPermission);
    document.addEventListener('visibilitychange', refreshPermission);
    return () => { window.removeEventListener('focus', refreshPermission); document.removeEventListener('visibilitychange', refreshPermission); };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => console.error('Falha ao registrar notificações:', error));
    }
  }, []);

  useEffect(() => {
    if (!user?.id || notificationPermission !== 'default') {
      setShowNotificationPrompt(false);
      return;
    }
    // localStorage is isolated by browser profile/device and origin; never store this dismissal on the account/backend.
    const dismissed = localStorage.getItem(`notification_prompt_dismissed_${user.id}`);
    setShowNotificationPrompt(!dismissed);
  }, [user?.id, notificationPermission]);

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPromptBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) await registration.showNotification('SENAI Connect', {
          body: 'Notificações ativadas! Você será avisado sobre mensagens e atividades.',
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'senai-connect-welcome'
        });
        setShowNotificationPrompt(false);
      } else if (permission === 'denied') {
        setShowNotificationPrompt(false);
      }
    } catch (error) {
      console.error('Não foi possível solicitar permissão de notificações:', error);
    } finally {
      setNotificationPromptBusy(false);
    }
  };

  const dismissNotificationPrompt = () => {
    if (user?.id) localStorage.setItem(`notification_prompt_dismissed_${user.id}`, 'true');
    setShowNotificationPrompt(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    if (typeof fetchUnreadCount === 'function') fetchUnreadCount();
    if (typeof fetchUnreadMessagesCount === 'function') fetchUnreadMessagesCount();
  }, [location.pathname, user?.id, fetchUnreadCount, fetchUnreadMessagesCount]);

  // FAB callbacks for creation flows
  const handleCreatePost = (type) => {
    // Navigate to home where CreatePostCard is available
    if (type) {
      sessionStorage.setItem('createPostType', type);
      window.dispatchEvent(new CustomEvent('createPostTypeChanged', { detail: { type } }));
    }
  };

  const handleNavigateHome = () => {
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  // Determine if we should show bottom nav (show on all main routes including messages)
  const showBottomNav = location.pathname !== '/login' &&
                         location.pathname !== '/register' &&
                         location.pathname !== '/forgot-password' &&
                         location.pathname !== '/reset-password' &&
                         !location.pathname.startsWith('/admin') &&
                         !location.pathname.startsWith('/business') &&
                         location.pathname !== '/onboarding';

  return (
    <StoryViewerContext.Provider value={{ setStoryViewerOpen: setIsStoryViewerOpen }}>
      <div className={"app-layout " + (isAdminRoute ? "app-layout--admin" : "")}>
        {user && showNotificationPrompt && (
          <aside className="notification-permission-banner" role="dialog" aria-label="Ativar notificações">
            <div className="notification-permission-banner__icon"><BellRing size={22} /></div>
            <div className="notification-permission-banner__copy">
              <strong>Ative as notificações do SENAI Connect</strong>
              <span>Receba avisos de mensagens, curtidas, novos seguidores, comentários e eventos.</span>
            </div>
            <button type="button" className="notification-permission-banner__enable" onClick={handleEnableNotifications} disabled={notificationPromptBusy}>
              {notificationPromptBusy ? 'Aguarde…' : 'Ativar'}
            </button>
            <button type="button" className="notification-permission-banner__dismiss" onClick={dismissNotificationPrompt} aria-label="Agora não" title="Agora não">
              <X size={19} />
            </button>
          </aside>
        )}

        {/* Main Content Area */}
        <main className={"app-main " + (isAdminRoute ? "app-main--admin" : "")} role="main">
          <div className={"app-feed-container " + (isAdminRoute ? "app-feed-container--admin" : "") + (isDisclosureRoute ? " app-feed-container--disclosure" : "")}>
            {isDisclosureRoute ? (
              <DivulgacaoNavigation>{children}</DivulgacaoNavigation>
            ) : children}
          </div>
        </main>

        {/* Hide the global navigation while a story is open, like WhatsApp */}
        {showBottomNav && !isStoryViewerOpen && user && (
          <MobileBottomNav
            onCreatePost={handleCreatePost}
            onCreateStory={() => {
              // Navigate to home for story creation
              handleNavigateHome();
              sessionStorage.setItem('createStory', 'true');
            }}
            onNavigateHome={handleNavigateHome}
          />
        )}
      </div>
    </StoryViewerContext.Provider>
  );
};

export default AppLayout;