// @ts-check
/**
 * Stat Card Widget Generation Function
 * 
 * Generates embeddable stat cards showing repository metrics in a compact, visually appealing format.
 * Designed to be embedded in README files, documentation, and websites.
 */

// Utility functions
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Generate repository statistics (mock data)
function generateRepoStats(owner, repo) {
  const knownRepos = {
    'facebook/react': {
      description: 'The library for web and native user interfaces',
      language: 'JavaScript',
      contributors: 1247,
      pullRequests: 8934,
      mergedPRs: 7456,
      lotteryFactor: 3.2,
      lotteryRating: 'Good',
      weeklyPRVolume: 67,
      activeContributors: 342,
    },
    'microsoft/vscode': {
      description: 'Visual Studio Code',
      language: 'TypeScript',
      contributors: 1890,
      pullRequests: 12456,
      mergedPRs: 11103,
      lotteryFactor: 2.8,
      lotteryRating: 'Excellent', 
      weeklyPRVolume: 89,
      activeContributors: 567,
    },
    'vuejs/vue': {
      description: 'The Progressive JavaScript Framework',
      language: 'TypeScript',
      contributors: 456,
      pullRequests: 2134,
      mergedPRs: 1957,
      lotteryFactor: 3.8,
      lotteryRating: 'Fair',
      weeklyPRVolume: 28,
      activeContributors: 124,
    }
  };

  const key = `${owner}/${repo}`;
  if (knownRepos[key]) {
    return knownRepos[key];
  }

  // Generate realistic mock data
  const contributors = Math.floor(Math.random() * 200) + 10;
  const pullRequests = Math.floor(Math.random() * 1000) + 50;
  const mergedPRs = Math.floor(pullRequests * (0.7 + Math.random() * 0.25));
  
  return {
    description: `${repo} repository`,
    language: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go'][Math.floor(Math.random() * 5)],
    contributors,
    pullRequests,
    mergedPRs,
    lotteryFactor: Math.random() * 3 + 1.5,
    lotteryRating: ['Poor', 'Fair', 'Good', 'Excellent'][Math.floor(Math.random() * 4)],
    weeklyPRVolume: Math.floor(pullRequests / 20),
    activeContributors: Math.floor(contributors * 0.3),
  };
}

