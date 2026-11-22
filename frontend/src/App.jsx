import React, { useContext, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './pages/Auth/Auth';
import AppLayout from './components/AppLayout';
import './App.css';

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Messages = lazy(() => import('./pages/Messages'));
const Groups = lazy(() => import('./pages/Groups'));
const Saved = lazy(() => import('./pages/Saved'));
const Files = lazy(() => import('./pages/Files'));
const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const EventosPage = lazy(() => import('./pages/EventosPage'));
const CursosPage = lazy(() => import('./pages/CursosPage'));
const AvisosPage = lazy(() => import('./pages/AvisosPage'));
const Explore = lazy(() => import('./pages/Explore'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ActivityCenter = lazy(() => import('./components/ActivityCenter/ActivityCenter'));
const DivulgacaoPage = lazy(() => import('./pages/DivulgacaoPage'));
const Hashtag = lazy(() => import('./pages/Hashtag'));

// Business pages
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const BusinessDashboardAnalytics = lazy(() => import('./pages/BusinessDashboardAnalytics'));
const BusinessDashboardPosts = lazy(() => import('./pages/BusinessDashboardPosts'));
const BusinessDashboardStories = lazy(() => import('./pages/BusinessDashboardStories'));
const BusinessDashboardBilling = lazy(() => import('./pages/BusinessDashboardBilling'));
const BusinessDashboardCampaigns = lazy(() => import('./pages/BusinessDashboardCampaigns'));
const BusinessCampaignForm = lazy(() => import('./pages/BusinessCampaignForm'));
const BusinessDashboardSettings = lazy(() => import('./pages/BusinessDashboardSettings'));
const BusinessDirectoryPage = lazy(() => import('./pages/BusinessDirectoryPage'));
const BusinessFeed = lazy(() => import('./pages/BusinessFeed'));
const BusinessProfilePage = lazy(() => import('./pages/BusinessProfilePage'));

// Auth pages
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));

// Admin pages
const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminReports = lazy(() => import('./pages/Admin/AdminReports'));
const AdminReportDetail = lazy(() => import('./pages/Admin/AdminReportDetail'));
const AdminCourses = lazy(() => import('./pages/Admin/AdminCourses'));
const AdminCourseForm = lazy(() => import('./pages/Admin/AdminCourseForm'));
const AdminEvents = lazy(() => import('./pages/Admin/AdminEvents'));
const AdminEventForm = lazy(() => import('./pages/Admin/AdminEventForm'));
const AdminNotices = lazy(() => import('./pages/Admin/AdminNotices'));
const AdminNoticesList = lazy(() => import('./pages/Admin/AdminNoticesList'));
const AdminCampaigns = lazy(() => import('./pages/Admin/AdminCampaigns'));
const AdminNoticeForm = lazy(() => import('./pages/Admin/AdminNoticeForm'));
const AdminSettings = lazy(() => import('./pages/Admin/AdminSettings'));
const AdminAudit = lazy(() => import('./pages/Admin/AdminAudit'));
const AdminLogin = lazy(() => import('./pages/Admin/AdminLogin'));

// Onboarding
const OnboardingPage = lazy(() => import('./pages/Onboarding/OnboardingPage'));

// Admin nested routes
const AdminRoutes = () => (
  <Routes>
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="notices" element={<AdminNoticesList />} />
    <Route path="campaigns" element={<AdminCampaigns />} />
    <Route path="notices/list" element={<AdminNoticesList />} />
    <Route path="notices/create" element={<AdminNoticeForm />} />
    <Route path="notices/edit/:id" element={<AdminNoticeForm />} />
    <Route path="reports" element={<AdminReports />} />
    <Route path="reports/:id" element={<AdminReportDetail />} />
    <Route path="users" element={<AdminUsers />} />
    <Route path="courses" element={<AdminCourses />} />
    <Route path="courses/new" element={<AdminCourseForm />} />
    <Route path="courses/:id/edit" element={<AdminCourseForm />} />
    <Route path="events" element={<AdminEvents />} />
    <Route path="events/new" element={<AdminEventForm />} />
    <Route path="events/:id/edit" element={<AdminEventForm />} />
    <Route path="audit" element={<AdminAudit />} />
    <Route path="settings" element={<AdminSettings />} />
    <Route path="login" element={<AdminLogin />} />
    <Route path="*" element={<Navigate to="dashboard" replace />} />
  </Routes>
);

function App() {
  const { user, loading, isAdmin } = useContext(AuthContext);

  if (loading) {
    return <div style={{display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center'}}>Carregando sistema...</div>;
  }

  // Se não estiver logado, exibe apenas as rotas de Auth
  if (!user) {
    return (
      <Router>
        <Suspense fallback={<div style={{display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center'}}>Carregando página...</div>}>
          <Routes>
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="*" element={<Auth />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  // Layout principal para usuário logado
  return (
    <Router>
      <ErrorBoundary>
        <AppLayout>
          <Suspense fallback={<div style={{display: 'flex', height: '400px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>Carregando página...</div>}>
            <Routes>
              {/* Main feed routes */}
              <Route path="/" element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Home />} />
              <Route path="/feed" element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/stories" element={<PlaceholderPage title="Histórias" />} />

              {/* Social routes */}
              <Route path="/groups" element={<Groups />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/activity" element={<ActivityCenter />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/notifications/:id" element={<Notifications />} />
              <Route path="/divulgacao" element={<DivulgacaoPage />} />
              <Route path="/hashtag/:hashtag" element={<Hashtag />} />

              {/* Content routes */}
              <Route path="/events" element={<EventosPage />} />
              <Route path="/courses" element={<CursosPage />} />
              <Route path="/notices" element={<AvisosPage />} />
              <Route path="/files" element={<Files />} />
              <Route path="/saved" element={<Saved />} />

              {/* Profile routes */}
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/profile" element={<Profile />} />

              {/* Settings & Help */}
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />

              {/* Business routes (Empresa role) */}
              <Route path="/business" element={<BusinessDashboard />} />
              <Route path="/business/analytics" element={<BusinessDashboardAnalytics />} />
              <Route path="/business/posts" element={<BusinessDashboardPosts />} />
              <Route path="/business/stories" element={<BusinessDashboardStories />} />
              <Route path="/business/billing" element={<BusinessDashboardBilling />} />
              <Route path="/business/campaigns/new" element={<BusinessCampaignForm />} />
              <Route path="/business/campaigns" element={<BusinessDashboardCampaigns />} />
              <Route path="/business/settings" element={<BusinessDashboardSettings />} />
              <Route path="/business/directory" element={<BusinessDirectoryPage />} />
              <Route path="/business/feed" element={<BusinessFeed />} />
              <Route path="/business/profile" element={<BusinessProfilePage />} />

              {/* Auth routes (public) */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Admin routes (nested under AdminLayout) */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="notices" element={<AdminNoticesList />} />
                <Route path="campaigns" element={<AdminCampaigns />} />
                <Route path="notices/list" element={<AdminNoticesList />} />
                <Route path="notices/new" element={<AdminNoticeForm />} />
                <Route path="notices/create" element={<AdminNoticeForm />} />
                <Route path="notices/:id/edit" element={<AdminNoticeForm />} />
                <Route path="notices/edit/:id" element={<AdminNoticeForm />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="reports/:id" element={<AdminReportDetail />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="courses" element={<AdminCourses />} />
                <Route path="courses/new" element={<AdminCourseForm />} />
                <Route path="courses/:id/edit" element={<AdminCourseForm />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="events/new" element={<AdminEventForm />} />
                <Route path="events/:id/edit" element={<AdminEventForm />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>

              {/* Onboarding */}
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
