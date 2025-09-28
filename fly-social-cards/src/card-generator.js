/**
 * Optimized SVG generation for social cards
 * Target: < 100ms generation time for social media crawlers
 */

// Utility to escape HTML entities for safety
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Format large numbers for display
const formatNumber = (num) => {
  if (!num || num === 0) return '0';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Generate gradient backgrounds
const generateGradient = (id, colors = ['#0f172a', '#1e293b']) => {
  return `
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
      </linearGradient>
    </defs>
  `;
};

// Generate home page card
const generateHomeCard = (data) => {
  const { title, subtitle, stats } = data;
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    ${generateGradient('bgGradient')}
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bgGradient)"/>
    
    <!-- Pattern overlay -->
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.1"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#grid)"/>
    
    <!-- Logo and branding -->
    <g transform="translate(600, 140)">
      <circle cx="0" cy="0" r="60" fill="#10b981" opacity="0.9"/>
      <text x="0" y="15" text-anchor="middle" font-size="48" font-family="system-ui, -apple-system, sans-serif" fill="#ffffff">🌱</text>
    </g>
    
    <!-- Title -->
    <text x="600" y="280" text-anchor="middle" font-size="64" font-weight="700" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    
    <!-- Subtitle -->
    <text x="600" y="340" text-anchor="middle" font-size="24" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">${safeSubtitle}</text>
    
    <!-- Stats section -->
    ${
      stats
        ? `
      <g transform="translate(600, 440)">
        <!-- Repositories -->
        <g transform="translate(-300, 0)">
          <rect x="-80" y="-40" width="160" height="100" rx="8" fill="#ffffff" opacity="0.05"/>
          <text y="0" text-anchor="middle" font-size="42" font-weight="600" fill="#10b981" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.repositories)}</text>
          <text y="35" text-anchor="middle" font-size="16" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Repositories</text>
        </g>
        
        <!-- Contributors -->
        <g transform="translate(0, 0)">
          <rect x="-80" y="-40" width="160" height="100" rx="8" fill="#ffffff" opacity="0.05"/>
          <text y="0" text-anchor="middle" font-size="42" font-weight="600" fill="#3b82f6" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.contributors)}</text>
          <text y="35" text-anchor="middle" font-size="16" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Contributors</text>
        </g>
        
        <!-- Pull Requests -->
        <g transform="translate(300, 0)">
          <rect x="-80" y="-40" width="160" height="100" rx="8" fill="#ffffff" opacity="0.05"/>
          <text y="0" text-anchor="middle" font-size="42" font-weight="600" fill="#f59e0b" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.pullRequests)}</text>
          <text y="35" text-anchor="middle" font-size="16" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Pull Requests</text>
        </g>
      </g>
    `
        : ''
    }
    
    <!-- Footer -->
    <text x="600" y="580" text-anchor="middle" font-size="14" fill="#64748b" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
  </svg>`;
};

// Generate repository card
const generateRepoCard = (data) => {
  const { title, subtitle, stats } = data;
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const [owner = '', repo = ''] = safeTitle.split('/');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    ${generateGradient('bgGradient', ['#0f172a', '#1e293b'])}
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bgGradient)"/>
    
    <!-- Header bar -->
    <rect x="0" y="0" width="1200" height="80" fill="#000000" opacity="0.3"/>
    
    <!-- Logo and site name -->
    <g transform="translate(40, 40)">
      <text x="0" y="0" font-size="24" font-family="system-ui, -apple-system, sans-serif" fill="#10b981">🌱</text>
      <text x="35" y="0" font-size="18" font-weight="500" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>
    
    <!-- Repository owner badge -->
    <g transform="translate(900, 30)">
      <rect x="0" y="0" width="260" height="35" rx="17" fill="#ffffff" opacity="0.1"/>
      <text x="20" y="23" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Repository by</text>
      <text x="120" y="23" font-size="14" font-weight="600" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${owner}</text>
    </g>
    
    <!-- Repository name -->
    <text x="60" y="280" font-size="72" font-weight="700" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${repo}</text>
    
    <!-- Time period -->
    <text x="60" y="340" font-size="24" fill="#64748b" font-family="system-ui, -apple-system, sans-serif">${safeSubtitle}</text>
    
    <!-- Stats grid -->
    ${
      stats
        ? `
      <g transform="translate(60, 440)">
        <!-- Weekly PR Volume -->
        <g>
          <rect x="0" y="-30" width="240" height="80" rx="8" fill="#10b981" opacity="0.1"/>
          <text x="20" y="10" font-size="36" font-weight="600" fill="#10b981" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.weeklyPRVolume)}</text>
          <text x="20" y="40" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Weekly PR Volume</text>
        </g>
        
        <!-- Active Contributors -->
        <g transform="translate(280, 0)">
          <rect x="0" y="-30" width="240" height="80" rx="8" fill="#3b82f6" opacity="0.1"/>
          <text x="20" y="10" font-size="36" font-weight="600" fill="#3b82f6" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.activeContributors)}</text>
          <text x="20" y="40" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Active Contributors</text>
        </g>
        
        <!-- Total PRs -->
        <g transform="translate(560, 0)">
          <rect x="0" y="-30" width="240" height="80" rx="8" fill="#f59e0b" opacity="0.1"/>
          <text x="20" y="10" font-size="36" font-weight="600" fill="#f59e0b" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.totalPRs)}</text>
          <text x="20" y="40" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Total Pull Requests</text>
        </g>
      </g>
    `
        : ''
    }
    
    <!-- Contributor avatars visualization -->
    <g transform="translate(60, 550)">
      ${[0, 1, 2, 3, 4]
        .map(
          (i) => `
        <circle cx="${i * 35}" cy="20" r="18" fill="#374151" opacity="0.5"/>
      `
        )
        .join('')}
      <text x="185" y="25" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">+${formatNumber((stats?.totalContributors || 10) - 5)} contributors</text>
    </g>
  </svg>`;
};

