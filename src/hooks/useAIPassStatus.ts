import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import type {
  ImportType,
  DisambiguationResponse,
  AIPassStep,
  AIPassStatus,
  AIPassState,
} from '../lib/types';

const INITIAL_STATE: AIPassState = {
  status: 'idle',
  currentStep: null,
  batchCount: null,
  completedSteps: new Set(),
  resolved: null,
  flagged: null,
  failureReason: null,
  failedFieldTypes: [],
};

const STEP_3_DELAY_MS = 800;
const SUCCESS_COLLAPSE_MS = 2000;

interface UseAIPassStatusReturn {
  passState: AIPassState;
  disambiguation: DisambiguationResponse | null;
  setDisambiguation: React.Dispatch<React.SetStateAction<DisambiguationResponse | null>>;
  runAIPass: (importType: ImportType, rows: Record<string, unknown>[], fieldTypeCount: number) => Promise<DisambiguationResponse | null>;
  restartAIPass: () => Promise<DisambiguationResponse | null>;
  resetPass: () => void;
  collapsed: boolean;
}

export function useAIPassStatus(): UseAIPassStatusReturn {
  const [passState, setPassState] = useState<AIPassState>(INITIAL_STATE);
  const [disambiguation, setDisambiguation] = useState<DisambiguationResponse | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const lastArgsRef = useRef<{ importType: ImportType; rows: Record<string, unknown>[]; fieldTypeCount: number } | null>(null);
  const step3TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (step3TimerRef.current) clearTimeout(step3TimerRef.current);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  const advanceTo = useCallback((step: AIPassStep, extra?: Partial<AIPassState>) => {
    setPassState(prev => ({
      ...prev,
      currentStep: step,
      completedSteps: new Set([...prev.completedSteps, ...Array.from({ length: step - 1 }, (_, i) => (i + 1) as AIPassStep)]),
      ...extra,
    }));
  }, []);

  const runAIPass = useCallback(async (
    importType: ImportType,
    rows: Record<string, unknown>[],
    fieldTypeCount: number,
  ): Promise<DisambiguationResponse | null> => {
    clearTimers();
    setCollapsed(false);
    lastArgsRef.current = { importType, rows, fieldTypeCount };

    setPassState({
      ...INITIAL_STATE,
      status: 'running',
      currentStep: 1,
      completedSteps: new Set(),
    });

    // Step 2: sending to AI
    await new Promise(r => setTimeout(r, 150));
    advanceTo(2, { batchCount: fieldTypeCount });

    // Step 3: processing responses — set on a delay to simulate backend processing
    step3TimerRef.current = setTimeout(() => {
      advanceTo(3);
    }, STEP_3_DELAY_MS);

    try {
      const aiResult = await api.disambiguation.disambiguate(importType, rows);

      clearTimers();

      if (aiResult.aiFallback && !aiResult.fieldTypeFallbacks?.length) {
        // Total failure — AI fell back entirely
        setPassState(prev => ({
          ...prev,
          status: 'failed',
          currentStep: null,
          failureReason: aiResult.fallbackReason ?? 'AI disambiguation could not complete.',
        }));
        setDisambiguation(aiResult);
        return aiResult;
      }

      if (aiResult.fieldTypeFallbacks && aiResult.fieldTypeFallbacks.length > 0) {
        // Partial failure
        const resolved = aiResult.fields.filter(f => !f.needsHuman).length;
        const flagged = aiResult.questions.length;

        advanceTo(4);
        await new Promise(r => setTimeout(r, 200));

        setPassState(prev => ({
          ...prev,
          status: 'partial_failure',
          currentStep: 5,
          completedSteps: new Set([1, 2, 3, 4, 5] as AIPassStep[]),
          resolved,
          flagged,
          failedFieldTypes: aiResult.fieldTypeFallbacks!,
        }));

        setDisambiguation(aiResult);

        trackEvent(`${importType}_ai_disambiguation`, {
          auto_resolved: resolved,
          questions: flagged,
          fallback: false,
          partial_failure: true,
        });

        collapseTimerRef.current = setTimeout(() => setCollapsed(true), SUCCESS_COLLAPSE_MS);
        return aiResult;
      }

      // Full success
      const resolved = aiResult.fields.filter(f => !f.needsHuman).length;
      const flagged = aiResult.questions.length;

      advanceTo(4);
      await new Promise(r => setTimeout(r, 200));

      setPassState(prev => ({
        ...prev,
        status: 'success',
        currentStep: 5,
        completedSteps: new Set([1, 2, 3, 4, 5] as AIPassStep[]),
        resolved,
        flagged,
      }));

      setDisambiguation(aiResult);

      trackEvent(`${importType}_ai_disambiguation`, {
        auto_resolved: resolved,
        questions: flagged,
        fallback: false,
      });

      collapseTimerRef.current = setTimeout(() => setCollapsed(true), SUCCESS_COLLAPSE_MS);
      return aiResult;
    } catch {
      clearTimers();

      const fallbackResult: DisambiguationResponse = {
        fields: [],
        questions: [],
        aiFallback: true,
        fallbackReason: 'AI disambiguation request failed',
      };

      setPassState(prev => ({
        ...prev,
        status: 'failed',
        currentStep: null,
        failureReason: 'AI disambiguation request failed. Your import is unaffected — rule-based validation will be applied instead.',
      }));

      setDisambiguation(fallbackResult);
      return fallbackResult;
    }
  }, [advanceTo, clearTimers]);

  const restartAIPass = useCallback(async (): Promise<DisambiguationResponse | null> => {
    if (!lastArgsRef.current) return null;
    const { importType, rows, fieldTypeCount } = lastArgsRef.current;
    return runAIPass(importType, rows, fieldTypeCount);
  }, [runAIPass]);

  const resetPass = useCallback(() => {
    clearTimers();
    setPassState(INITIAL_STATE);
    setDisambiguation(null);
    setCollapsed(false);
    lastArgsRef.current = null;
  }, [clearTimers]);

  return { passState, disambiguation, setDisambiguation, runAIPass, restartAIPass, resetPass, collapsed };
}