// Generate stat card SVG
function generateStatCardSVG(owner, repo, stats, options = {}) {
  const {
    theme = 'light',
    size = 'medium',
    metrics = ['contributors', 'pull-requests', 'lottery-factor'],
    showLogo = true
  } = options;

  // Theme colors
  const themes = {
    light: {
      bg: '#ffffff',
      cardBg: '#ffffff',
      border: '#e1e5e9',
      text: '#24292f',
      muted: '#656d76',
      accent: '#FF5402',
      metricColors: {
        contributors: '#0969da',
        'pull-requests': '#1a7f37',
        'lottery-factor': '#d1242f',
        'merge-rate': '#8250df'
      }
    },
    dark: {
      bg: '#0d1117',
      cardBg: '#161b22',
      border: '#30363d',
      text: '#f0f6fc',
      muted: '#8b949e',
      accent: '#FF5402',
      metricColors: {
        contributors: '#58a6ff',
        'pull-requests': '#3fb950',
        'lottery-factor': '#f85149',
        'merge-rate': '#a5a5ff'
      }
    }
  };

  const themeColors = themes[theme] || themes.light;

  // Size configurations
  const sizes = {
    small: { width: 320, height: 140, fontSize: 12, titleSize: 16, padding: 12 },
    medium: { width: 400, height: 180, fontSize: 13, titleSize: 18, padding: 16 },
    large: { width: 500, height: 220, fontSize: 14, titleSize: 20, padding: 20 }
  };

  const sizeConfig = sizes[size] || sizes.medium;
  const { width, height, fontSize, titleSize, padding } = sizeConfig;

  // Calculate merge rate
  const mergeRate = stats.pullRequests > 0 ? (stats.mergedPRs / stats.pullRequests) * 100 : 0;

  // Metric configurations
  const metricConfigs = {
    contributors: {
      label: 'Contributors',
      value: formatNumber(stats.contributors),
      icon: '👥',
      color: themeColors.metricColors.contributors
    },
    'pull-requests': {
      label: 'Pull Requests',
      value: formatNumber(stats.pullRequests),
      icon: '🔀',
      color: themeColors.metricColors['pull-requests']
    },
    'lottery-factor': {
      label: 'Lottery Factor',
      value: stats.lotteryFactor.toFixed(1),
      subtext: stats.lotteryRating,
      icon: '🎯',
      color: themeColors.metricColors['lottery-factor']
    },
    'merge-rate': {
      label: 'Merge Rate',
      value: `${mergeRate.toFixed(1)}%`,
      icon: '📈',
      color: themeColors.metricColors['merge-rate']
    }
  };

  // Generate metrics display
  const displayMetrics = metrics.slice(0, 3).map(key => metricConfigs[key]).filter(Boolean);
  const metricsPerRow = displayMetrics.length <= 2 ? displayMetrics.length : 3;
  const metricWidth = (width - padding * 2) / metricsPerRow;

  const metricsHTML = displayMetrics.map((metric, index) => {
    const x = padding + (index % metricsPerRow) * metricWidth;
    const y = height - 60;

    return `
      <g transform="translate(${x}, ${y})">
        <text x="0" y="0" font-size="${fontSize + 1}" font-weight="bold" fill="${metric.color}">${metric.icon} ${metric.value}</text>
        <text x="0" y="${fontSize + 4}" font-size="${fontSize - 1}" fill="${themeColors.muted}">${metric.subtext || metric.label}</text>
      </g>
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .card-bg { fill: ${themeColors.cardBg}; }
      .border { stroke: ${themeColors.border}; stroke-width: 1; fill: none; }
      .title { fill: ${themeColors.text}; font-family: 'Segoe UI', system-ui, sans-serif; font-weight: 600; }
      .subtitle { fill: ${themeColors.muted}; font-family: 'Segoe UI', system-ui, sans-serif; }
      .metric-text { font-family: 'Segoe UI', system-ui, sans-serif; }
    </style>
  </defs>

  <!-- Card background -->
  <rect width="${width}" height="${height}" rx="8" class="card-bg"/>
  <rect width="${width}" height="${height}" rx="8" class="border"/>

  <!-- Header -->
  <g transform="translate(${padding}, ${padding})">
    ${showLogo ? `
      <g transform="translate(0, 0)">
        <text x="0" y="16" font-size="16">🌱</text>
        <text x="24" y="16" font-size="${fontSize}" class="subtitle">contributor.info</text>
      </g>
    ` : ''}
    
    <!-- Repository name -->
    <text x="0" y="${showLogo ? 45 : 25}" font-size="${titleSize}" class="title">${escapeHtml(owner)}/${escapeHtml(repo)}</text>
    
    <!-- Description -->
    <text x="0" y="${showLogo ? 65 : 45}" font-size="${fontSize}" class="subtitle">${escapeHtml(stats.description)}</text>
    
    <!-- Language badge -->
    <g transform="translate(${width - padding * 2 - 80}, ${showLogo ? 35 : 15})">
      <rect x="0" y="0" width="70" height="18" rx="9" fill="${themeColors.accent}"/>
      <text x="35" y="13" font-size="11" font-weight="500" fill="white" text-anchor="middle" class="metric-text">${escapeHtml(stats.language)}</text>
    </g>
  </g>

  <!-- Metrics -->
  <g class="metric-text">
    ${metricsHTML}
  </g>

  <!-- Attribution -->
  ${showLogo ? `
    <text x="${width / 2}" y="${height - 8}" font-size="10" fill="${themeColors.muted}" text-anchor="middle" class="subtitle">
      Powered by contributor.info
    </text>
  ` : ''}
</svg>`;
}

export default async (req, context) => {
  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const owner = url.searchParams.get('owner') || 'facebook';
    const repo = url.searchParams.get('repo') || 'react';
    const theme = url.searchParams.get('theme') || 'light';
    const size = url.searchParams.get('size') || 'medium';
    const metrics = url.searchParams.get('metrics')?.split(',') || ['contributors', 'pull-requests', 'lottery-factor'];
    const showLogo = url.searchParams.get('logo') !== 'false';

    // Generate repository statistics
    const stats = generateRepoStats(owner, repo);
    
    // Generate SVG
    const svg = generateStatCardSVG(owner, repo, stats, {
      theme,
      size,
      metrics,
      showLogo
    });
    
    const endTime = Date.now();
    console.log(`Stat card generated in ${endTime - startTime}ms for ${owner}/${repo}`);

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1h cache
        'Access-Control-Allow-Origin': '*',
        'X-Generation-Time': `${endTime - startTime}ms`,
        'X-Repository': `${owner}/${repo}`,
        'X-Widget-Type': 'stat-card',
      }
    });

  } catch (error) {
    console.error('Stat card generation error:', error);
    
    // Fallback card
    const fallbackSvg = generateStatCardSVG('error', 'unavailable', {
      description: 'Widget generation failed',
      language: 'Unknown',
      contributors: 0,
      pullRequests: 0,
      mergedPRs: 0,
      lotteryFactor: 0,
      lotteryRating: 'N/A',
      weeklyPRVolume: 0,
      activeContributors: 0,
    });
    
    return new Response(fallbackSvg, {
      status: 500,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

export const config = {
  path: "/api/widgets/stat-card"
};