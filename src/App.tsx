import { lazy, Suspense, useEffect, useState, Component, type ReactNode } from 'react';
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
import UpdateBanner from './components/UpdateBanner';
import AppShell from './components/layout/AppShell';
import WelcomeModal from './components/onboarding/WelcomeModal';

function lazyRetry(factory: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    factory().catch(() => {
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      }
      return factory();
    }),
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    if (error.message?.includes('dynamically imported module')) {
      window.location.reload();
    }
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
          <h2 style={{ color: 'red' }}>Application Error</h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f5f5f5',
              padding: '1rem',
              borderRadius: '4px',
            }}
          >
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoginPage = lazyRetry(() => import('./pages/LoginPage'));
const DashboardPage = lazyRetry(() => import('./pages/DashboardPage'));
const DeviceListPage = lazyRetry(() => import('./pages/DeviceListPage'));
const DeviceCreatePage = lazyRetry(() => import('./pages/DeviceCreatePage'));
const DeviceDetailPage = lazyRetry(() => import('./pages/DeviceDetailPage'));
const SpecEditPage = lazyRetry(() => import('./pages/SpecEditPage'));
const PartnerListPage = lazyRetry(() => import('./pages/PartnerListPage'));
const PartnerDetailPage = lazyRetry(() => import('./pages/PartnerDetailPage'));
const TierBrowserPage = lazyRetry(() => import('./pages/TierBrowserPage'));
const TierConfigPage = lazyRetry(() => import('./pages/TierConfigPage'));
const SimulatorPage = lazyRetry(() => import('./pages/SimulatorPage'));
const SpecCoveragePage = lazyRetry(() => import('./pages/SpecCoveragePage'));
const AdminPage = lazyRetry(() => import('./pages/AdminPage'));
const TelemetryUploadPage = lazyRetry(() => import('./pages/TelemetryUploadPage'));
const AlertsPage = lazyRetry(() => import('./pages/AlertsPage'));
const AuditLogPage = lazyRetry(() => import('./pages/AuditLogPage'));
const MigrationPage = lazyRetry(() => import('./pages/MigrationPage'));
const ReadinessPage = lazyRetry(() => import('./pages/ReadinessPage'));
const ReferenceDataPage = lazyRetry(() => import('./pages/ReferenceDataPage'));

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
      <UpdateBanner />
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
            <Route
              path="admin/reference-data"
              element={
                <AdminRoute>
                  <ReferenceDataPage />
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
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
