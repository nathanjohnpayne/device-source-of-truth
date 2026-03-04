export function normalizeAnalyticsParams(
  params?: Record<string, string | number | boolean | undefined>,
): Record<string, string | number> | undefined {
  if (!params) return undefined;

  const normalized = Object.entries(params).reduce<Record<string, string | number>>(
    (acc, [key, value]) => {
      if (value === undefined || value === null) return acc;
      if (typeof value === 'boolean') {
        acc[key] = value ? 1 : 0;
        return acc;
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) return acc;
        acc[key] = value;
        return acc;
      }
      if (typeof value === 'string') {
        acc[key] = value;
      }
      return acc;
    },
    {},
  );

  return Object.keys(normalized).length ? normalized : undefined;
}
