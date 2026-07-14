import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { renderer } from './playwright-renderer.js';
import { generateCacheKey, getCachedImage, cacheImage, getCacheStats } from './cache.js';
import {
  fetchSelfSelectionData,
  fetchLotteryFactorData,
  fetchHealthFactorsData,
  fetchDistributionData,
} from './chart-data-fetchers.js';
import { buildChartHtml } from './chart-html-builder.js';

// Load environment variables
dotenv.config();

const app = express();

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function rateLimit(req, res, next) {
  const clientId = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  const clientData = rateLimitMap.get(clientId);

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return next();
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
    });
  }

  clientData.count++;
  next();
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, data] of rateLimitMap.entries()) {
    if (now > data.resetTime + RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(clientId);
    }
  }
}, RATE_LIMIT_WINDOW_MS);
const PORT = process.env.PORT || 8080;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Only initialize if environment variables are provided
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const cacheStats = getCacheStats();
  const playwrightStatus = renderer.getStatus();

  res.status(200).json({
    requests_total: global.requestCount || 0,
    avg_response_time_ms: global.avgResponseTime || 0,
    cache_hits: global.cacheHits || 0,
    cache_misses: global.cacheMisses || 0,
    cache: cacheStats,
    playwright: playwrightStatus,
  });
});

// Input validation helper
function validateInput(input, pattern = /^[a-zA-Z0-9_.-]+$/) {
  if (!input) return true; // Empty is ok
  if (typeof input !== 'string') return false;
  if (input.length > 100) return false; // Max length check
  return pattern.test(input);
}

// Valid chart types
const VALID_CHART_TYPES = ['self-selection', 'lottery-factor', 'health-factors', 'distribution'];

// Chart rendering endpoint (with rate limiting)
app.get('/charts/:chartType', rateLimit, async (req, res) => {
  const startTime = Date.now();
  global.requestCount = (global.requestCount || 0) + 1;

  try {
    const { chartType } = req.params;
    const { owner, repo, timeRange = '30', type: distributionType = 'donut' } = req.query;

    // Validate chart type
    if (!VALID_CHART_TYPES.includes(chartType)) {
      return res.status(400).json({
        error: 'Invalid chart type',
        validTypes: VALID_CHART_TYPES,
      });
    }

    // Validate required parameters
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Missing required parameters: owner, repo' });
    }

    // Validate inputs
    if (!validateInput(owner) || !validateInput(repo)) {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }

    // Generate cache key
    const cacheKey = generateCacheKey(chartType, {
      owner,
      repo,
      timeRange,
      type: distributionType,
    });

    // Check cache first
    const cachedImage = await getCachedImage(cacheKey, supabase);
    if (cachedImage) {
      const responseTime = Date.now() - startTime;
      global.avgResponseTime = (global.avgResponseTime || 0) * 0.9 + responseTime * 0.1;

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=21600, s-maxage=21600', // 6h cache
        'Access-Control-Allow-Origin': '*',
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'HIT',
      });

      return res.status(200).send(cachedImage);
    }

    // Fetch data based on chart type
    let chartData;
    const timeRangeNum = parseInt(timeRange, 10) || 30;

    switch (chartType) {
      case 'self-selection':
        chartData = await fetchSelfSelectionData(supabase, owner, repo, timeRangeNum);
        break;
      case 'lottery-factor':
        chartData = await fetchLotteryFactorData(supabase, owner, repo, timeRangeNum);
        break;
      case 'health-factors':
        chartData = await fetchHealthFactorsData(supabase, owner, repo, timeRangeNum);
        break;
      case 'distribution':
        chartData = await fetchDistributionData(
          supabase,
          owner,
          repo,
          distributionType,
          timeRangeNum
        );
        break;
      default:
        return res.status(400).json({ error: 'Invalid chart type' });
    }

    // Build HTML
    const html = buildChartHtml(chartType, chartData, owner, repo);

    // Render with Playwright
    const imageBuffer = await renderer.renderChart(html, {
      width: 1200,
      height: 630,
      format: 'png',
    });

    // Cache the result (async)
    cacheImage(cacheKey, imageBuffer, supabase);

    // Track performance
    const responseTime = Date.now() - startTime;
    global.avgResponseTime = (global.avgResponseTime || 0) * 0.9 + responseTime * 0.1;

    // Send response
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=21600, s-maxage=21600', // 6h cache
      'Access-Control-Allow-Origin': '*',
      'X-Response-Time': `${responseTime}ms`,
      'X-Cache': 'MISS',
    });

    res.status(200).send(imageBuffer);
  } catch (error) {
    console.error('Chart generation error: %s', error.message);

    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });

    res.status(500).json({
      error: 'Failed to generate chart',
      message: error.message,
    });
  }
});

// Card rendering moved to a same-origin Netlify Function (see
// netlify/functions/social-cards.mts in the main repo, PR #1825). Social
// platforms cache og:image URLs from old shares, so these permanent
// redirects keep them resolving; only charts render here now.
const CARDS_BASE = 'https://contributor.info';

function redirectToCard(req, res, type) {
  const search = new URLSearchParams(req.query).toString();
  res.redirect(
    301,
    `${CARDS_BASE}/social-cards/${encodeURIComponent(type)}${search ? `?${search}` : ''}`
  );
}

app.get('/social-cards/:type?', (req, res) => {
  redirectToCard(req, res, req.params.type || 'home');
});

// Legacy endpoint compatibility
app.get('/api/social-cards', (req, res) => {
  const { owner, repo, username } = req.query;
  let type = 'home';
  if (owner && repo) type = 'repo';
  else if (username) type = 'user';
  redirectToCard(req, res, type);
});

// Start server (only if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  // Initialize Playwright on startup
  renderer
    .initialize()
    .then(() => {
      console.log('Playwright renderer ready');
    })
    .catch((err) => {
      console.error('Failed to initialize Playwright: %s', err.message);
      console.warn('Chart generation will fail until Playwright is available');
    });

  const server = app.listen(PORT, () => {
    console.log('Social cards service running on port %s', PORT);
    console.log('Health check: http://localhost:%s/health', PORT);
    console.log('Metrics: http://localhost:%s/metrics', PORT);
    console.log('Charts: http://localhost:%s/charts/:chartType', PORT);
    if (!supabase) {
      console.warn('Warning: Running without database connection. Using fallback data only.');
    }
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log('Received %s, shutting down gracefully...', signal);

    server.close(async () => {
      console.log('HTTP server closed');
      await renderer.shutdown();
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Export for testing
export { app };
