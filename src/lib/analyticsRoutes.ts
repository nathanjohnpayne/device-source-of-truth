// Ordering matters: keep specific static routes before dynamic catch-alls
// (e.g. "/admin/questionnaires/upload" must be checked before "/admin/questionnaires/:id").
const ANALYTICS_ROUTES: Array<{ pattern: RegExp; pagePath: string; pageTitle: string }> = [
  { pattern: /^\/$/, pagePath: '/', pageTitle: 'Dashboard' },
  { pattern: /^\/login$/, pagePath: '/login', pageTitle: 'Login' },
  { pattern: /^\/devices$/, pagePath: '/devices', pageTitle: 'Devices' },
  { pattern: /^\/devices\/new$/, pagePath: '/devices/new', pageTitle: 'Devices / New' },
  { pattern: /^\/devices\/[^/]+$/, pagePath: '/devices/:id', pageTitle: 'Devices / Detail' },
  {
    pattern: /^\/devices\/[^/]+\/specs\/edit$/,
    pagePath: '/devices/:id/specs/edit',
    pageTitle: 'Devices / Specs / Edit',
  },
  { pattern: /^\/partners$/, pagePath: '/partners', pageTitle: 'Partners' },
  { pattern: /^\/partners\/[^/]+$/, pagePath: '/partners/:id', pageTitle: 'Partners / Detail' },
  { pattern: /^\/tiers$/, pagePath: '/tiers', pageTitle: 'Tiers' },
  { pattern: /^\/tiers\/configure$/, pagePath: '/tiers/configure', pageTitle: 'Tiers / Configure' },
  { pattern: /^\/tiers\/simulate$/, pagePath: '/tiers/simulate', pageTitle: 'Tiers / Simulate' },
  { pattern: /^\/reports\/coverage$/, pagePath: '/reports/coverage', pageTitle: 'Reports / Coverage' },
  { pattern: /^\/admin$/, pagePath: '/admin', pageTitle: 'Admin' },
  { pattern: /^\/admin\/upload$/, pagePath: '/admin/upload', pageTitle: 'Admin / Upload' },
  { pattern: /^\/admin\/alerts$/, pagePath: '/admin/alerts', pageTitle: 'Admin / Alerts' },
  { pattern: /^\/admin\/audit$/, pagePath: '/admin/audit', pageTitle: 'Admin / Audit' },
  { pattern: /^\/admin\/migration$/, pagePath: '/admin/migration', pageTitle: 'Admin / Migration' },
  { pattern: /^\/admin\/readiness$/, pagePath: '/admin/readiness', pageTitle: 'Admin / Readiness' },
  {
    pattern: /^\/admin\/reference-data$/,
    pagePath: '/admin/reference-data',
    pageTitle: 'Admin / Reference Data',
  },
  {
    pattern: /^\/admin\/intake-import$/,
    pagePath: '/admin/intake-import',
    pageTitle: 'Admin / Intake Import',
  },
  {
    pattern: /^\/admin\/partner-keys$/,
    pagePath: '/admin/partner-keys',
    pageTitle: 'Admin / Partner Keys',
  },
  { pattern: /^\/admin\/danger$/, pagePath: '/admin/danger', pageTitle: 'Admin / Danger Zone' },
  {
    pattern: /^\/admin\/version-registry$/,
    pagePath: '/admin/version-registry',
    pageTitle: 'Admin / Version Registry',
  },
  {
    pattern: /^\/admin\/users$/,
    pagePath: '/admin/users',
    pageTitle: 'Admin / Users',
  },
  {
    pattern: /^\/admin\/questionnaires$/,
    pagePath: '/admin/questionnaires',
    pageTitle: 'Admin / Questionnaires',
  },
  {
    pattern: /^\/admin\/questionnaires\/upload$/,
    pagePath: '/admin/questionnaires/upload',
    pageTitle: 'Admin / Questionnaire Upload',
  },
  {
    pattern: /^\/admin\/questionnaires\/[^/]+$/,
    pagePath: '/admin/questionnaires/:id',
    pageTitle: 'Admin / Questionnaire Detail',
  },
  {
    pattern: /^\/admin\/questionnaires\/[^/]+\/review$/,
    pagePath: '/admin/questionnaires/:id/review',
    pageTitle: 'Admin / Questionnaire Review',
  },
];

export function resolveAnalyticsRoute(pathname: string): { pagePath: string; pageTitle: string } {
  const matched = ANALYTICS_ROUTES.find(({ pattern }) => pattern.test(pathname));
  if (matched) return { pagePath: matched.pagePath, pageTitle: matched.pageTitle };

  const pageTitle = pathname === '/'
    ? 'Dashboard'
    : pathname
        .split('/')
        .filter(Boolean)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' / ');

  return { pagePath: pathname, pageTitle };
}
