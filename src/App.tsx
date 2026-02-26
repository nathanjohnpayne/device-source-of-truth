import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { trackPageView } from './lib/analytics';
import LoadingSpinner from './components/shared/LoadingSpinner';
import UpdateToast from './components/shared/UpdateToast';
import AppShell from './components/layout/AppShell';
import WelcomeModal from './components/onboarding/WelcomeModal';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DeviceListPage = lazy(() => import('./pages/DeviceListPage'));
const DeviceCreatePage = lazy(() => import('./pages/DeviceCreatePage'));
const DeviceDetailPage = lazy(() => import('./pages/DeviceDetailPage'));
const SpecEditPage = lazy(() => import('./pages/SpecEditPage'));
const PartnerListPage = lazy(() => import('./pages/PartnerListPage'));
const PartnerDetailPage = lazy(() => import('./pages/PartnerDetailPage'));
const TierBrowserPage = lazy(() => import('./pages/TierBrowserPage'));
const TierConfigPage = lazy(() => import('./pages/TierConfigPage'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'));
const SpecCoveragePage = lazy(() => import('./pages/SpecCoveragePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const TelemetryUploadPage = lazy(() => import('./pages/TelemetryUploadPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const MigrationPage = lazy(() => import('./pages/MigrationPage'));
const ReadinessPage = lazy(() => import('./pages/ReadinessPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function EditorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isEditor } = useAuth();

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isEditor) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    const pageName = location.pathname === '/'
      ? 'Dashboard'
      : location.pathname
          .split('/')
          .filter(Boolean)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' / ');

    trackPageView(pageName, location.pathname);
  }, [location.pathname]);

  return null;
}

function OnboardingGate() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const done = localStorage.getItem('dsot_onboarding_complete');
      if (!done) setShowOnboarding(true);
    } catch {
      // noop
    }
  }, [user]);

  const handleClose = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('dsot_onboarding_complete', 'true');
    } catch {
      // noop
    }
  };

  if (!user) return null;

  return <WelcomeModal open={showOnboarding} onClose={handleClose} />;
}

function AppRoutes() {
  return (
    <>
      <PageViewTracker />
      <OnboardingGate />
      <UpdateToast />
      <Suspense fallback={<LoadingSpinner className="min-h-screen" />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="devices" element={<DeviceListPage />} />
            <Route
              path="devices/new"
              element={
                <EditorRoute>
                  <DeviceCreatePage />
                </EditorRoute>
              }
            />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route
              path="devices/:id/specs/edit"
              element={
                <EditorRoute>
                  <SpecEditPage />
                </EditorRoute>
              }
            />
            <Route path="partners" element={<PartnerListPage />} />
            <Route path="partners/:id" element={<PartnerDetailPage />} />
            <Route path="tiers" element={<TierBrowserPage />} />
            <Route
              path="tiers/configure"
              element={
                <AdminRoute>
                  <TierConfigPage />
                </AdminRoute>
              }
            />
            <Route path="tiers/simulate" element={<SimulatorPage />} />
            <Route path="reports/coverage" element={<SpecCoveragePage />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/upload"
              element={
                <AdminRoute>
                  <TelemetryUploadPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/alerts"
              element={
                <AdminRoute>
                  <AlertsPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/audit"
              element={
                <AdminRoute>
                  <AuditLogPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/migration"
              element={
                <AdminRoute>
                  <MigrationPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/readiness"
              element={
                <AdminRoute>
                  <ReadinessPage />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
