// @ts-check
/**
 * Badge Widget Generation Function
 *
 * Generates SVG badges for repository statistics that can be embedded in README files.
 * Follows shields.io badge format standards for compatibility.
 * Shows data from the last 30 days.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client only if credentials are available
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Only create client if we have valid credentials
const supabase = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * Escapes text for safe inclusion in SVG/XML content
 * Prevents XSS attacks through user-controlled inputs
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for SVG
 */
function escapeXml(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // Remove any control characters that could break SVG
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  );
}

/**
 * Sanitizes color values to prevent CSS injection
 * @param {string} color - Color value to sanitize
 * @returns {string} Safe color value
 */
function sanitizeColor(color) {
  // Only allow hex colors (3, 4, 6, 8 digits), rgb/rgba with 0-255 range, and named colors
  const hexPattern = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  const rgbPattern =
    /^rgba?\(\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*(?:,\s*(?:0?\.[0-9]+|1(?:\.0+)?|0))?\)$/;
  const namedColors = [
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'purple',
    'gray',
    'black',
    'white',
  ];

  if (
    hexPattern.test(color) ||
    rgbPattern.test(color) ||
    namedColors.includes(color.toLowerCase())
  ) {
    return color;
  }

  // Default to safe color if invalid
  return '#007ec6';
}

