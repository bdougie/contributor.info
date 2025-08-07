// @ts-check
/**
 * Badge Widget Generation Function
 * 
 * Generates SVG badges for repository statistics that can be embedded in README files.
 * Follows shields.io badge format standards for compatibility.
 */

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
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Remove any control characters that could break SVG
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitizes color values to prevent CSS injection
 * @param {string} color - Color value to sanitize
 * @returns {string} Safe color value
 */
function sanitizeColor(color) {
  // Only allow hex colors (3, 4, 6, 8 digits), rgb/rgba with 0-255 range, and named colors
  const hexPattern = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  const rgbPattern = /^rgba?\(\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*(?:,\s*(?:0?\.[0-9]+|1(?:\.0+)?|0))?\)$/;
  const namedColors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'gray', 'black', 'white'];
  
  if (hexPattern.test(color) || rgbPattern.test(color) || namedColors.includes(color.toLowerCase())) {
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
  ${styleConfig.shadow ? `<defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
    </filter>
  </defs>` : ''}
  
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

// Mock data generator for repositories (in real implementation, this would query your database)
function generateMockStats(owner, repo) {
  // Popular repositories with realistic numbers
  const knownRepos = {
    'facebook/react': {
      contributors: 1247,
      pullRequests: 8934,
      mergeRate: 83.5,
      lotteryFactor: 3.2,
      activity: 'high'
    },
    'microsoft/vscode': {
      contributors: 1890,
      pullRequests: 12456,
      mergeRate: 89.2,
      lotteryFactor: 2.8,
      activity: 'high'
    },
    'vuejs/vue': {
      contributors: 456,
      pullRequests: 2134,
      mergeRate: 91.7,
      lotteryFactor: 3.8,
      activity: 'medium'
    }
  };

  const key = `${owner}/${repo}`;
  if (knownRepos[key]) {
    return knownRepos[key];
  }

  // Generate random but realistic stats for unknown repositories
  return {
    contributors: Math.floor(Math.random() * 200) + 10,
    pullRequests: Math.floor(Math.random() * 1000) + 50,
    mergeRate: Math.floor(Math.random() * 30) + 70, // 70-100%
    lotteryFactor: Math.random() * 3 + 1.5, // 1.5-4.5
    activity: Math.random() > 0.5 ? 'high' : 'medium'
  };
}

// Badge type configurations
const BADGE_TYPES = {
  contributors: {
    label: 'contributors',
    getValue: (stats) => stats.contributors.toString(),
    getColor: (stats) => '#007ec6'
  },
  'pull-requests': {
    label: 'pull requests',
    getValue: (stats) => stats.pullRequests.toString(),
    getColor: (stats) => '#28a745'
  },
  'merge-rate': {
    label: 'merge rate',
    getValue: (stats) => `${stats.mergeRate.toFixed(1)}%`,
    getColor: (stats) => 
      stats.mergeRate > 80 ? '#28a745' : 
      stats.mergeRate > 60 ? '#ffc107' : '#dc3545'
  },
  'lottery-factor': {
    label: 'lottery factor',
    getValue: (stats) => stats.lotteryFactor.toFixed(1),
    getColor: (stats) => 
      stats.lotteryFactor > 3 ? '#28a745' : 
      stats.lotteryFactor > 2 ? '#ffc107' : '#dc3545'
  },
  activity: {
    label: 'activity',
    getValue: (stats) => stats.activity,
    getColor: (stats) => stats.activity === 'high' ? '#28a745' : '#ffc107'
  }
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

    // Generate repository statistics
    const stats = generateMockStats(owner, repo);
    
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
      }
    });

  } catch (error) {
    console.error('Badge generation error:', error);
    
    // Fallback badge
    const fallbackSvg = generateBadgeSVG('error', 'unavailable', '#dc3545');
    
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
  path: "/api/widgets/badge"
};