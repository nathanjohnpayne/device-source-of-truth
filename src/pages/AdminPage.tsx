import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  Bell,
  History,
  Database,
  CheckCircle,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/shared/Badge';

interface AdminCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badgeKey?: 'alertCount';
  disabled?: boolean;
  phase2?: boolean;
}

const ADMIN_CARDS: AdminCard[] = [
  {
    title: 'Telemetry Upload',
    description: 'Upload Datadog CSV exports to refresh device field counts',
    icon: <Upload className="h-6 w-6" />,
    path: '/admin/upload',
  },
  {
    title: 'Alerts',
    description: 'Review unregistered devices and new partner keys',
    icon: <Bell className="h-6 w-6" />,
    path: '/admin/alerts',
    badgeKey: 'alertCount',
  },
  {
    title: 'Audit Log',
    description: 'View all data change history',
    icon: <History className="h-6 w-6" />,
    path: '/admin/audit',
  },
  {
    title: 'Data Migration',
    description: 'Import devices from AllModels CSV',
    icon: <Database className="h-6 w-6" />,
    path: '/admin/migration',
  },
  {
    title: 'Readiness Checklist',
    description: 'Track Phase 1 readiness criteria',
    icon: <CheckCircle className="h-6 w-6" />,
    path: '/admin/readiness',
  },
  {
    title: 'Tier Configuration',
    description: 'Define hardware tier thresholds',
    icon: <Layers className="h-6 w-6" />,
    path: '/tiers/configure',
  },
  {
    title: 'Airtable Sync',
    description: 'Phase 2 — Coming Soon',
    icon: <RefreshCw className="h-6 w-6" />,
    path: '#',
    disabled: true,
    phase2: true,
  },
];

export default function AdminPage() {
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.alerts
      .list({ status: 'open', pageSize: 1 })
      .then((res) => setAlertCount(res.total))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="mt-1 text-sm text-gray-500">
          System administration and data management tools
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_CARDS.map((card) => {
          const content = (
            <div
              className={`group relative flex flex-col rounded-lg border border-gray-200 bg-white p-6 transition-shadow ${
                card.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:shadow-md hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`rounded-lg p-2.5 ${
                    card.disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  {card.icon}
                </div>
                <div className="flex items-center gap-2">
                  {card.badgeKey === 'alertCount' && alertCount > 0 && (
                    <Badge variant="danger">{alertCount} open</Badge>
                  )}
                  {card.phase2 && <Badge variant="default">Phase 2</Badge>}
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                {card.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{card.description}</p>
            </div>
          );

          if (card.disabled) {
            return <div key={card.title}>{content}</div>;
          }

          return (
            <Link key={card.title} to={card.path} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
