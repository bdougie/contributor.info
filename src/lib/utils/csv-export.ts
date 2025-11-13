/**
 * CSV export utility functions
 */

import { unparse } from 'papaparse';
import type { Contributor } from '@/components/features/workspace/ContributorsList';

export interface ContributorCSVRow {
  Username: string;
  Name: string;
  'Pull Requests': number;
  Issues: number;
  Commits: number;
  'Repositories Contributed': number;
}

/**
 * Transforms contributor data into CSV-compatible format
 */
export function transformContributorsToCSV(contributors: Contributor[]): ContributorCSVRow[] {
  return contributors.map((contributor) => ({
    Username: contributor.username,
    Name: contributor.name || contributor.username,
    'Pull Requests': contributor.contributions.pull_requests,
    Issues: contributor.contributions.issues,
    Commits: contributor.contributions.commits,
    'Repositories Contributed': contributor.stats.repositories_contributed,
  }));
}

/**
 * Exports contributors to CSV file
 */
export function exportContributorsToCSV(
  contributors: Contributor[],
  filename = 'contributors.csv'
): void {
  const csvData = transformContributorsToCSV(contributors);
  const csv = unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
