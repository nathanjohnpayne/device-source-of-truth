import { lazy, Suspense, useEffect, useState, Component, type ReactNode } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ImportPrerequisiteProvider } from './hooks/useImportPrerequisites';
import { trackPageView } from './lib/analytics';
import { resolveAnalyticsRoute } from './lib/analyticsRoutes';
import LoadingSpinner from './components/shared/LoadingSpinner';
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
        <div className="p-8 font-mono">
          <h2 className="text-lg font-bold text-red-600">Application Error</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded bg-gray-100 p-4 text-sm">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
const IntakeImportPage = lazyRetry(() => import('./pages/IntakeImportPage'));
const PartnerKeyRegistryPage = lazyRetry(() => import('./pages/PartnerKeyRegistryPage'));
const DangerZonePage = lazyRetry(() => import('./pages/DangerZonePage'));
const VersionRegistryPage = lazyRetry(() => import('./pages/VersionRegistryPage'));
const UserManagementPage = lazyRetry(() => import('./pages/UserManagementPage'));
const QuestionnaireQueuePage = lazyRetry(() => import('./pages/QuestionnaireQueuePage'));
const QuestionnaireUploadPage = lazyRetry(() => import('./pages/QuestionnaireUploadPage'));
const QuestionnaireDetailPage = lazyRetry(() => import('./pages/QuestionnaireDetailPage'));
const QuestionnaireReviewPage = lazyRetry(() => import('./pages/QuestionnaireReviewPage'));

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
    const route = resolveAnalyticsRoute(location.pathname);
    trackPageView(route.pageTitle, route.pagePath);
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

function RootLayout() {
  return (
    <AuthProvider>
      <PageViewTracker />
      <OnboardingGate />
      <Suspense fallback={<LoadingSpinner className="min-h-screen" />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ImportPrerequisiteProvider>
      <AppShell />
    </ImportPrerequisiteProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'devices', element: <DeviceListPage /> },
          {
            path: 'devices/new',
            element: <EditorRoute><DeviceCreatePage /></EditorRoute>,
          },
          { path: 'devices/:id', element: <DeviceDetailPage /> },
          {
            path: 'devices/:id/specs/edit',
            element: <EditorRoute><SpecEditPage /></EditorRoute>,
          },
          { path: 'partners', element: <PartnerListPage /> },
          { path: 'partners/:id', element: <PartnerDetailPage /> },
          { path: 'tiers', element: <TierBrowserPage /> },
          {
            path: 'tiers/configure',
            element: <AdminRoute><TierConfigPage /></AdminRoute>,
          },
          { path: 'tiers/simulate', element: <SimulatorPage /> },
          { path: 'reports/coverage', element: <SpecCoveragePage /> },
          {
            path: 'admin',
            element: <AdminRoute><AdminPage /></AdminRoute>,
          },
          {
            path: 'admin/upload',
            element: <AdminRoute><TelemetryUploadPage /></AdminRoute>,
          },
          {
            path: 'admin/alerts',
            element: <AdminRoute><AlertsPage /></AdminRoute>,
          },
          {
            path: 'admin/audit',
            element: <AdminRoute><AuditLogPage /></AdminRoute>,
          },
          {
            path: 'admin/migration',
            element: <AdminRoute><MigrationPage /></AdminRoute>,
          },
          {
            path: 'admin/readiness',
            element: <AdminRoute><ReadinessPage /></AdminRoute>,
          },
          {
            path: 'admin/reference-data',
            element: <AdminRoute><ReferenceDataPage /></AdminRoute>,
          },
          {
            path: 'admin/partner-keys',
            element: <AdminRoute><PartnerKeyRegistryPage /></AdminRoute>,
          },
          {
            path: 'admin/intake-import',
            element: <AdminRoute><IntakeImportPage /></AdminRoute>,
          },
          { path: 'admin/questionnaires', element: <QuestionnaireQueuePage /> },
          {
            path: 'admin/questionnaires/upload',
            element: <EditorRoute><QuestionnaireUploadPage /></EditorRoute>,
          },
          { path: 'admin/questionnaires/:id', element: <QuestionnaireDetailPage /> },
          {
            path: 'admin/questionnaires/:id/review',
            element: <AdminRoute><QuestionnaireReviewPage /></AdminRoute>,
          },
          {
            path: 'admin/users',
            element: <AdminRoute><UserManagementPage /></AdminRoute>,
          },
          {
            path: 'admin/danger-zone',
            element: <AdminRoute><DangerZonePage /></AdminRoute>,
          },
          {
            path: 'admin/version-registry',
            element: <AdminRoute><VersionRegistryPage /></AdminRoute>,
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
