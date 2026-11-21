import React, { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import MobileBottomNav from './MobileBottomNav';
import './AppLayout.css';

const AppLayout = ({ children }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

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
    <div className="app-layout">
      {/* Main Content Area */}
      <main className="app-main" role="main">
        <div className="app-feed-container">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - shown on ALL screen sizes including messages */}
      {showBottomNav && user && (
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
  );
};

export default AppLayout;