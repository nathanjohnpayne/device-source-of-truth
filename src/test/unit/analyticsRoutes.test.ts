import { describe, expect, it } from 'vitest';
import { resolveAnalyticsRoute } from '../../lib/analyticsRoutes';

describe('resolveAnalyticsRoute', () => {
  it('maps static routes to stable analytics labels', () => {
    expect(resolveAnalyticsRoute('/')).toEqual({
      pagePath: '/',
      pageTitle: 'Dashboard',
    });
    expect(resolveAnalyticsRoute('/admin/reference-data')).toEqual({
      pagePath: '/admin/reference-data',
      pageTitle: 'Admin / Reference Data',
    });
    expect(resolveAnalyticsRoute('/admin/questionnaires/upload')).toEqual({
      pagePath: '/admin/questionnaires/upload',
      pageTitle: 'Admin / Questionnaire Upload',
    });
  });

  it('normalizes dynamic routes to route templates', () => {
    expect(resolveAnalyticsRoute('/devices/abc123')).toEqual({
      pagePath: '/devices/:id',
      pageTitle: 'Devices / Detail',
    });
    expect(resolveAnalyticsRoute('/admin/questionnaires/q_001/review')).toEqual({
      pagePath: '/admin/questionnaires/:id/review',
      pageTitle: 'Admin / Questionnaire Review',
    });
  });

  it('falls back to path-based title formatting for unknown routes', () => {
    expect(resolveAnalyticsRoute('/foo/bar')).toEqual({
      pagePath: '/foo/bar',
      pageTitle: 'Foo / Bar',
    });
  });
});