// Badge generation utilities
function generateBadgeSVG(label, message, color = '#007ec6', style = 'flat') {
  // Escape all user inputs to prevent XSS
  const safeLabel = escapeXml(label);
  const safeMessage = escapeXml(message);
  const safeColor = sanitizeColor(color);
  // Calculate text widths based on escaped content to prevent truncation
  const labelWidth = Math.max(safeLabel.length * 6.5 + 10, 50);
  const messageWidth = Math.max(safeMessage.length * 6.5 + 10, 30);
  const totalWidth = labelWidth + messageWidth;
  const height = 20;

  // Style configurations
  const styles = {
    flat: { rx: 3 },
    'flat-square': { rx: 0 },
    plastic: { rx: 3, shadow: true },
    social: { rx: 4 },
  };

  const styleConfig = styles[style] || styles.flat;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
  ${
    styleConfig.shadow
      ? `<defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
    </filter>
  </defs>`
      : ''
  }
  
  <!-- Left background (label) -->
  <rect x="0" y="0" width="${labelWidth}" height="${height}" fill="#555" rx="${styleConfig.rx}"/>
  
  <!-- Right background (message) -->  
  <rect x="${labelWidth}" y="0" width="${messageWidth}" height="${height}" fill="${safeColor}" rx="${styleConfig.rx}"/>
  
  <!-- Left text (label) -->
  <text x="${labelWidth / 2}" y="14" 
        text-anchor="middle" 
        font-family="Verdana,Geneva,DejaVu Sans,sans-serif" 
        font-size="11" 
        fill="white">
    ${safeLabel}
  </text>
  
  <!-- Right text (message) -->
  <text x="${labelWidth + messageWidth / 2}" y="14" 
        text-anchor="middle" 
        font-family="Verdana,Geneva,DejaVu Sans,sans-serif" 
        font-size="11" 
        font-weight="bold"
        fill="white">
    ${safeMessage}
  </text>
</svg>`;
}

// Fetch real repository statistics from database (last 30 days)
async function fetchRepoStats(owner, repo) {
  // Skip database query if Supabase client is not available
  if (!supabase) {
    console.log('Supabase client not initialized - missing VITE_SUPABASE_ANON_KEY');
    return null;
  }

  try {
    // Get repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
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

    // Calculate stats from the last 30 days
    const uniqueContributors = new Set(prData?.map((pr) => pr.author_id) || []);
    const totalPRs = prData?.length || 0;
    const mergedPRs = prData?.filter((pr) => pr.merged).length || 0;
    const mergeRate = totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0;

    // Calculate lottery factor (simplified for last 30 days)
    const contributorPRCounts = {};
    prData?.forEach((pr) => {
      contributorPRCounts[pr.author_id] = (contributorPRCounts[pr.author_id] || 0) + 1;
    });

    const sortedContributors = Object.values(contributorPRCounts).sort((a, b) => b - a);
    const topContributorPRs = sortedContributors[0] || 0;
    const lotteryFactor = totalPRs > 0 ? (topContributorPRs / totalPRs) * 10 : 0;

    // Determine activity level based on last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentPRs = prData?.filter((pr) => new Date(pr.created_at) >= oneWeekAgo).length || 0;
    const activity = recentPRs > 10 ? 'high' : recentPRs > 3 ? 'medium' : 'low';

    return {
      contributors: uniqueContributors.size,
      pullRequests: totalPRs,
      mergeRate: mergeRate,
      lotteryFactor: lotteryFactor,
      activity: activity,
    };
  } catch (error) {
    console.error('Error fetching repository stats:', error);
    return null;
  }
}

// Generate error/no-data stats when database is unavailable
function generateErrorStats() {
  return {
    contributors: null,
    pullRequests: null,
    mergeRate: null,
    lotteryFactor: null,
    activity: null,
  };
}

// Badge type configurations with "last month" context
const BADGE_TYPES = {
  contributors: {
    label: 'contributors (30d)',
    getValue: (stats) => (stats.contributors !== null ? stats.contributors.toString() : '-'),
    getColor: (stats) => (stats.contributors !== null ? '#007ec6' : '#6c757d'),
  },
  'pull-requests': {
    label: 'PRs (30d)',
    getValue: (stats) => (stats.pullRequests !== null ? stats.pullRequests.toString() : '-'),
    getColor: (stats) => (stats.pullRequests !== null ? '#28a745' : '#6c757d'),
  },
  'merge-rate': {
    label: 'merge rate (30d)',
    getValue: (stats) => (stats.mergeRate !== null ? `${stats.mergeRate.toFixed(1)}%` : '-'),
    getColor: (stats) =>
      stats.mergeRate === null
        ? '#6c757d'
        : stats.mergeRate > 80
          ? '#28a745'
          : stats.mergeRate > 60
            ? '#ffc107'
            : '#dc3545',
  },
  'lottery-factor': {
    label: 'lottery factor (30d)',
    getValue: (stats) => (stats.lotteryFactor !== null ? stats.lotteryFactor.toFixed(1) : '-'),
    getColor: (stats) =>
      stats.lotteryFactor === null
        ? '#6c757d'
        : stats.lotteryFactor > 3
          ? '#28a745'
          : stats.lotteryFactor > 2
            ? '#ffc107'
            : '#dc3545',
  },
  activity: {
    label: 'activity (7d)',
    getValue: (stats) => (stats.activity !== null ? stats.activity : '-'),
    getColor: (stats) =>
      stats.activity === null
        ? '#6c757d'
        : stats.activity === 'high'
          ? '#28a745'
          : stats.activity === 'medium'
            ? '#ffc107'
            : '#dc3545',
  },
};

export default async (req, context) => {
  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const owner = url.searchParams.get('owner') || 'facebook';
    const repo = url.searchParams.get('repo') || 'react';
    const type = url.searchParams.get('type') || 'contributors';
    const style = url.searchParams.get('style') || 'flat';
    const customLabel = url.searchParams.get('label');
    const customMessage = url.searchParams.get('message');
    const customColor = url.searchParams.get('color');

    // Try to fetch real data from database
    let stats = await fetchRepoStats(owner, repo);

    // Show error state if database query fails
    if (!stats) {
      console.log(`No data available for ${owner}/${repo} - showing error state`);
      stats = generateErrorStats();
    } else {
      console.log(`Using real data for ${owner}/${repo}`);
    }

    // Get badge configuration
    const badgeConfig = BADGE_TYPES[type] || BADGE_TYPES.contributors;

    // Generate badge content
    const label = customLabel || badgeConfig.label;
    const message = customMessage || badgeConfig.getValue(stats);
    const color = customColor || badgeConfig.getColor(stats);

    // Generate SVG
    const svg = generateBadgeSVG(label, message, color, style);

    const endTime = Date.now();
    console.log(`Badge generated in ${endTime - startTime}ms for ${owner}/${repo}`);

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1h cache
        'Access-Control-Allow-Origin': '*',
        'X-Generation-Time': `${endTime - startTime}ms`,
        // Add badge-specific headers for better integration
        'X-Badge-Type': type,
        'X-Repository': `${owner}/${repo}`,
        'X-Data-Source': stats.contributors !== null ? 'database' : 'unavailable',
        'X-Time-Range': '30-days',
      },
    });
  } catch (error) {
    console.error('Badge generation error:', error);

    // Fallback badge
    const fallbackSvg = generateBadgeSVG('error', 'unavailable', '#dc3545');

    return new Response(fallbackSvg, {
      status: 500,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const config = {
  path: '/api/widgets/badge',
};
