#!/usr/bin/env node

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const hasRg = (() => {
  try {
    execFileSync('rg', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const baselinePath = 'config/ui-consistency-baseline.json';
const writeBaseline = process.argv.includes('--write-baseline');

const checks = [
  {
    key: 'no-alert',
    description: 'Use InlineNotice/Modal messaging instead of browser alert()',
    pattern: 'alert\\(',
  },
  {
    key: 'no-direct-locale-date',
    description: 'Use shared formatDate() instead of toLocaleDateString()',
    pattern: 'toLocaleDateString\\(',
    excludes: [/^src\/lib\/format\.ts$/],
  },
  {
    key: 'no-direct-locale-datetime',
    description: 'Use shared formatDateTime()/formatNumber() instead of toLocaleString()',
    pattern: 'toLocaleString\\(',
    excludes: [/^src\/lib\/format\.ts$/],
  },
  {
    key: 'no-rounded-md-drift',
    description: 'Avoid rounded-md drift on application UI controls',
    pattern: 'rounded-md',
    excludes: [/^src\/components\/shared\/Tooltip\.tsx$/],
  },
  {
    key: 'no-blue-primary-actions',
    description: 'Use indigo token for primary actions (semantic blue in data visuals is allowlisted)',
    pattern: 'bg-blue-600|hover:bg-blue-700',
  },
];

function runSearch(pattern) {
  try {
    if (hasRg) {
      return execFileSync(
        'rg',
        ['-n', '--no-heading', '--glob', '*.ts', '--glob', '*.tsx', '--glob', '*.css', pattern, 'src'],
        { encoding: 'utf8' },
      ).trim();
    }
    return execSync(
      `grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -E '${pattern}' src`,
      { encoding: 'utf8' },
    ).trim();
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
      return '';
    }
    throw error;
  }
}

function collectCounts(check) {
  const output = runSearch(check.pattern);
  if (!output) return {};

  const counts = {};
  for (const line of output.split('\n')) {
    const [filePath] = line.split(':');
    if (!filePath) continue;

    const normalizedPath = filePath.replaceAll('\\\\', '/');
    if (check.excludes?.some((regex) => regex.test(normalizedPath))) {
      continue;
    }

    counts[normalizedPath] = (counts[normalizedPath] ?? 0) + 1;
  }

  return counts;
}

const current = Object.fromEntries(checks.map((check) => [check.key, collectCounts(check)]));

if (writeBaseline) {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    checks: current,
  };

  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote UI consistency baseline to ${baselinePath}`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing baseline file at ${baselinePath}`);
  console.error('Run: npm run ui:consistency:baseline');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const baselineChecks = baseline.checks ?? {};

const failures = [];

for (const check of checks) {
  const currentCounts = current[check.key] ?? {};
  const baselineCounts = baselineChecks[check.key] ?? {};

  for (const [filePath, count] of Object.entries(currentCounts)) {
    const baselineCount = baselineCounts[filePath] ?? 0;
    if (count > baselineCount) {
      failures.push({
        check: check.key,
        description: check.description,
        filePath,
        count,
        baselineCount,
      });
    }
  }
}

if (failures.length > 0) {
  console.error('UI consistency check failed. New drift introduced:');

  for (const failure of failures) {
    console.error(
      `- [${failure.check}] ${failure.filePath}: ${failure.count} (baseline ${failure.baselineCount})`,
    );
  }

  console.error('\nFix the drift, or if this is an intentional migration step, update baseline with:');
  console.error('npm run ui:consistency:baseline');
  process.exit(1);
}

console.log('UI consistency check passed. No new drift beyond baseline.');
