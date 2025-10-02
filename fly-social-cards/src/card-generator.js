/**
 * Optimized SVG generation for social cards
 * Target: < 100ms generation time for social media crawlers
 * 
 * Updated to match contributor.info app's dark theme aesthetic
 * Color palette matches CSS variables from src/index.css
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

// App's dark theme color palette (matches CSS variables from src/index.css)
const THEME_COLORS = {
  // Background: hsl(0 0% 3.9%) -> #0A0A0A (ultra-dark)
  background: '#0A0A0A',
  backgroundSecondary: '#141414', // Slightly lighter for gradients
  
  // Text: hsl(0 0% 98%) -> #FAFAFA (near-white)
  text: '#FAFAFA',
  
  // Muted text: hsl(0 0% 63.9%) -> #A3A3A3
  textMuted: '#A3A3A3',
  
  // Primary: hsl(14 100% 50%) -> #FF5402 (signature orange)
  primary: '#FF5402',
  
  // Card accents
  cardOverlay: '#1A1A1A', // For subtle card backgrounds
  
  // Error state
  error: '#EF4444'
};

// Generate gradient backgrounds using app's color palette
const generateGradient = (id, colors = [THEME_COLORS.background, THEME_COLORS.backgroundSecondary]) => {
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
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${THEME_COLORS.text}" stroke-width="0.5" opacity="0.03"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#grid)"/>
    
    <!-- Logo and branding -->
    <g transform="translate(600, 140)">
      <circle cx="0" cy="0" r="60" fill="${THEME_COLORS.primary}" opacity="0.9"/>
      <text x="0" y="15" text-anchor="middle" font-size="48" font-family="system-ui, -apple-system, sans-serif" fill="${THEME_COLORS.text}">🌱</text>
    </g>
    
    <!-- Title -->
    <text x="600" y="280" text-anchor="middle" font-size="64" font-weight="700" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    
    <!-- Subtitle -->
    <text x="600" y="340" text-anchor="middle" font-size="24" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">${safeSubtitle}</text>
    
    <!-- Stats section -->
    ${
      stats
        ? `
      <g transform="translate(600, 440)">
        <!-- Repositories -->
        <g transform="translate(-300, 0)">
          <rect x="-80" y="-40" width="160" height="100" rx="8" fill="${THEME_COLORS.cardOverlay}" opacity="0.8"/>
          <text y="0" text-anchor="middle" font-size="42" font-weight="600" fill="${THEME_COLORS.primary}" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.repositories)}</text>
          <text y="35" text-anchor="middle" font-size="16" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Repositories</text>
        </g>
        
        <!-- Contributors -->
        <g transform="translate(0, 0)">
          <rect x="-80" y="-40" width="160" height="100" rx="8" fill="${THEME_COLORS.cardOverlay}" opacity="0.8"/>
          <text y="0" text-anchor="middle" font-size="42" font-weight="600" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.contributors)}</text>
          <text y="35" text-anchor="middle" font-size="16" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Contributors</text>
        </g>
        
        <!-- Pull Requests -->
        <g transform="translate(300, 0)">
          <rect x="-80" y="-40" width="160" height="100" rx="8" fill="${THEME_COLORS.cardOverlay}" opacity="0.8"/>
          <text y="0" text-anchor="middle" font-size="42" font-weight="600" fill="#FFA726" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.pullRequests)}</text>
          <text y="35" text-anchor="middle" font-size="16" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Pull Requests</text>
        </g>
      </g>
    `
        : ''
    }
    
    <!-- Footer -->
    <text x="600" y="580" text-anchor="middle" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
  </svg>`;
};

// Generate repository card
const generateRepoCard = (data) => {
  const { title, subtitle, stats } = data;
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const [owner = '', repo = ''] = safeTitle.split('/');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    ${generateGradient('bgGradient')}
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bgGradient)"/>
    
    <!-- Header bar -->
    <rect x="0" y="0" width="1200" height="80" fill="${THEME_COLORS.cardOverlay}" opacity="0.8"/>
    
    <!-- Logo and site name -->
    <g transform="translate(40, 40)">
      <text x="0" y="0" font-size="24" font-family="system-ui, -apple-system, sans-serif" fill="${THEME_COLORS.primary}">🌱</text>
      <text x="35" y="0" font-size="18" font-weight="500" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>
    
    <!-- Repository owner badge -->
    <g transform="translate(900, 30)">
      <rect x="0" y="0" width="260" height="35" rx="17" fill="${THEME_COLORS.text}" opacity="0.1"/>
      <text x="20" y="23" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Repository by</text>
      <text x="120" y="23" font-size="14" font-weight="600" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${owner}</text>
    </g>
    
    <!-- Repository name -->
    <text x="60" y="280" font-size="72" font-weight="700" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${repo}</text>
    
    <!-- Time period -->
    <text x="60" y="340" font-size="24" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">${safeSubtitle}</text>
    
    <!-- Stats grid -->
    ${
      stats
        ? `
      <g transform="translate(60, 440)">
        <!-- Weekly PR Volume -->
        <g>
          <rect x="0" y="-30" width="240" height="80" rx="8" fill="${THEME_COLORS.primary}" opacity="0.2"/>
          <text x="20" y="10" font-size="36" font-weight="600" fill="${THEME_COLORS.primary}" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.weeklyPRVolume)}</text>
          <text x="20" y="40" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Weekly PR Volume</text>
        </g>
        
        <!-- Active Contributors -->
        <g transform="translate(280, 0)">
          <rect x="0" y="-30" width="240" height="80" rx="8" fill="${THEME_COLORS.text}" opacity="0.1"/>
          <text x="20" y="10" font-size="36" font-weight="600" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.activeContributors)}</text>
          <text x="20" y="40" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Active Contributors</text>
        </g>
        
        <!-- Total PRs -->
        <g transform="translate(560, 0)">
          <rect x="0" y="-30" width="240" height="80" rx="8" fill="#FFA726" opacity="0.2"/>
          <text x="20" y="10" font-size="36" font-weight="600" fill="#FFA726" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.totalPRs)}</text>
          <text x="20" y="40" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Total Pull Requests</text>
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
        <circle cx="${i * 35}" cy="20" r="18" fill="${THEME_COLORS.cardOverlay}" opacity="0.8"/>
      `
        )
        .join('')}
      <text x="185" y="25" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">+${formatNumber((stats?.totalContributors || 10) - 5)} contributors</text>
    </g>
  </svg>`;
};

// Generate user card
const generateUserCard = (data) => {
  const { title, subtitle, stats } = data;
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    ${generateGradient('bgGradient')}
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bgGradient)"/>
    
    <!-- User avatar placeholder -->
    <circle cx="600" cy="180" r="80" fill="${THEME_COLORS.cardOverlay}"/>
    <text x="600" y="200" text-anchor="middle" font-size="60" font-family="system-ui, -apple-system, sans-serif">👤</text>
    
    <!-- Username -->
    <text x="600" y="320" text-anchor="middle" font-size="56" font-weight="700" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    
    <!-- Title -->
    <text x="600" y="370" text-anchor="middle" font-size="24" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">${safeSubtitle}</text>
    
    <!-- Stats -->
    ${
      stats
        ? `
      <g transform="translate(600, 460)">
        <!-- Repositories -->
        <g transform="translate(-200, 0)">
          <text y="0" text-anchor="middle" font-size="36" font-weight="600" fill="${THEME_COLORS.primary}" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.repositories)}</text>
          <text y="30" text-anchor="middle" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Repositories</text>
        </g>
        
        <!-- Pull Requests -->
        <g transform="translate(200, 0)">
          <text y="0" text-anchor="middle" font-size="36" font-weight="600" fill="#FFA726" font-family="system-ui, -apple-system, sans-serif">${formatNumber(stats.pullRequests)}</text>
          <text y="30" text-anchor="middle" font-size="14" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">Pull Requests</text>
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
    <rect width="1200" height="630" fill="${THEME_COLORS.background}"/>
    <text x="600" y="300" text-anchor="middle" font-size="48" font-weight="600" fill="${THEME_COLORS.error}" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(title)}</text>
    <text x="600" y="360" text-anchor="middle" font-size="24" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(subtitle)}</text>
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
