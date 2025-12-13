/**
 * Chart HTML Builder
 *
 * Generates standalone HTML pages with Chart.js for Playwright rendering.
 * Each chart type has a specific template with inline styles.
 */

const CHART_WIDTH = 1200;
const CHART_HEIGHT = 630;

// Brand colors
const COLORS = {
  background: '#0A0A0A',
  cardBackground: '#18181B',
  text: '#FAFAFA',
  textMuted: '#A1A1AA',
  primary: '#FF5402',
  primaryMuted: '#FF7A3D',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  border: '#27272A',
};

/**
 * Generate base HTML wrapper
 */
function baseTemplate(content, title) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${CHART_WIDTH}, height=${CHART_HEIGHT}">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: ${COLORS.background};
      color: ${COLORS.text};
      width: ${CHART_WIDTH}px;
      height: ${CHART_HEIGHT}px;
      overflow: hidden;
    }

    .container {
      width: 100%;
      height: 100%;
      padding: 40px;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo {
      font-size: 18px;
      font-weight: 600;
      color: ${COLORS.primary};
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .repo-name {
      font-size: 24px;
      font-weight: 700;
      color: ${COLORS.text};
    }

    .card {
      background: ${COLORS.cardBackground};
      border: 1px solid ${COLORS.border};
      border-radius: 16px;
      padding: 32px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .card-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .card-description {
      font-size: 16px;
      color: ${COLORS.textMuted};
      margin-bottom: 24px;
    }

    .metric-large {
      font-size: 72px;
      font-weight: 800;
      color: ${COLORS.primary};
      line-height: 1;
    }

    .metric-label {
      font-size: 18px;
      color: ${COLORS.textMuted};
      margin-top: 8px;
    }

    .progress-bar {
      width: 100%;
      height: 16px;
      background: ${COLORS.border};
      border-radius: 8px;
      overflow: hidden;
      margin: 16px 0;
    }

    .progress-fill {
      height: 100%;
      border-radius: 8px;
      transition: width 0.3s;
    }

    .stats-row {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      gap: 24px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
    }

    .stat-label {
      font-size: 14px;
      color: ${COLORS.textMuted};
    }

    .chart-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .contributor-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }

    .contributor-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }

    .contributor-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${COLORS.primary};
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
    }

    .contributor-info {
      flex: 1;
    }

    .contributor-name {
      font-weight: 600;
      font-size: 16px;
    }

    .contributor-prs {
      font-size: 14px;
      color: ${COLORS.textMuted};
    }

    .contributor-bar {
      width: 200px;
      height: 8px;
      background: ${COLORS.border};
      border-radius: 4px;
      overflow: hidden;
    }

    .contributor-bar-fill {
      height: 100%;
      background: ${COLORS.primary};
      border-radius: 4px;
    }

    .badge {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
    }

    .badge-healthy { background: ${COLORS.green}20; color: ${COLORS.green}; }
    .badge-warning { background: ${COLORS.yellow}20; color: ${COLORS.yellow}; }
    .badge-critical { background: ${COLORS.red}20; color: ${COLORS.red}; }

    .factors-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 24px;
    }

    .factor-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }

    .factor-score {
      font-size: 48px;
      font-weight: 800;
    }

    .factor-name {
      font-size: 16px;
      font-weight: 600;
      margin: 8px 0 4px;
    }

    .factor-description {
      font-size: 14px;
      color: ${COLORS.textMuted};
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>
`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build Self-Selection Rate chart HTML
 */
export function buildSelfSelectionHtml(data, owner, repo) {
  const externalRate = data.external_contribution_rate || 0;
  const title = `Self-Selection Rate - ${owner}/${repo}`;

  const content = `
    <div class="header">
      <div class="header-left">
        <span class="logo">contributor.info</span>
        <span class="repo-name">${escapeHtml(owner)}/${escapeHtml(repo)}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Self-Selection Rate
      </div>
      <div class="card-description">External vs internal contributions over the last ${data.analysis_period_days || 30} days</div>

      <div style="display: flex; align-items: center; gap: 48px;">
        <div style="text-align: center;">
          <div class="metric-large">${externalRate.toFixed(1)}%</div>
          <div class="metric-label">External Contributions</div>
        </div>

        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>External</span>
            <span>Internal</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${externalRate}%; background: linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryMuted});"></div>
          </div>
          <div style="display: flex; justify-content: space-between; color: ${COLORS.textMuted}; font-size: 14px;">
            <span>${data.external_prs || 0} PRs</span>
            <span>${data.internal_prs || 0} PRs</span>
          </div>
        </div>
      </div>

      <div class="stats-row" style="margin-top: auto;">
        <div class="stat-item">
          <div class="stat-value">${data.external_contributors || 0}</div>
          <div class="stat-label">External Contributors</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.internal_contributors || 0}</div>
          <div class="stat-label">Internal Contributors</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.total_prs || 0}</div>
          <div class="stat-label">Total PRs</div>
        </div>
      </div>
    </div>
  `;

  return baseTemplate(content, title);
}

/**
 * Build Lottery Factor chart HTML
 */
export function buildLotteryFactorHtml(data, owner, repo) {
  const factor = data.factor || 0;
  const status = data.status || 'warning';
  const title = `Lottery Factor - ${owner}/${repo}`;

  const badgeClass =
    status === 'healthy'
      ? 'badge-healthy'
      : status === 'warning'
        ? 'badge-warning'
        : 'badge-critical';
  const statusLabel =
    status === 'healthy' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Critical';

  const topContributors = (data.topContributors || []).slice(0, 5);

  const contributorListHtml = topContributors
    .map(
      (c, i) => `
    <div class="contributor-item">
      <div class="contributor-avatar" style="background: hsl(${(i * 60) % 360}, 70%, 50%);">
        ${escapeHtml(c.username?.charAt(0)?.toUpperCase() || '?')}
      </div>
      <div class="contributor-info">
        <div class="contributor-name">${escapeHtml(c.username || 'Unknown')}</div>
        <div class="contributor-prs">${c.prCount || 0} PRs</div>
      </div>
      <div style="font-weight: 600; color: ${COLORS.primary};">${c.percentage || 0}%</div>
      <div class="contributor-bar">
        <div class="contributor-bar-fill" style="width: ${c.percentage || 0}%;"></div>
      </div>
    </div>
  `
    )
    .join('');

  const content = `
    <div class="header">
      <div class="header-left">
        <span class="logo">contributor.info</span>
        <span class="repo-name">${escapeHtml(owner)}/${escapeHtml(repo)}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Lottery Factor
        <span class="badge ${badgeClass}">${statusLabel}</span>
      </div>
      <div class="card-description">Top contributor concentration risk</div>

      <div style="display: flex; gap: 48px; flex: 1;">
        <div style="text-align: center; display: flex; flex-direction: column; justify-content: center;">
          <div class="metric-large">${factor.toFixed(1)}%</div>
          <div class="metric-label">Top Contributor Share</div>
          <div style="margin-top: 24px; color: ${COLORS.textMuted}; font-size: 14px;">
            ${data.totalContributors || 0} contributors<br/>
            ${data.totalPRs || 0} total PRs
          </div>
        </div>

        <div class="contributor-list">
          ${contributorListHtml}
        </div>
      </div>
    </div>
  `;

  return baseTemplate(content, title);
}

/**
 * Build Health Factors chart HTML
 */
export function buildHealthFactorsHtml(data, owner, repo) {
  const overallScore = data.overallScore || 0;
  const factors = data.factors || [];
  const title = `Health Factors - ${owner}/${repo}`;

  const getScoreColor = (score) => {
    const s = parseInt(score);
    if (s >= 70) return COLORS.green;
    if (s >= 40) return COLORS.yellow;
    return COLORS.red;
  };

  const factorsHtml = factors
    .map(
      (f) => `
    <div class="factor-card">
      <div class="factor-score" style="color: ${getScoreColor(f.score)};">${f.score}</div>
      <div class="factor-name">${escapeHtml(f.name)}</div>
      <div class="factor-description">${escapeHtml(f.description)}</div>
    </div>
  `
    )
    .join('');

  const content = `
    <div class="header">
      <div class="header-left">
        <span class="logo">contributor.info</span>
        <span class="repo-name">${escapeHtml(owner)}/${escapeHtml(repo)}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        Repository Health
      </div>
      <div class="card-description">Health metrics over the last ${data.timeRange || 30} days</div>

      <div style="display: flex; align-items: center; gap: 48px;">
        <div style="text-align: center;">
          <div class="metric-large" style="color: ${getScoreColor(overallScore)};">${overallScore}</div>
          <div class="metric-label">Overall Score</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; justify-content: space-between; color: ${COLORS.textMuted};">
            <span>${data.mergedPRs || 0} merged</span>
            <span>${data.totalPRs || 0} total PRs</span>
          </div>
        </div>
      </div>

      <div class="factors-grid">
        ${factorsHtml}
      </div>
    </div>
  `;

  return baseTemplate(content, title);
}

/**
 * Build Distribution chart HTML
 */
export function buildDistributionHtml(data, owner, repo) {
  const distribution = data.distribution || [];
  const distributionType = data.distributionType || 'donut';
  const title = `PR Distribution - ${owner}/${repo}`;

  // Create chart data for Chart.js
  const chartData = JSON.stringify({
    labels: distribution.map((d) => d.name),
    datasets: [
      {
        data: distribution.map((d) => d.count),
        backgroundColor: distribution.map((d) => d.color),
        borderWidth: 0,
      },
    ],
  });

  const legendHtml = distribution
    .map(
      (d) => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
      <div style="width: 16px; height: 16px; border-radius: 4px; background: ${d.color};"></div>
      <div style="flex: 1;">
        <div style="font-weight: 600;">${escapeHtml(d.name)}</div>
        <div style="font-size: 14px; color: ${COLORS.textMuted};">${d.count} PRs (${d.percentage}%)</div>
      </div>
    </div>
  `
    )
    .join('');

  const chartType = distributionType === 'bar' ? 'bar' : 'doughnut';

  const content = `
    <div class="header">
      <div class="header-left">
        <span class="logo">contributor.info</span>
        <span class="repo-name">${escapeHtml(owner)}/${escapeHtml(repo)}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${COLORS.primary}" stroke-width="2">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
          <path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
        PR Size Distribution
      </div>
      <div class="card-description">Pull request sizes over the last ${data.timeRange || 30} days</div>

      <div style="display: flex; gap: 48px; flex: 1; align-items: center;">
        <div class="chart-container" style="width: 300px; height: 300px;">
          <canvas id="chart"></canvas>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
          ${legendHtml}
        </div>
      </div>
    </div>

    <script>
      const ctx = document.getElementById('chart').getContext('2d');
      new Chart(ctx, {
        type: '${chartType}',
        data: ${chartData},
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          ${chartType === 'doughnut' ? 'cutout: "60%",' : ''}
        }
      });
    </script>
  `;

  return baseTemplate(content, title);
}

/**
 * Build chart HTML based on type
 */
export function buildChartHtml(chartType, data, owner, repo) {
  switch (chartType) {
    case 'self-selection':
      return buildSelfSelectionHtml(data, owner, repo);
    case 'lottery-factor':
      return buildLotteryFactorHtml(data, owner, repo);
    case 'health-factors':
      return buildHealthFactorsHtml(data, owner, repo);
    case 'distribution':
      return buildDistributionHtml(data, owner, repo);
    default:
      throw new Error(`Unknown chart type: ${chartType}`);
  }
}
