/**
 * Workspace Export Service
 * Handles exporting workspace analytics data in various formats
 */

import type {
  ActivityItem,
  ContributorStat,
  RepositoryMetric,
  TrendDataset,
  AnalyticsData,
} from '@/components/features/workspace/AnalyticsDashboard';
import { toDateOnlyString, toUTCTimestamp } from '../lib/utils/date-formatting';

export type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportOptions {
  workspaceName: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeActivities?: boolean;
  includeContributors?: boolean;
  includeRepositories?: boolean;
  includeTrends?: boolean;
}

export class WorkspaceExportService {
  /**
   * Export analytics data in the specified format
   */
  static async exportData(
    data: AnalyticsData,
    format: ExportFormat,
    options: ExportOptions
  ): Promise<Blob> {
    switch (format) {
      case 'csv':
        return this.exportToCSV(data, options);
      case 'json':
        return this.exportToJSON(data, options);
      case 'pdf':
        return this.exportToPDF(data, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export data as CSV
   */
  private static async exportToCSV(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    const sections: string[] = [];

    // Header
    sections.push(`Workspace Analytics Export - ${options.workspaceName}`);
    if (options.dateRange) {
      sections.push(
        `Date Range: ${options.dateRange.start.toLocaleDateString()} - ${options.dateRange.end.toLocaleDateString()}`
      );
    }
    sections.push(''); // Empty line

    // Activities Section
    if (options.includeActivities !== false && data.activities.length > 0) {
      sections.push('ACTIVITIES');
      sections.push(this.activitiesToCSV(data.activities));
      sections.push(''); // Empty line
    }

    // Contributors Section
    if (options.includeContributors !== false && data.contributors.length > 0) {
      sections.push('CONTRIBUTORS');
      sections.push(this.contributorsToCSV(data.contributors));
      sections.push(''); // Empty line
    }

    // Repositories Section
    if (options.includeRepositories !== false && data.repositories.length > 0) {
      sections.push('REPOSITORIES');
      sections.push(this.repositoriesToCSV(data.repositories));
      sections.push(''); // Empty line
    }

    // Trends Section
    if (options.includeTrends !== false && data.trends.length > 0) {
      sections.push('TRENDS');
      sections.push(this.trendsToCSV(data.trends));
    }

    const csvContent = sections.join('\n');
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Convert activities to CSV format
   */
  private static activitiesToCSV(activities: ActivityItem[]): string {
    const headers = ['Type', 'Title', 'Author', 'Repository', 'Status', 'Created At', 'URL'];
    const rows = activities.map((activity) => [
      activity.type,
      `"${activity.title.replace(/"/g, '""')}"`, // Escape quotes
      activity.author.username,
      activity.repository,
      activity.status || '',
      activity.created_at,
      activity.url || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Convert contributors to CSV format
   */
  private static contributorsToCSV(contributors: ContributorStat[]): string {
    const headers = [
      'Username',
      'Total Contributions',
      'Pull Requests',
      'Issues',
      'Reviews',
      'Commits',
      'Trend %',
    ];
    const rows = contributors.map((contributor) => [
      contributor.username,
      contributor.contributions,
      contributor.pull_requests,
      contributor.issues,
      contributor.reviews,
      contributor.commits,
      contributor.trend || 0,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Convert repositories to CSV format
   */
  private static repositoriesToCSV(repositories: RepositoryMetric[]): string {
    const headers = [
      'Repository',
      'Stars',
      'Forks',
      'Pull Requests',
      'Issues',
      'Contributors',
      'Activity Score',
      'Trend %',
    ];
    const rows = repositories.map((repo) => [
      `${repo.owner}/${repo.name}`,
      repo.stars,
      repo.forks,
      repo.pull_requests,
      repo.issues,
      repo.contributors,
      repo.activity_score,
      repo.trend || 0,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Convert trends to CSV format
   */
  private static trendsToCSV(trends: TrendDataset[]): string {
    if (trends.length === 0) return '';

    // Get all unique dates across all datasets
    const allDates = new Set<string>();
    trends.forEach((dataset) => {
      dataset.data.forEach((point) => allDates.add(point.date));
    });
    const sortedDates = Array.from(allDates).sort();

    // Create headers
    const headers = ['Date', ...trends.map((dataset) => dataset.label)];

    // Create rows
    const rows = sortedDates.map((date) => {
      const row = [date];
      trends.forEach((dataset) => {
        const point = dataset.data.find((p) => p.date === date);
        row.push(String(point?.value || 0));
      });
      return row;
    });

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Export data as JSON
   */
  private static async exportToJSON(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    const exportData: Record<string, unknown> = {
      workspace: options.workspaceName,
      exportDate: toUTCTimestamp(new Date()),
    };

    if (options.dateRange) {
      exportData.dateRange = {
        start: toUTCTimestamp(options.dateRange.start),
        end: toUTCTimestamp(options.dateRange.end),
      };
    }

    if (options.includeActivities !== false) {
      exportData.activities = data.activities;
    }

    if (options.includeContributors !== false) {
      exportData.contributors = data.contributors;
    }

    if (options.includeRepositories !== false) {
      exportData.repositories = data.repositories;
    }

    if (options.includeTrends !== false) {
      exportData.trends = data.trends;
    }

    const jsonContent = JSON.stringify(exportData, null, 2);
    return new Blob([jsonContent], { type: 'application/json' });
  }

  /**
   * Export data as PDF
   * Note: This requires a PDF generation library like jsPDF or pdfmake
   * For now, this is a placeholder implementation
   */
  private static async exportToPDF(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    // Dynamic import to avoid loading heavy library unless needed
    const { generatePDF } = await import('./pdf-generator');

    return generatePDF(data, options);
  }

  /**
   * Trigger download of the exported file
   */
  static downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename based on format and timestamp
   */
  static generateFilename(workspaceName: string, format: ExportFormat): string {
    const timestamp = toDateOnlyString(new Date());
    const sanitizedName = workspaceName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `${sanitizedName}-analytics-${timestamp}.${format}`;
  }

  /**
   * Main export function that handles the complete export flow
   */
  static async export(
    data: AnalyticsData,
    format: ExportFormat,
    options: ExportOptions
  ): Promise<void> {
    try {
      const blob = await this.exportData(data, format, options);
      const filename = this.generateFilename(options.workspaceName, format);
      this.downloadFile(blob, filename);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Failed to export data as ${format}: ${error}`);
    }
  }
}
