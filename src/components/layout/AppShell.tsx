import { type ReactNode, useMemo } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  Building2,
  Layers,
  BarChart3,
  Upload,
  Bell,
  History,
  Database,
  CheckCircle,
  ListChecks,
  FileSpreadsheet,
  Key,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import GlobalSearch from './GlobalSearch';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  badge?: string;
  adminOnly?: boolean;
}

interface NavSection {
  heading?: string;
  headingIcon?: ReactNode;
  adminOnly?: boolean;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', path: '/', icon: <LayoutDashboard className="h-5 w-5" /> },
      {
        label: 'Devices',
        path: '/devices',
        icon: <Monitor className="h-5 w-5" />,
        badge: '0',
      },
      { label: 'Partners', path: '/partners', icon: <Building2 className="h-5 w-5" /> },
      { label: 'Hardware Tiers', path: '/tiers', icon: <Layers className="h-5 w-5" /> },
    ],
  },
  {
    heading: 'Reports',
    items: [
      {
        label: 'Spec Coverage',
        path: '/reports/coverage',
        icon: <BarChart3 className="h-5 w-5" />,
      },
    ],
  },
  {
    heading: 'Import',
    headingIcon: <Upload className="h-3.5 w-3.5" />,
    adminOnly: true,
    items: [
      {
        label: 'Telemetry Upload',
        path: '/admin/upload',
        icon: <Upload className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        label: 'All Models Migration',
        path: '/admin/migration',
        icon: <Database className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        label: 'Intake Requests',
        path: '/admin/intake-import',
        icon: <FileSpreadsheet className="h-5 w-5" />,
        adminOnly: true,
      },
    ],
  },
  {
    heading: 'Admin',
    adminOnly: true,
    items: [
      {
        label: 'Alerts',
        path: '/admin/alerts',
        icon: <Bell className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        label: 'Audit Log',
        path: '/admin/audit',
        icon: <History className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        label: 'Reference Data',
        path: '/admin/reference-data',
        icon: <ListChecks className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        label: 'Partner Keys',
        path: '/admin/partner-keys',
        icon: <Key className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        label: 'Readiness',
        path: '/admin/readiness',
        icon: <CheckCircle className="h-5 w-5" />,
        adminOnly: true,
      },
    ],
  },
];

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      <Link to="/" className="hover:text-gray-700">
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={crumb.path} className="hover:text-gray-700">
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900">
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          D
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Device Source of Truth</h1>
          <p className="text-xs text-slate-400">Disney Streaming</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, si) => {
          if (section.adminOnly && !isAdmin) return null;
          return (
            <div key={si} className={si > 0 ? 'mt-6' : ''}>
              {section.heading && (
                <h3 className="mb-2 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {section.headingIcon}
                  {section.heading}
                </h3>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.adminOnly && !isAdmin) return null;
                  const active = isActive(item.path);
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              active
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = useMemo(() => {
    if (!user?.displayName) return '?';
    return user.displayName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user?.displayName]);

  const roleBadgeVariant =
    user?.role === 'admin' ? 'danger' : user?.role === 'editor' ? 'info' : 'default';

  return (
    <header className="fixed top-0 left-64 right-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-4">
        <GlobalSearch />

        <div className="flex items-center gap-3">
          <Badge variant={roleBadgeVariant}>{user?.role ?? 'viewer'}</Badge>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {initials}
          </div>
          <button
            onClick={() => {
              signOut();
              navigate('/login');
            }}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

interface AppShellProps {
  children?: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />
      <main className="ml-64 pt-16">
        <div className="p-6">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
