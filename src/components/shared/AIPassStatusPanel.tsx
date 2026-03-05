import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import type { AIPassState, AIPassStep } from '../../lib/types';

interface AIPassStatusPanelProps {
  passState: AIPassState;
  onRestart: () => void;
  collapsed: boolean;
}

const STEPS: { step: AIPassStep; label: string }[] = [
  { step: 1, label: 'Analyzing file' },
  { step: 2, label: 'Sending to AI' },
  { step: 3, label: 'Processing responses' },
  { step: 4, label: 'Finalizing results' },
  { step: 5, label: 'Done' },
];

function StepLabel({ step, batchCount }: { step: AIPassStep; batchCount: number | null }) {
  const base = STEPS.find(s => s.step === step)!.label;
  if (step === 2 && batchCount != null) {
    return <>{base} &mdash; {batchCount} {batchCount === 1 ? 'batch' : 'batches'}</>;
  }
  return <>{base}</>;
}

function StepIcon({ state, step }: { state: AIPassState; step: AIPassStep }) {
  const isCompleted = state.completedSteps.has(step);
  const isCurrent = state.currentStep === step && state.status === 'running';

  if (isCompleted) {
    return <CheckCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
  }
  if (isCurrent) {
    return (
      <span className="relative flex h-4 w-4">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-indigo-500" />
      </span>
    );
  }
  return <span className="inline-flex h-4 w-4 rounded-full border-2 border-gray-300" aria-hidden="true" />;
}

export default function AIPassStatusPanel({ passState, onRestart, collapsed }: AIPassStatusPanelProps) {
  const liveRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');

  // Announce step transitions for screen readers
  useEffect(() => {
    if (passState.status === 'failed') {
      setAnnouncement(`AI pass failed. ${passState.failureReason ?? ''}`);
    } else if (passState.status === 'success' && passState.currentStep === 5) {
      setAnnouncement(
        `AI pass complete. ${passState.resolved ?? 0} values resolved, ${passState.flagged ?? 0} flagged for review.`,
      );
    } else if (passState.status === 'partial_failure' && passState.currentStep === 5) {
      setAnnouncement(
        `AI pass complete with warnings. ${passState.failedFieldTypes.join(', ')} fell back to rule-based validation.`,
      );
    } else if (passState.currentStep && passState.status === 'running') {
      const stepDef = STEPS.find(s => s.step === passState.currentStep);
      if (stepDef) {
        const suffix = passState.currentStep === 2 && passState.batchCount
          ? ` — ${passState.batchCount} ${passState.batchCount === 1 ? 'batch' : 'batches'}`
          : '';
        setAnnouncement(`${stepDef.label}${suffix}`);
      }
    }
  }, [passState.currentStep, passState.status, passState.failureReason, passState.resolved, passState.flagged, passState.failedFieldTypes]);

  if (passState.status === 'idle') return null;

  // Success summary line (before collapse)
  if ((passState.status === 'success' || passState.status === 'partial_failure') && passState.currentStep === 5 && !collapsed) {
    return (
      <>
        <div
          aria-live={passState.status === 'failed' ? 'assertive' : 'polite'}
          className="sr-only"
          ref={liveRef}
        >
          {announcement}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 transition-all">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              AI pass complete &mdash; {passState.resolved ?? 0} values resolved, {passState.flagged ?? 0} flagged for review.
            </p>
          </div>

          {passState.status === 'partial_failure' && passState.failedFieldTypes.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                AI could not resolve {passState.failedFieldTypes.length} field type{passState.failedFieldTypes.length !== 1 ? 's' : ''} &mdash;{' '}
                {passState.failedFieldTypes.join(', ')} fell back to rule-based validation.
              </p>
            </div>
          )}
        </div>
      </>
    );
  }

  // Collapsed = success is done, panel hidden
  if (collapsed) return null;

  // Failed state
  if (passState.status === 'failed') {
    return (
      <>
        <div aria-live="assertive" className="sr-only" ref={liveRef}>
          {announcement}
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-red-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">AI pass failed</p>
              <p className="mt-1 text-sm text-red-700">
                The AI could not complete. Your import is unaffected — rule-based validation will be applied instead.
              </p>
            </div>
            <button
              onClick={onRestart}
              className="flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restart AI Pass
            </button>
          </div>
        </div>
      </>
    );
  }

  // In-progress stepper
  return (
    <>
      <div aria-live="polite" className="sr-only" ref={liveRef}>
        {announcement}
      </div>

      <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">AI Pass</span>
        </div>

        <div className="space-y-2.5">
          {STEPS.map(({ step }) => {
            const isCompleted = passState.completedSteps.has(step);
            const isCurrent = passState.currentStep === step && passState.status === 'running';

            return (
              <div
                key={step}
                className={`flex items-center gap-3 ${
                  isCompleted ? 'text-gray-700' : isCurrent ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <StepIcon state={passState} step={step} />
                <span
                  className={`text-sm ${
                    isCurrent ? 'font-medium' : isCompleted ? '' : 'font-light'
                  }`}
                >
                  <StepLabel step={step} batchCount={passState.batchCount} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
