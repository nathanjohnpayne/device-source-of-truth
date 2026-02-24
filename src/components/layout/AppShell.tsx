import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useDevices } from '../../lib/hooks';
import type { User } from 'firebase/auth';

interface AppShellProps {
  user: User;
  onLogout: () => void;
}

export function AppShell({ user, onLogout }: AppShellProps) {
  const { devices } = useDevices();
  const conflictCount = devices.filter(d => d.conflicts && d.conflicts.length > 0).length;

  return (
    <div className="flex min-h-screen">
      <Navbar user={user} onLogout={onLogout} conflictCount={conflictCount} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