// Generate user card
const generateUserCard = (data) => {
  const { title, subtitle, stats } = data;
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    ${generateGradient('bgGradient', ['#0f172a', '#1e293b'])}
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bgGradient)"/>
    
    <!-- User avatar placeholder -->
    <circle cx="600" cy="180" r="80" fill="#374151"/>
    <text x="600" y="200" text-anchor="middle" font-size="60" font-family="system-ui, -apple-system, sans-serif">👤</text>
    
    <!-- Username -->
    <text x="600" y="320" text-anchor="middle" font-size="56" font-weight="700" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    
    <!-- Title -->
    <text x="600" y="370" text-anchor="middle" font-size="24" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">${safeSubtitle}</text>
    
    <!-- Stats -->
    ${
      stats
        ? `
      <g transform="translate(600, 460)">
        <!-- Repositories -->
        <g transform="translate(-200, 0)">
          <text y="0" text-anchor="middle" font-size="36" font-weight="600" fill="#10b981" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.repositories)}</text>
          <text y="30" text-anchor="middle" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Repositories</text>
        </g>
        
        <!-- Pull Requests -->
        <g transform="translate(200, 0)">
          <text y="0" text-anchor="middle" font-size="36" font-weight="600" fill="#f59e0b" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.pullRequests)}</text>
          <text y="30" text-anchor="middle" font-size="14" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">Pull Requests</text>
        </g>
      </g>
    `
        : ''
    }
  </svg>`;
};

// Error card
const generateErrorCard = (data) => {
  const { title, subtitle } = data;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#0f172a"/>
    <text x="600" y="300" text-anchor="middle" font-size="48" font-weight="600" fill="#ef4444" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(title)}</text>
    <text x="600" y="360" text-anchor="middle" font-size="24" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(subtitle)}</text>
  </svg>`;
};

// Main export function
export function generateSocialCard(data) {
  const { type = 'home' } = data;

  switch (type) {
    case 'repo':
      return generateRepoCard(data);
    case 'user':
      return generateUserCard(data);
    case 'error':
      return generateErrorCard(data);
    default:
      return generateHomeCard(data);
  }
}
