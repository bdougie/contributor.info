// @ts-check
/**
 * Stat Card Widget Generation Function
 * 
 * Generates embeddable stat cards showing repository metrics in a compact, visually appealing format.
 * Designed to be embedded in README files, documentation, and websites.
 * Shows data from the last 30 days.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Utility functions
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(num) {
  if (num === null || num === undefined) {
    return '-';
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Fetch real repository statistics from database (last 30 days)
async function fetchRepoStats(owner, repo) {
  try {
    // Get repository data
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, description, language')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      console.error('Repository not found:', owner, repo);
      return null;
    }

    const repositoryId = repoData.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch PR data from last 30 days
    const { data: prData, error: prError } = await supabase
      .from('pull_requests')
      .select('id, merged, created_at, author_id')
      .eq('repository_id', repositoryId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (prError) {
      console.error('Error fetching PR data:', prError);
      return null;
    }

    // Calculate stats
    const uniqueContributors = new Set(prData?.map(pr => pr.author_id) || []);
    const totalPRs = prData?.length || 0;
    const mergedPRs = prData?.filter(pr => pr.merged).length || 0;
    
    // Calculate weekly PR volume (last 7 days)
    const weeklyPRs = prData?.filter(pr => new Date(pr.created_at) >= sevenDaysAgo).length || 0;
    
    // Calculate active contributors (contributed in last 7 days)
    const recentPRs = prData?.filter(pr => new Date(pr.created_at) >= sevenDaysAgo) || [];
    const activeContributors = new Set(recentPRs.map(pr => pr.author_id)).size;

    // Calculate lottery factor (simplified)
    const contributorPRCounts = {};
    prData?.forEach(pr => {
      contributorPRCounts[pr.author_id] = (contributorPRCounts[pr.author_id] || 0) + 1;
    });
    
    const sortedContributors = Object.values(contributorPRCounts).sort((a, b) => b - a);
    const topContributorPRs = sortedContributors[0] || 0;
    const lotteryFactor = totalPRs > 0 ? (topContributorPRs / totalPRs) * 10 : 0;
    
    // Determine lottery rating
    let lotteryRating = 'N/A';
    if (lotteryFactor > 0) {
      if (lotteryFactor < 2) lotteryRating = 'Excellent';
      else if (lotteryFactor < 3) lotteryRating = 'Good';
      else if (lotteryFactor < 4) lotteryRating = 'Fair';
      else lotteryRating = 'Poor';
    }

    return {
      description: repoData.description || `${repo} repository`,
      language: repoData.language || 'Unknown',
      contributors: uniqueContributors.size,
      pullRequests: totalPRs,
      mergedPRs: mergedPRs,
      lotteryFactor: lotteryFactor,
      lotteryRating: lotteryRating,
      weeklyPRVolume: weeklyPRs,
      activeContributors: activeContributors,
    };
  } catch (error) {
    console.error('Error fetching repository stats:', error);
    return null;
  }
}

// Generate error/no-data stats when database is unavailable
function generateErrorStats(repo) {
  return {
    description: `${repo} repository`,
    language: 'Unknown',
    contributors: null,
    pullRequests: null,
    mergedPRs: null,
    lotteryFactor: null,
    lotteryRating: 'N/A',
    weeklyPRVolume: null,
    activeContributors: null,
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
  const mergeRate = stats.pullRequests > 0 ? (stats.mergedPRs / stats.pullRequests) * 100 : null;

  // Metric configurations with time context
  const metricConfigs = {
    contributors: {
      label: 'Contributors (30d)',
      value: formatNumber(stats.contributors),
      icon: '👥',
      color: stats.contributors !== null ? themeColors.metricColors.contributors : themeColors.muted
    },
    'pull-requests': {
      label: 'Pull Requests (30d)',
      value: formatNumber(stats.pullRequests),
      icon: '🔀',
      color: stats.pullRequests !== null ? themeColors.metricColors['pull-requests'] : themeColors.muted
    },
    'lottery-factor': {
      label: 'Lottery Factor (30d)',
      value: stats.lotteryFactor !== null ? stats.lotteryFactor.toFixed(1) : '-',
      subtext: stats.lotteryRating,
      icon: '🎯',
      color: stats.lotteryFactor !== null ? themeColors.metricColors['lottery-factor'] : themeColors.muted
    },
    'merge-rate': {
      label: 'Merge Rate (30d)',
      value: mergeRate !== null ? `${mergeRate.toFixed(1)}%` : '-',
      icon: '📈',
      color: mergeRate !== null ? themeColors.metricColors['merge-rate'] : themeColors.muted
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

  // Show data status message if no data
  const dataStatusMessage = stats.contributors === null ? 
    `<text x="${width / 2}" y="${height / 2 + 20}" font-size="${fontSize}" fill="${themeColors.muted}" text-anchor="middle" opacity="0.7">
      Data unavailable
    </text>` : '';

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

  ${dataStatusMessage}

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

    // Try to fetch real data from database
    let stats = await fetchRepoStats(owner, repo);
    
    // Show error state if database query fails
    if (!stats) {
      console.log(`No data available for ${owner}/${repo} - showing error state`);
      stats = generateErrorStats(repo);
    } else {
      console.log(`Using real data for ${owner}/${repo}`);
    }
    
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
        'X-Data-Source': stats.contributors !== null ? 'database' : 'unavailable',
        'X-Time-Range': '30-days'
      }
    });

  } catch (error) {
    console.error('Stat card generation error:', error);
    
    // Fallback card
    const fallbackSvg = generateStatCardSVG('error', 'unavailable', generateErrorStats('unavailable'));
    
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