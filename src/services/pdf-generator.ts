/**
 * PDF Generator for Workspace Analytics
 * Uses jsPDF for PDF generation (library needs to be installed separately)
 */

import type { AnalyticsData } from '@/components/features/workspace/AnalyticsDashboard';

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

/**
 * Generate PDF from analytics data
 * This is a placeholder implementation that generates a simple HTML-based PDF
 * For production, consider using a proper PDF generation library like jsPDF or pdfmake
 */
export async function generatePDF(
  data: AnalyticsData,
  options: ExportOptions
): Promise<Blob> {
  // For now, we'll create an HTML representation and convert it to PDF
  // In production, you'd want to use a proper PDF library
  
  const html = generateHTMLReport(data, options);
  
  // Create a blob from the HTML content
  // In a real implementation, you'd use a library to convert HTML to PDF
  return new Blob([html], { type: 'text/html' });
}

/**
 * Generate HTML report from analytics data
 */
function generateHTMLReport(data: AnalyticsData, options: ExportOptions): string {
  const styles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2, h3 {
        color: #1a1a1a;
      }
      h1 {
        border-bottom: 2px solid #3b82f6;
        padding-bottom: 10px;
      }
      h2 {
        margin-top: 30px;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 5px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th, td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid #e5e7eb;
      }
      th {
        background-color: #f3f4f6;
        font-weight: 600;
      }
      tr:hover {
        background-color: #f9fafb;
      }
      .stat-card {
        display: inline-block;
        padding: 15px;
        margin: 10px;
        background: #f3f4f6;
        border-radius: 8px;
        min-width: 150px;
      }
      .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #3b82f6;
      }
      .stat-label {
        font-size: 14px;
        color: #6b7280;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .badge-pr { background: #dbeafe; color: #1e40af; }
      .badge-issue { background: #fef3c7; color: #92400e; }
      .badge-commit { background: #d1fae5; color: #065f46; }
      .badge-review { background: #ede9fe; color: #5b21b6; }
      .trend-up { color: #10b981; }
      .trend-down { color: #ef4444; }
      @media print {
        body { padding: 0; }
        h1 { page-break-after: avoid; }
        table { page-break-inside: avoid; }
      }
    </style>
  `;

  let content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${options.workspaceName} - Analytics Report</title>
      ${styles}
    </head>
    <body>
      <h1>${options.workspaceName} - Analytics Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
  `;

  if (options.dateRange) {
    content += `
      <p>Date Range: ${options.dateRange.start.toLocaleDateString()} - ${options.dateRange.end.toLocaleDateString()}</p>
    `;
  }

  // Summary Statistics
  content += `
    <h2>Summary Statistics</h2>
    <div>
      <div class="stat-card">
        <div class="stat-value">${data.contributors.length}</div>
        <div class="stat-label">Total Contributors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.activities.length}</div>
        <div class="stat-label">Total Activities</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.repositories.length}</div>
        <div class="stat-label">Repositories</div>
      </div>
    </div>
  `;

  // Top Contributors
  if (options.includeContributors !== false && data.contributors.length > 0) {
    content += `
      <h2>Top Contributors</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Contributions</th>
            <th>Pull Requests</th>
            <th>Issues</th>
            <th>Reviews</th>
            <th>Commits</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.contributors
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 20)
      .forEach((contributor, index) => {
        let trend = '-';
        if (contributor.trend) {
          if (contributor.trend > 0) {
            trend = `<span class="trend-up">+${contributor.trend}%</span>`;
          } else {
            trend = `<span class="trend-down">${contributor.trend}%</span>`;
          }
        }

        content += `
          <tr>
            <td>${index + 1}</td>
            <td>${contributor.username}</td>
            <td><strong>${contributor.contributions}</strong></td>
            <td>${contributor.pull_requests}</td>
            <td>${contributor.issues}</td>
            <td>${contributor.reviews}</td>
            <td>${contributor.commits}</td>
            <td>${trend}</td>
          </tr>
        `;
      });

    content += `
        </tbody>
      </table>
    `;
  }

  // Repository Metrics
  if (options.includeRepositories !== false && data.repositories.length > 0) {
    content += `
      <h2>Repository Metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Stars</th>
            <th>Forks</th>
            <th>Pull Requests</th>
            <th>Issues</th>
            <th>Contributors</th>
            <th>Activity Score</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.repositories.forEach((repo) => {
      content += `
        <tr>
          <td><strong>${repo.owner}/${repo.name}</strong></td>
          <td>${repo.stars.toLocaleString()}</td>
          <td>${repo.forks.toLocaleString()}</td>
          <td>${repo.pull_requests.toLocaleString()}</td>
          <td>${repo.issues.toLocaleString()}</td>
          <td>${repo.contributors.toLocaleString()}</td>
          <td>${repo.activity_score}</td>
        </tr>
      `;
    });

    content += `
        </tbody>
      </table>
    `;
  }

  // Recent Activities
  if (options.includeActivities !== false && data.activities.length > 0) {
    content += `
      <h2>Recent Activities (Last 50)</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Title</th>
            <th>Author</th>
            <th>Repository</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.activities.slice(0, 50).forEach((activity) => {
      const typeClass = `badge-${activity.type}`;
      content += `
        <tr>
          <td><span class="badge ${typeClass}">${activity.type.toUpperCase()}</span></td>
          <td>${activity.title}</td>
          <td>${activity.author.username}</td>
          <td>${activity.repository}</td>
          <td>${new Date(activity.created_at).toLocaleDateString()}</td>
        </tr>
      `;
    });

    content += `
        </tbody>
      </table>
    `;
  }

  content += `
    </body>
    </html>
  `;

  return content;
}