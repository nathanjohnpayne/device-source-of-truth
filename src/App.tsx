import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/hooks';
import { logEvent } from './lib/firebase';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceListPage } from './pages/DeviceListPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { ComparePage } from './pages/ComparePage';
import { ConflictResolutionPage } from './pages/ConflictResolutionPage';
import { PartnersPage } from './pages/PartnersPage';

function App() {
  const { user, loading, allowed, signIn, logOut } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user && allowed) {
      logEvent('sign_in', { email: user.email || '' });
    }
  }, [user, allowed]);

  async function handleSignIn() {
    try {
      setAuthError(null);
      await signIn();
    } catch (err) {
      setAuthError('Sign-in failed. Please try again.');
      console.error('Auth error:', err);
    }
  }

  function handleLogout() {
    logEvent('sign_out');
    logOut();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSignIn={handleSignIn} error={authError} />;
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-4">
            Your account ({user.email}) is not authorized to access DSOT.
          </p>
          <p className="text-sm text-slate-400 mb-6">
            Contact your administrator to request access.
          </p>
          <button
            onClick={logOut}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Sign out and try another account
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell user={user} onLogout={handleLogout} />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/devices" element={<DeviceListPage />} />
          <Route path="/devices/:id" element={<DeviceDetailPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/conflicts" element={<ConflictResolutionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
