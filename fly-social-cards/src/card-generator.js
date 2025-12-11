/**
 * Optimized SVG generation for social cards
 * Target: < 100ms generation time for social media crawlers
 *
 * Matches the React component design from src/components/social-cards/
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
const THEME = {
  background: '#0A0A0A',
  text: '#FAFAFA',
  textMuted: '#A3A3A3',
  primary: '#FF5402',
  green: '#22C55E', // Seedling color
  brown: '#8B4513', // Pot color
};

// Favicon logo as simplified SVG (seedling in pot)
const faviconLogo = (x, y, size = 28) => `
  <g transform="translate(${x}, ${y}) scale(${size / 28})">
    <!-- Pot -->
    <path d="M8 18h12v6c0 2-2 4-6 4s-6-2-6-4v-6z" fill="${THEME.brown}"/>
    <path d="M6 16h16v3H6z" fill="${THEME.brown}"/>
    <!-- Leaves -->
    <ellipse cx="10" cy="10" rx="5" ry="7" fill="${THEME.green}" transform="rotate(-30 10 10)"/>
    <ellipse cx="18" cy="10" rx="5" ry="7" fill="${THEME.green}" transform="rotate(30 18 10)"/>
    <!-- Stem -->
    <rect x="13" y="10" width="2" height="8" fill="${THEME.green}"/>
  </g>
`;

// Icons as SVG paths - scaled to 32x32 (React uses w-8 h-8)
// Lucide icons are designed for 24x24 viewBox, scale by 1.33 for 32px
const ICON_SCALE = 1.33;
const icons = {
  users: (x, y, color) => `
    <g transform="translate(${x}, ${y}) scale(${ICON_SCALE})">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="${color}" stroke-width="2" fill="none"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
  `,
  gitPullRequest: (x, y, color) => `
    <g transform="translate(${x}, ${y}) scale(${ICON_SCALE})">
      <circle cx="18" cy="18" r="3" stroke="${color}" stroke-width="2" fill="none"/>
      <circle cx="6" cy="6" r="3" stroke="${color}" stroke-width="2" fill="none"/>
      <path d="M13 6h3a2 2 0 0 1 2 2v7" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <line x1="6" y1="9" x2="6" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </g>
  `,
  trendingUp: (x, y, color) => `
    <g transform="translate(${x}, ${y}) scale(${ICON_SCALE})">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="17 6 23 6 23 12" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  `,
};

// Generate home page card - matches React component
const generateHomeCard = (data) => {
  const stats = data.stats || { repositories: 1000, contributors: 50000, pullRequests: 500000 };

  // Format numbers once for positioning calculation
  const contributorsNum = formatNumber(stats.contributors) + '+';
  const pullRequestsNum = formatNumber(stats.pullRequests) + '+';
  const repositoriesNum = formatNumber(stats.repositories) + '+';

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>

    <!-- Header with logo -->
    <g transform="translate(48, 40)">
      ${faviconLogo(0, 0, 28)}
      <text x="36" y="20" font-size="22" font-weight="600" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>

    <!-- Main title -->
    <text x="48" y="260" font-size="56" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">Open Source Insights</text>

    <!-- Tagline -->
    <text x="48" y="320" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Visualizing contributions across the ecosystem</text>

    <!-- Stats row - vertically centered items with proper spacing -->
    <g transform="translate(48, 440)">
      <!-- Contributors: icon + number + label stacked in two lines -->
      <g transform="translate(0, 0)">
        ${icons.users(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${contributorsNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Contributors</text>
      </g>

      <!-- Pull Requests -->
      <g transform="translate(280, 0)">
        ${icons.gitPullRequest(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${pullRequestsNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Pull Requests</text>
      </g>

      <!-- Repositories -->
      <g transform="translate(560, 0)">
        ${icons.trendingUp(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${repositoriesNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Repositories</text>
      </g>
    </g>
  </svg>`;
};

// Generate repository card - matches React component
const generateRepoCard = (data) => {
  const { title, stats } = data;
  const safeTitle = escapeHtml(title);
  const repoStats = stats || { weeklyPRVolume: 12, activeContributors: 85, totalContributors: 100 };

  const weeklyPRNum = formatNumber(repoStats.weeklyPRVolume);
  const activeContribNum = formatNumber(repoStats.activeContributors);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>

    <!-- Header with logo -->
    <g transform="translate(48, 40)">
      ${faviconLogo(0, 0, 28)}
      <text x="36" y="20" font-size="22" font-weight="600" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>

    <!-- Repository name -->
    <text x="48" y="260" font-size="56" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>

    <!-- Time period -->
    <text x="48" y="320" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Past 6 months</text>

    <!-- Stats row - stacked layout to avoid overlap -->
    <g transform="translate(48, 440)">
      <!-- Weekly PR Volume -->
      <g transform="translate(0, 0)">
        ${icons.trendingUp(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.primary}" font-family="system-ui, -apple-system, sans-serif">${weeklyPRNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Weekly PR Volume</text>
      </g>

      <!-- Active Contributors -->
      <g transform="translate(320, 0)">
        ${icons.users(0, -8, THEME.text)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${activeContribNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Active Contributors</text>
      </g>
    </g>

    <!-- Contributor circles placeholder -->
    <g transform="translate(48, 540)">
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<circle cx="${i * 40 + 16}" cy="16" r="16" fill="${THEME.textMuted}" opacity="0.3"/>`
        )
        .join('')}
      <text x="220" y="22" font-size="14" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">+${formatNumber((repoStats.totalContributors || 100) - 5)}</text>
    </g>
  </svg>`;
};

// Generate user card - matches React component style
const generateUserCard = (data) => {
  const { title } = data;
  const safeTitle = escapeHtml(title);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>

    <!-- Header with logo -->
    <g transform="translate(48, 40)">
      ${faviconLogo(0, 0, 28)}
      <text x="36" y="20" font-size="22" font-weight="600" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>

    <!-- Username -->
    <text x="48" y="280" font-size="56" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>

    <!-- Subtitle -->
    <text x="48" y="340" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Open Source Contributor</text>
  </svg>`;
};

// Error card
const generateErrorCard = (data) => {
  const { title, subtitle } = data;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>
    <text x="600" y="300" text-anchor="middle" font-size="48" font-weight="600" fill="#EF4444" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(title)}</text>
    <text x="600" y="360" text-anchor="middle" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(subtitle)}</text>
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
