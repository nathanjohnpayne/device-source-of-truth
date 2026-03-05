import { Check } from 'lucide-react';

interface StepItem {
  key: string;
  label: string;
}

interface WorkflowStepperProps {
  mode?: 'linear3' | 'wizard4';
  steps: StepItem[];
  currentStep: string;
  completedSteps?: string[];
  skippedSteps?: string[];
  className?: string;
}

function cx(...classes: Array<string | null | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export default function WorkflowStepper({
  mode,
  steps,
  currentStep,
  completedSteps,
  skippedSteps,
  className,
}: WorkflowStepperProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentStep);
  const completedSet = new Set(completedSteps);
  const skippedSet = new Set(skippedSteps);

  for (let i = 0; i < currentIndex; i += 1) {
    completedSet.add(steps[i].key);
  }

  return (
    <nav className={cx('flex items-center gap-2 text-sm', className)} aria-label="Workflow progress">
      {steps.map((step, index) => {
        const isCurrent = step.key === currentStep;
        const isCompleted = completedSet.has(step.key);
        const isSkipped = skippedSet.has(step.key);

        return (
          <div key={step.key} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={cx(
                  mode === 'wizard4' ? 'hidden sm:block' : '',
                  'h-px w-8',
                  isCompleted || isCurrent ? 'bg-indigo-400' : 'bg-gray-300',
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={cx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isCompleted
                    ? 'bg-indigo-600 text-white'
                    : isCurrent
                      ? 'border-2 border-indigo-600 text-indigo-600'
                      : 'border border-gray-300 text-gray-400',
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cx(
                  mode === 'wizard4' ? 'hidden sm:inline' : '',
                  'text-xs font-medium',
                  isCurrent
                    ? 'text-indigo-600'
                    : isCompleted
                      ? 'text-gray-700'
                      : 'text-gray-500',
                  isSkipped && 'line-through',
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
