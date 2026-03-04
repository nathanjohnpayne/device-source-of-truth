import { describe, expect, it } from 'vitest';
import { normalizeAnalyticsParams } from '../../lib/analyticsParams';

describe('normalizeAnalyticsParams', () => {
  it('returns undefined when params are empty or omitted', () => {
    expect(normalizeAnalyticsParams()).toBeUndefined();
    expect(normalizeAnalyticsParams({ a: undefined })).toBeUndefined();
  });

  it('preserves strings and finite numbers', () => {
    expect(
      normalizeAnalyticsParams({
        event_type: 'test',
        result_count: 3,
      }),
    ).toEqual({
      event_type: 'test',
      result_count: 3,
    });
  });

  it('converts booleans to numeric flags', () => {
    expect(
      normalizeAnalyticsParams({
        fallback: true,
        ai_used: false,
      }),
    ).toEqual({
      fallback: 1,
      ai_used: 0,
    });
  });

  it('drops unsupported and invalid numeric values', () => {
    expect(
      normalizeAnalyticsParams({
        count: Number.NaN,
        score: Number.POSITIVE_INFINITY,
        query_length: 5,
      }),
    ).toEqual({
      query_length: 5,
    });
  });
});
