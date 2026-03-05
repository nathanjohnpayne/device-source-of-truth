import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import type { ExtractionStep } from '../../lib/types';

interface ExtractionProgress {
  totalDevices: number;
  devicesComplete: number;
  devicesFailed: number;
  step: ExtractionStep | null;
  currentDevice: string | null;
}

interface FailedDevice {
  id: string;
  rawHeaderLabel: string;
}

interface ExtractionStatusPanelProps {
  status: string;
  progress: ExtractionProgress | null;
  failedDevices: FailedDevice[];
  onRestart: () => void;
  onRetryDevice: (deviceId: string) => void;
  retryingDeviceId: string | null;
}

const STEPS: { step: ExtractionStep; label: string }[] = [
  { step: 1, label: 'Reading spreadsheet' },
  { step: 2, label: 'Extracting fields' },
  { step: 3, label: 'Validating values' },
  { step: 4, label: 'Done' },
];

function StepIcon({ currentStep, step, status }: { currentStep: ExtractionStep | null; step: ExtractionStep; status: string }) {
  const isCompleted = currentStep != null && step < currentStep;
  const isCurrent = currentStep === step && (status === 'extracting');

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

export default function ExtractionStatusPanel({
  status,
  progress,
  failedDevices,
  onRestart,
  onRetryDevice,
  retryingDeviceId,
}: ExtractionStatusPanelProps) {
  const liveRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const isExtracting = status === 'extracting';
  const isFullFailure = status === 'extraction_failed' &&
    (failedDevices.length > 0 ? progress?.devicesComplete === 0 : true);
  const isPartialFailure = !isExtracting && !isFullFailure && failedDevices.length > 0 && (progress?.devicesComplete ?? 0) > 0;

  useEffect(() => {
    if (isFullFailure) {
      setAnnouncement('Extraction failed. AI could not extract fields from this questionnaire.');
    } else if (isPartialFailure) {
      const names = failedDevices.map(d => d.rawHeaderLabel).join(', ');
      setAnnouncement(`Extraction incomplete. ${names} could not be extracted.`);
    } else if (isExtracting && progress?.step) {
      const stepDef = STEPS.find(s => s.step === progress.step);
      if (stepDef) {
        const suffix = progress.step === 2 && progress.currentDevice
          ? ` — ${progress.currentDevice}`
          : '';
        setAnnouncement(`${stepDef.label}${suffix}`);
      }
    }
  }, [isExtracting, isFullFailure, isPartialFailure, progress?.step, progress?.currentDevice, failedDevices]);

  if (!isExtracting && !isFullFailure && !isPartialFailure) return null;

  // Full failure banner
  if (isFullFailure) {
    return (
      <>
        <div aria-live="assertive" className="sr-only" ref={liveRef}>
          {announcement}
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Extraction failed</p>
              <p className="mt-1 text-sm text-red-700">
                AI could not extract fields from this questionnaire. Your file is unaffected — you can enter fields manually or try again.
              </p>
            </div>
            <button
              onClick={onRestart}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restart
            </button>
          </div>
        </div>
      </>
    );
  }

  // Partial failure banner
  if (isPartialFailure) {
    const failedNames = failedDevices.map(d => d.rawHeaderLabel);
    const successNames = (progress?.devicesComplete ?? 0);

    return (
      <>
        <div aria-live="assertive" className="sr-only" ref={liveRef}>
          {announcement}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Extraction incomplete</p>
              <p className="mt-1 text-sm text-amber-700">
                {failedNames.join(', ')} could not be extracted. Fields already extracted for{' '}
                {successNames} device{successNames !== 1 ? 's' : ''} are saved.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {failedDevices.map(d => (
                <button
                  key={d.id}
                  onClick={() => onRetryDevice(d.id)}
                  disabled={retryingDeviceId === d.id}
                  className="flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${retryingDeviceId === d.id ? 'animate-spin' : ''}`} />
                  Retry {d.rawHeaderLabel}
                </button>
              ))}
            </div>
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
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            AI Extraction
          </span>
          {progress && progress.totalDevices > 0 && (
            <span className="text-xs text-gray-500">
              {progress.devicesComplete} / {progress.totalDevices} devices
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {STEPS.map(({ step, label }) => {
            const isCompleted = progress?.step != null && step < progress.step;
            const isCurrent = progress?.step === step;

            let displayLabel = label;
            if (step === 2 && isCurrent && progress?.currentDevice) {
              displayLabel = `Extracting fields — ${progress.currentDevice}`;
            }

            return (
              <div
                key={step}
                className={`flex items-center gap-3 ${
                  isCompleted ? 'text-gray-700' : isCurrent ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <StepIcon currentStep={progress?.step ?? null} step={step} status={status} />
                <span
                  className={`text-sm ${
                    isCurrent ? 'font-medium' : isCompleted ? '' : 'font-light'
                  }`}
                >
                  {displayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
