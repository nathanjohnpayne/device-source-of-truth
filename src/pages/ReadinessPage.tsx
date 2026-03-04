import { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { trackEvent } from '../lib/analytics';
import Modal from '../components/shared/Modal';
import Tooltip from '../components/shared/Tooltip';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: CheckStatus;
  value: string;
  manual?: boolean;
}

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
  warn: <AlertTriangle className="h-6 w-6 text-amber-500" />,
  fail: <XCircle className="h-6 w-6 text-red-500" />,
};

const STATUS_RING: Record<CheckStatus, string> = {
  pass: 'border-emerald-200 bg-emerald-50',
  warn: 'border-amber-200 bg-amber-50',
  fail: 'border-red-200 bg-red-50',
};

function loadManualToggle(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function saveManualToggle(key: string, val: boolean) {
  try {
    localStorage.setItem(key, String(val));
  } catch {
    // noop
  }
}

export default function ReadinessPage() {
  const { isAdmin } = useAuth();

  const [teamOnboarded, setTeamOnboarded] = useState(() =>
    loadManualToggle('dsot_readiness_team_onboarded'),
  );
  const [tiersApproved, setTiersApproved] = useState(() =>
    loadManualToggle('dsot_readiness_tiers_approved'),
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [declared, setDeclared] = useState(() =>
    loadManualToggle('dsot_readiness_declared'),
  );

  const toggleTeamOnboarded = useCallback(() => {
    const next = !teamOnboarded;
    setTeamOnboarded(next);
    saveManualToggle('dsot_readiness_team_onboarded', next);
  }, [teamOnboarded]);

  const toggleTiersApproved = useCallback(() => {
    const next = !tiersApproved;
    setTiersApproved(next);
    saveManualToggle('dsot_readiness_tiers_approved', next);
  }, [tiersApproved]);

  const checklist: ChecklistItem[] = [
    {
      id: 'migration',
      title: 'All AllModels devices migrated',
      description: 'The AllModels CSV has been imported into DST with no critical errors.',
      status: 'pass',
      value: '1,247 devices imported',
    },
    {
      id: 'datadog',
      title: 'Successful observability CSV upload with no errors',
      description: 'At least one observability telemetry CSV was uploaded without errors.',
      status: 'warn',
      value: 'Last upload: 2 warnings',
    },
    {
      id: 'team',
      title: 'Certification team onboarded and trained',
      description: 'All certification team members have completed DST onboarding.',
      status: teamOnboarded ? 'pass' : 'fail',
      value: teamOnboarded ? 'Marked complete' : 'Not yet confirmed',
      manual: true,
    },
    {
      id: 'coverage',
      title: 'Spec coverage ≥ 80% by active device count',
      description: 'At least 80% of active devices have spec completeness above threshold.',
      status: 'pass',
      value: '84% coverage (target: 80%)',
    },
    {
      id: 'tiers',
      title: 'Tier definitions reviewed and approved by P&D PM',
      description: 'Hardware tier thresholds have been reviewed and formally approved.',
      status: tiersApproved ? 'pass' : 'fail',
      value: tiersApproved ? 'Approved' : 'Pending review',
      manual: true,
    },
  ];

  const passCount = checklist.filter((c) => c.status === 'pass').length;
  const allPassed = passCount === checklist.length;
  const progressPct = (passCount / checklist.length) * 100;

  const handleDeclare = () => {
    setDeclared(true);
    saveManualToggle('dsot_readiness_declared', true);
    setShowConfirm(false);
    trackEvent('readiness_declare', { device_id: 'phase-1' });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phase 1 Readiness</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track completion of all prerequisites before declaring Phase 1 live.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            Overall Progress: {passCount} of {checklist.length} criteria met
          </span>
          <span className="font-semibold text-indigo-600">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {checklist.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-start gap-4 rounded-lg border p-5 ${STATUS_RING[item.status]}`}
          >
            <div className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                <Tooltip content={item.description} />
              </div>
              <p className="mt-1 text-sm text-gray-600">{item.value}</p>
            </div>
            {item.manual && isAdmin && (
              <button
                onClick={
                  item.id === 'team' ? toggleTeamOnboarded : toggleTiersApproved
                }
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  item.status === 'pass'
                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {item.status === 'pass' ? 'Undo' : 'Mark Complete'}
              </button>
            )}
          </div>
        ))}
      </div>

      {declared ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Phase 1 Declared Complete</p>
            <p className="text-xs text-emerald-600">
              Recorded at {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!allPassed}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-5 w-5" />
          Declare Phase 1 Complete
        </button>
      )}

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Phase 1 Declaration"
        footer={
          <>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeclare}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Yes, Declare Complete
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            You are about to declare Phase 1 as complete. This will record a timestamp and notify
            stakeholders.
          </p>
          <p className="text-sm font-medium text-gray-900">
            All {checklist.length} readiness criteria have been met. Are you sure?
          </p>
        </div>
      </Modal>
    </div>
  );
}
