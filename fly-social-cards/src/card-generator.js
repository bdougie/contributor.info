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
  error: '#EF4444',
};

// Generate gradient backgrounds using app's color palette
const generateGradient = (
  id,
  colors = [THEME_COLORS.background, THEME_COLORS.backgroundSecondary]
) => {
  return `
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
      </linearGradient>
    </defs>
  `;
};

// Generate home page card - simple, clean design matching public/social.png
const generateHomeCard = () => {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <!-- Pure black background -->
    <rect width="1200" height="630" fill="#000000"/>

    <!-- Seedling emoji and text positioned in bottom-left area -->
    <g transform="translate(100, 480)">
      <text x="0" y="0" font-size="64" font-family="system-ui, -apple-system, sans-serif">🌱</text>
      <text x="80" y="0" font-size="64" font-weight="700" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>
  </svg>`;
};

// Generate repository card - clean design with owner/repo
const generateRepoCard = (data) => {
  const { title } = data;
  const safeTitle = escapeHtml(title);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <!-- Pure black background -->
    <rect width="1200" height="630" fill="#000000"/>

    <!-- Repository name (owner/repo) -->
    <g transform="translate(100, 380)">
      <text x="0" y="0" font-size="64" font-family="system-ui, -apple-system, sans-serif">🌱</text>
      <text x="80" y="0" font-size="64" font-weight="700" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    </g>

    <!-- Site branding -->
    <text x="100" y="480" font-size="32" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
  </svg>`;
};

// Generate user card - clean design with username
const generateUserCard = (data) => {
  const { title } = data;
  const safeTitle = escapeHtml(title);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <!-- Pure black background -->
    <rect width="1200" height="630" fill="#000000"/>

    <!-- Username -->
    <g transform="translate(100, 380)">
      <text x="0" y="0" font-size="64" font-family="system-ui, -apple-system, sans-serif">🌱</text>
      <text x="80" y="0" font-size="64" font-weight="700" fill="${THEME_COLORS.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>
    </g>

    <!-- Site branding -->
    <text x="100" y="480" font-size="32" fill="${THEME_COLORS.textMuted}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
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
