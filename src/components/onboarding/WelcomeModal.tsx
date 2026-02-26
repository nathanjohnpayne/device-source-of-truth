import { useState, useEffect } from 'react';
import { Monitor, Search, ClipboardList, Layers, BarChart3 } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';

const STORAGE_KEY = 'dsot_onboarding_complete';

interface Step {
  title: string;
  body: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to DST',
    body: 'Device Source of Truth is your single system of record for all NCP/ADK partner devices.',
    icon: <Monitor className="h-10 w-10" />,
  },
  {
    title: 'Find a Device',
    body: 'Use the search bar or browse the device catalog to find any device by name or Datadog ID.',
    icon: <Search className="h-10 w-10" />,
  },
  {
    title: 'Enter Specs',
    body: 'Open any device and fill in hardware specifications from partner questionnaires.',
    icon: <ClipboardList className="h-10 w-10" />,
  },
  {
    title: 'Understand Tiers',
    body: 'Devices are automatically classified into hardware tiers based on their specs.',
    icon: <Layers className="h-10 w-10" />,
  },
  {
    title: 'Run Reports',
    body: 'Generate coverage reports, partner summaries, and feature eligibility simulations.',
    icon: <BarChart3 className="h-10 w-10" />,
  },
];

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (open) {
      trackEvent('onboarding_start');
    }
  }, [open]);

  const complete = () => {
    if (dontShow) {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // noop
      }
    }
    trackEvent('onboarding_complete');
    onClose();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      complete();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!open) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col items-center px-8 pb-4 pt-10 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            {current.icon}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{current.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">{current.body}</p>
        </div>

        <div className="flex justify-center gap-1.5 py-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-indigo-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="border-t border-gray-100 px-8 py-4">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Don&apos;t show again
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-8 py-4">
          <button
            onClick={complete}
            className="text-sm font-medium text-gray-400 hover:text-gray-600"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
