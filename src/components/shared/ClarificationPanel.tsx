/**
 * DST-039: AI Disambiguation — Clarification Panel
 *
 * Batched UI for presenting all AI-generated clarification questions,
 * grouped by type (country, region, partner, other). Supports inline
 * answer controls and "apply to all similar rows" for bulk resolution.
 */

import { useState, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import Badge from './Badge';
import type {
  ClarificationQuestion,
  ClarificationAnswer,
  ClarificationQuestionType,
  DisambiguationFieldResult,
} from '../../lib/types';

interface ClarificationPanelProps {
  questions: ClarificationQuestion[];
  fields: DisambiguationFieldResult[];
  onSubmitAnswers: (answers: ClarificationAnswer[]) => void;
  onDismiss?: () => void;
  loading?: boolean;
  aiFallback?: boolean;
  fallbackReason?: string;
}

const GROUP_LABELS: Record<ClarificationQuestionType, string> = {
  country: 'Country Ambiguities',
  region: 'Region Ambiguities',
  partner: 'Partner Matching',
  date: 'Date Ambiguities',
  delimiter: 'Delimiter Detection',
  other: 'Other',
};

const GROUP_ORDER: ClarificationQuestionType[] = [
  'country', 'region', 'partner', 'date', 'delimiter', 'other',
];

export default function ClarificationPanel({
  questions,
  fields,
  onSubmitAnswers,
  onDismiss,
  loading = false,
  aiFallback = false,
  fallbackReason,
}: ClarificationPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [applyToAll, setApplyToAll] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<ClarificationQuestionType>>(
    new Set(GROUP_ORDER),
  );

  const grouped = useMemo(() => {
    const groups: Record<ClarificationQuestionType, ClarificationQuestion[]> = {
      country: [], region: [], partner: [], date: [], delimiter: [], other: [],
    };
    for (const q of questions) {
      groups[q.type].push(q);
    }
    return groups;
  }, [questions]);

  const patternGroups = useMemo(() => {
    const patterns: Record<string, ClarificationQuestion[]> = {};
    for (const q of questions) {
      if (!patterns[q.pattern]) patterns[q.pattern] = [];
      patterns[q.pattern].push(q);
    }
    return patterns;
  }, [questions]);

  const autoResolvedCount = fields.filter(f => !f.needsHuman && f.confidence >= 0.90).length;
  const verifyCount = fields.filter(f => !f.needsHuman && f.confidence >= 0.75 && f.confidence < 0.90).length;

  function handleAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  function handleApplyToAll(pattern: string, checked: boolean) {
    setApplyToAll(prev => ({ ...prev, [pattern]: checked }));
  }

  function toggleGroup(type: ClarificationQuestionType) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleSubmit() {
    const result: ClarificationAnswer[] = [];

    for (const q of questions) {
      const value = answers[q.id];
      if (!value) continue;

      const isApplyAll = applyToAll[q.pattern] ?? false;
      result.push({
        questionId: q.id,
        value,
        applyToAll: isApplyAll,
      });

      if (isApplyAll) {
        const siblings = patternGroups[q.pattern] ?? [];
        for (const sibling of siblings) {
          if (sibling.id !== q.id && !answers[sibling.id]) {
            result.push({
              questionId: sibling.id,
              value,
              applyToAll: false,
            });
          }
        }
      }
    }

    onSubmitAnswers(result);
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.every(q => answers[q.id]);

  if (questions.length === 0 && !aiFallback && autoResolvedCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            AI Disambiguation
          </h3>
          {autoResolvedCount > 0 && (
            <Badge variant="success">
              {autoResolvedCount} auto-resolved
            </Badge>
          )}
          {verifyCount > 0 && (
            <Badge variant="warning">
              {verifyCount} to verify
            </Badge>
          )}
          {questions.length > 0 && (
            <Badge variant="danger">
              {questions.length} need answers
            </Badge>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* AI Fallback Banner */}
      {aiFallback && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100 px-4 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-xs text-amber-800">
            AI disambiguation unavailable — falling back to standard validation.
            Flagged rows require manual review.
            {fallbackReason && (
              <span className="ml-1 text-amber-600">({fallbackReason})</span>
            )}
          </p>
        </div>
      )}

      {/* Auto-resolved summary */}
      {autoResolvedCount > 0 && questions.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm text-gray-700">
            All {autoResolvedCount} ambiguous fields were auto-resolved by AI.
            Review the badges in the preview table below.
          </p>
        </div>
      )}

      {/* Grouped Questions */}
      {GROUP_ORDER.map(type => {
        const group = grouped[type];
        if (group.length === 0) return null;

        const isExpanded = expandedGroups.has(type);

        return (
          <div key={type} className="border-b border-amber-100 last:border-b-0">
            <button
              onClick={() => toggleGroup(type)}
              className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-amber-50"
            >
              <span className="text-sm font-medium text-gray-800">
                {GROUP_LABELS[type]} ({group.length})
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="pb-1 pr-3 font-medium">Row</th>
                      <th className="pb-1 pr-3 font-medium">Question</th>
                      <th className="pb-1 pr-3 font-medium">Answer</th>
                      <th className="pb-1 font-medium">Apply All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(q => {
                      const hasSiblings = (patternGroups[q.pattern]?.length ?? 0) > 1;
                      const parentApplied = applyToAll[q.pattern] &&
                        patternGroups[q.pattern]?.[0]?.id !== q.id &&
                        answers[patternGroups[q.pattern]?.[0]?.id ?? ''];

                      return (
                        <tr
                          key={q.id}
                          className={`border-t border-amber-100 ${parentApplied ? 'opacity-50' : ''}`}
                        >
                          <td className="py-2 pr-3 text-gray-600">
                            {q.rowIndex + 1}
                          </td>
                          <td className="py-2 pr-3">
                            <p className="text-gray-800">{q.question}</p>
                            {q.suggestedValue && (
                              <p className="mt-0.5 text-xs text-indigo-600">
                                Suggested: {q.suggestedValue}
                              </p>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {parentApplied ? (
                              <span className="text-xs text-gray-500 italic">
                                Applied from row {(patternGroups[q.pattern]?.[0]?.rowIndex ?? 0) + 1}
                              </span>
                            ) : q.options ? (
                              <select
                                value={answers[q.id] ?? ''}
                                onChange={e => handleAnswer(q.id, e.target.value)}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Select…</option>
                                {q.options.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}{opt.suggested ? ' ★' : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={answers[q.id] ?? ''}
                                onChange={e => handleAnswer(q.id, e.target.value)}
                                placeholder="Enter value…"
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            )}
                          </td>
                          <td className="py-2">
                            {hasSiblings && patternGroups[q.pattern]?.[0]?.id === q.id && (
                              <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={applyToAll[q.pattern] ?? false}
                                  onChange={e => handleApplyToAll(q.pattern, e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                All ({patternGroups[q.pattern]?.length})
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Submit */}
      {questions.length > 0 && (
        <div className="flex items-center justify-between border-t border-amber-200 px-4 py-3">
          <p className="text-xs text-gray-500">
            {answeredCount} of {questions.length} answered
          </p>
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Resolving…' : 'Apply Answers'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Badge component for showing AI resolution status inline in preview tables.
 */
export function AIResolutionBadge({
  field,
  onClick,
}: {
  field: DisambiguationFieldResult;
  onClick?: () => void;
}) {
  if (field.confidence >= 0.90) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
        title={field.reasoning}
      >
        <Sparkles className="h-3 w-3" />
        AI resolved
      </button>
    );
  }

  if (field.confidence >= 0.75) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
        title={field.reasoning}
      >
        <Sparkles className="h-3 w-3" />
        AI resolved — verify
      </button>
    );
  }

  if (field.overriddenByAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Admin resolved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
      <AlertTriangle className="h-3 w-3" />
      Needs review
    </span>
  );
}
