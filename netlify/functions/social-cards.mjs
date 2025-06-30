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
function generateFastSVG(title, subtitle, stats) {
  // Pre-calculate dimensions and positions for speed
  const width = 1200;
  const height = 630;
  const cardX = 100;
  const cardY = 100;
  const cardWidth = 1000;
  const cardHeight = 430;
  
  // Escape HTML for safety
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);

  // Build stats section if provided
  const statsSection = stats ? `
    <g transform="translate(600, 420)" text-anchor="middle">
      ${stats.stars ? `<text x="-80" y="0" fill="#4a5568" font-size="28" font-family="Arial, sans-serif">⭐ ${stats.stars.toLocaleString()}</text>` : ''}
      ${stats.contributors ? `<text x="${stats.stars ? '80' : '0'}" y="0" fill="#4a5568" font-size="28" font-family="Arial, sans-serif">👥 ${stats.contributors.toLocaleString()}</text>` : ''}
    </g>
  ` : '';

  // Minimal, fast SVG template
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#667eea"/>
        <stop offset="100%" stop-color="#764ba2"/>
      </linearGradient>
    </defs>
    
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="20" fill="rgba(255,255,255,0.95)"/>
    
    <text x="600" y="280" text-anchor="middle" font-size="48" font-weight="bold" fill="#1a202c" font-family="Arial, sans-serif">${safeTitle}</text>
    <text x="600" y="340" text-anchor="middle" font-size="24" fill="#4a5568" font-family="Arial, sans-serif">${safeSubtitle}</text>
    
    ${statsSection}
    
    <text x="950" y="500" font-size="20" fill="#718096" font-family="Arial, sans-serif">🌱 contributor.info</text>
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

    if (owner && repo) {
      cardTitle = `${owner}/${repo}`;
      cardSubtitle = 'Repository Contributions';
      // For demo purposes - in production, this would fetch from Supabase
      cardData = {
        stars: Math.floor(Math.random() * 50000) + 1000,
        contributors: Math.floor(Math.random() * 500) + 50
      };
    } else if (username) {
      cardTitle = `@${username}`;
      cardSubtitle = 'Open Source Contributor';
    }

    // Generate SVG (optimized for speed)
    const svg = generateFastSVG(cardTitle, cardSubtitle, cardData);
    
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