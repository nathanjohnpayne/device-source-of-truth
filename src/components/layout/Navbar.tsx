import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Building2, GitCompare, AlertTriangle, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  conflictCount?: number;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/devices', label: 'Devices', icon: List },
  { path: '/partners', label: 'Partners', icon: Building2 },
  { path: '/compare', label: 'Compare', icon: GitCompare },
  { path: '/conflicts', label: 'Conflicts', icon: AlertTriangle },
];

export function Navbar({ user, onLogout, conflictCount }: NavbarProps) {
  const location = useLocation();

  return (
    <nav className="bg-[#0f172a] text-white w-60 min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">DSOT</h1>
        <p className="text-xs text-slate-400 mt-1">Device Source of Truth</p>
      </div>

      <div className="flex-1 py-4">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          const showBadge = item.path === '/conflicts' && conflictCount && conflictCount > 0;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon size={18} />
              {item.label}
              {showBadge && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {conflictCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          {user.photoURL && (
            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.displayName}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
