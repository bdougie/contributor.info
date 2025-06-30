// @ts-check
/**
 * Social Cards Generation Function
 * 
 * NOTE: This function is written in JavaScript (.mjs) instead of TypeScript (.mts)
 * because Netlify Functions has better support and faster cold starts with native JS.
 * 
 * TypeScript functions (.mts) were experiencing deployment issues and the functions
 * weren't being recognized by Netlify's runtime. Converting to .mjs resolved the
 * deployment and execution issues.
 * 
 * Performance is critical for social card generation (target: <100ms) since social
 * media crawlers have strict timeout requirements (Twitter: 2-3 seconds).
 */

// Optimized SVG generation for maximum speed (< 100ms)
function generateFastSVG(title, subtitle, stats, type = 'home') {
  // Pre-calculate dimensions and positions for speed
  const width = 1200;
  const height = 630;
  
  // Escape HTML for safety
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);

  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Generate home page style card
  if (type === 'home') {
    // Build stats section if provided
    const statsSection = stats ? `
      <g transform="translate(600, 460)" text-anchor="middle">
        ${stats.repositories ? `
          <g transform="translate(-200, 0)">
            <text y="0" fill="#ffffff" font-size="48" font-weight="bold" font-family="Arial, sans-serif">${formatNumber(stats.repositories)}</text>
            <text y="30" fill="#94a3b8" font-size="20" font-family="Arial, sans-serif">Repositories</text>
          </g>
        ` : ''}
        ${stats.contributors ? `
          <g transform="translate(0, 0)">
            <text y="0" fill="#ffffff" font-size="48" font-weight="bold" font-family="Arial, sans-serif">${formatNumber(stats.contributors)}</text>
            <text y="30" fill="#94a3b8" font-size="20" font-family="Arial, sans-serif">Contributors</text>
          </g>
        ` : ''}
        ${stats.pullRequests ? `
          <g transform="translate(200, 0)">
            <text y="0" fill="#ffffff" font-size="48" font-weight="bold" font-family="Arial, sans-serif">${formatNumber(stats.pullRequests)}</text>
            <text y="30" fill="#94a3b8" font-size="20" font-family="Arial, sans-serif">Pull Requests</text>
          </g>
        ` : ''}
      </g>
    ` : '';

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Black background -->
      <rect width="${width}" height="${height}" fill="#000000"/>
      
      <!-- Logo -->
      <g transform="translate(600, 180)">
        <circle cx="0" cy="0" r="64" fill="#ffffff"/>
        <text x="0" y="20" text-anchor="middle" font-size="60" font-family="Arial, sans-serif">🌱</text>
      </g>
      
      <!-- Title -->
      <text x="600" y="320" text-anchor="middle" font-size="72" font-weight="bold" fill="#ffffff" font-family="Arial, sans-serif">${safeTitle}</text>
      
      <!-- Tagline -->
      <text x="600" y="380" text-anchor="middle" font-size="28" fill="#94a3b8" font-family="Arial, sans-serif">${safeSubtitle}</text>
      
      ${statsSection}
    </svg>`;
  }

  // Generate repository style card
  else if (type === 'repo') {
    const [owner, repo] = safeTitle.split('/');
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Black background -->
      <rect width="${width}" height="${height}" fill="#000000"/>
      
      <!-- Header -->
      <g transform="translate(48, 48)">
        <!-- Logo -->
        <text x="0" y="24" font-size="32" font-family="Arial, sans-serif">🌱</text>
        <text x="50" y="24" font-size="20" font-weight="600" fill="#ffffff" font-family="Arial, sans-serif">contributor.info</text>
      </g>
      
      <!-- Main content -->
      <g transform="translate(48, 260)">
        <!-- Repository name -->
        <text y="0" font-size="72" font-weight="bold" fill="#ffffff" font-family="Arial, sans-serif">${safeTitle}</text>
        
        <!-- Time range -->
        <text y="60" font-size="28" fill="#9ca3af" font-family="Arial, sans-serif">${safeSubtitle}</text>
      </g>
      
      <!-- Bottom stats -->
      <g transform="translate(48, 520)">
        <!-- Weekly PR Volume -->
        <g>
          <text x="0" y="0" font-size="48" font-weight="bold" fill="#ffffff" font-family="Arial, sans-serif">${stats?.weeklyPRVolume || 0}</text>
          <text x="80" y="0" font-size="20" fill="#9ca3af" font-family="Arial, sans-serif">Weekly PR Volume</text>
        </g>
        
        <!-- Active Contributors -->
        <g transform="translate(400, 0)">
          <text x="0" y="0" font-size="48" font-weight="bold" fill="#ffffff" font-family="Arial, sans-serif">${stats?.activeContributors || 0}</text>
          <text x="80" y="0" font-size="20" fill="#9ca3af" font-family="Arial, sans-serif">Active Contributors</text>
        </g>
      </g>
    </svg>`;
  }
  
  // Default fallback
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#000000"/>
    <text x="600" y="315" text-anchor="middle" font-size="48" font-weight="bold" fill="#ffffff" font-family="Arial, sans-serif">${safeTitle}</text>
  </svg>`;
}

export default async (req, context) => {
  // Measure performance
  const startTime = Date.now();
  
  try {
    const url = new URL(req.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const username = url.searchParams.get('username');
    const title = url.searchParams.get('title');

    // Fast parameter processing
    let cardTitle = title || 'contributor.info';
    let cardSubtitle = 'Open Source Contributions';
    let cardData;
    let cardType = 'home';

    if (owner && repo) {
      cardTitle = `${owner}/${repo}`;
      cardSubtitle = 'Past 6 months';
      cardType = 'repo';
      
      // Mock data for popular repositories
      const mockData = {
        'facebook/react': {
          weeklyPRVolume: 67,
          activeContributors: 342,
          totalContributors: 1247,
          totalPRs: 8934
        },
        'vuejs/vue': {
          weeklyPRVolume: 28,
          activeContributors: 124,
          totalContributors: 456,
          totalPRs: 2134
        }
      };
      
      const key = `${owner}/${repo}`;
      cardData = mockData[key] || {
        weeklyPRVolume: Math.floor(Math.random() * 20) + 5,
        activeContributors: Math.floor(Math.random() * 30) + 10,
        totalContributors: Math.floor(Math.random() * 100) + 20,
        totalPRs: Math.floor(Math.random() * 500) + 50
      };
    } else if (username) {
      cardTitle = `@${username}`;
      cardSubtitle = 'Open Source Contributor';
      cardData = {
        repositories: Math.floor(Math.random() * 50) + 10,
        contributors: 1,
        pullRequests: Math.floor(Math.random() * 500) + 100
      };
    } else {
      // Home page stats
      cardTitle = 'contributor.info';
      cardSubtitle = 'Visualizing Open Source Contributions';
      cardData = {
        repositories: Math.floor(Math.random() * 1000) + 500,
        contributors: Math.floor(Math.random() * 50000) + 10000,
        pullRequests: Math.floor(Math.random() * 100000) + 50000
      };
    }

    // Generate SVG (optimized for speed)
    const svg = generateFastSVG(cardTitle, cardSubtitle, cardData, cardType);
    
    const endTime = Date.now();
    console.log(`Social card generated in ${endTime - startTime}ms`);

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24h cache
        'Access-Control-Allow-Origin': '*',
        'X-Generation-Time': `${endTime - startTime}ms`
      }
    });

  } catch (error) {
    console.error('Social card generation error:', error);
    
    // Fast fallback
    const fallbackSvg = generateFastSVG('Error', 'Image generation failed');
    
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
  path: "/api/social-cards"
};