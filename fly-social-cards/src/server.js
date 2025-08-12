import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateSocialCard } from './card-generator.js';

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
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000) 
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
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.status(200).json({
    requests_total: global.requestCount || 0,
    avg_response_time_ms: global.avgResponseTime || 0,
    cache_hits: global.cacheHits || 0,
    cache_misses: global.cacheMisses || 0
  });
});

// Input validation helper
function validateInput(input, pattern = /^[a-zA-Z0-9_.-]+$/) {
  if (!input) return true; // Empty is ok
  if (typeof input !== 'string') return false;
  if (input.length > 100) return false; // Max length check
  return pattern.test(input);
}

// Main social card generation endpoint (with rate limiting)
app.get('/social-cards/:type?', rateLimit, async (req, res) => {
  const startTime = Date.now();
  global.requestCount = (global.requestCount || 0) + 1;

  try {
    const { type = 'home' } = req.params;
    const { owner, repo, username, title, subtitle } = req.query;
    
    // Validate inputs
    if (!validateInput(owner) || !validateInput(repo) || !validateInput(username)) {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }
    
    // Validate title and subtitle (allow spaces)
    if (!validateInput(title, /^[a-zA-Z0-9_.\-\s]+$/) || !validateInput(subtitle, /^[a-zA-Z0-9_.\-\s]+$/)) {
      return res.status(400).json({ error: 'Invalid title or subtitle' });
    }

    let cardData = {
      title: title || 'contributor.info',
      subtitle: subtitle || 'Open Source Contributions',
      stats: null,
      type: 'home'
    };

    // Handle repository cards
    if (type === 'repo' || (owner && repo)) {
      cardData.title = `${owner}/${repo}`;
      cardData.subtitle = 'Past 6 months';
      cardData.type = 'repo';

      // Try to fetch real data from Supabase if client is available
      if (supabase) {
        try {
        const { data: repoData, error } = await supabase
          .from('repositories')
          .select(`
            id,
            owner,
            name,
            pull_requests(count),
            contributors(count)
          `)
          .eq('owner', owner)
          .eq('name', repo)
          .single();

        if (!error && repoData) {
          // Get PR count for last week
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          const { count: weeklyPRs } = await supabase
            .from('pull_requests')
            .select('*', { count: 'exact', head: false })
            .eq('repository_id', repoData.id)
            .gte('created_at', oneWeekAgo.toISOString());

          // Get active contributors (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: activeContribs } = await supabase
            .from('pull_requests')
            .select('author_id')
            .eq('repository_id', repoData.id)
            .gte('created_at', thirtyDaysAgo.toISOString());

          const uniqueActiveContributors = new Set(activeContribs?.map(pr => pr.author_id) || []);

          cardData.stats = {
            weeklyPRVolume: weeklyPRs || 0,
            activeContributors: uniqueActiveContributors.size,
            totalContributors: repoData.contributors?.[0]?.count || 0,
            totalPRs: repoData.pull_requests?.[0]?.count || 0
          };
        }
        } catch (dbError) {
          console.error('Database fetch error: %s', dbError.message);
          // Use fallback data
          cardData.stats = {
            weeklyPRVolume: 10,
            activeContributors: 25,
            totalContributors: 50,
            totalPRs: 200
          };
        }
      } else {
        // No database client, use fallback data
        cardData.stats = {
          weeklyPRVolume: 10,
          activeContributors: 25,
          totalContributors: 50,
          totalPRs: 200
        };
      }
    }
    // Handle user cards
    else if (type === 'user' || username) {
      cardData.title = `@${username}`;
      cardData.subtitle = 'Open Source Contributor';
      cardData.type = 'user';

      if (supabase) {
        try {
        const { data: userData, error } = await supabase
          .from('contributors')
          .select(`
            id,
            username,
            pull_requests!author_id(count)
          `)
          .eq('username', username)
          .single();

        if (!error && userData) {
          cardData.stats = {
            repositories: 0, // Would need a join to get this
            contributors: 1,
            pullRequests: userData.pull_requests?.[0]?.count || 0
          };
        }
        } catch (dbError) {
          console.error('User data fetch error: %s', dbError.message);
          cardData.stats = {
            repositories: 10,
            contributors: 1,
            pullRequests: 100
          };
        }
      } else {
        // No database client, use fallback data
        cardData.stats = {
          repositories: 10,
          contributors: 1,
          pullRequests: 100
        };
      }
    }
    // Handle home page
    else {
      cardData.title = 'contributor.info';
      cardData.subtitle = 'Visualizing Open Source Contributions';
      
      if (supabase) {
        try {
        // Get global stats (head: true returns only count, not data)
        const [repoCount, contribCount, prCount] = await Promise.all([
          supabase.from('repositories').select('*', { count: 'exact', head: true }),
          supabase.from('contributors').select('*', { count: 'exact', head: true }),
          supabase.from('pull_requests').select('*', { count: 'exact', head: true })
        ]);

        cardData.stats = {
          repositories: repoCount.count || 0,
          contributors: contribCount.count || 0,
          pullRequests: prCount.count || 0
        };
        } catch (dbError) {
          console.error('Global stats fetch error: %s', dbError.message);
          cardData.stats = {
            repositories: 500,
            contributors: 10000,
            pullRequests: 50000
          };
        }
      } else {
        // No database client, use fallback data
        cardData.stats = {
          repositories: 500,
          contributors: 10000,
          pullRequests: 50000
        };
      }
    }

    // Generate the SVG
    const svg = generateSocialCard(cardData);

    // Track performance
    const responseTime = Date.now() - startTime;
    global.avgResponseTime = ((global.avgResponseTime || 0) * 0.9) + (responseTime * 0.1);

    // Send response with appropriate headers
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400', // 1h client, 24h CDN
      'Access-Control-Allow-Origin': '*',
      'X-Response-Time': `${responseTime}ms`,
      'X-Data-Source': cardData.stats ? 'database' : 'fallback'
    });

    res.status(200).send(svg);

  } catch (error) {
    console.error('Social card generation error: %s', error.message);
    
    // Send error card
    const errorSvg = generateSocialCard({
      title: 'Error',
      subtitle: 'Failed to generate card',
      type: 'error'
    });

    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    res.status(500).send(errorSvg);
  }
});

// Legacy endpoint compatibility (with rate limiting)
app.get('/api/social-cards', rateLimit, async (req, res) => {
  const { owner, repo, username } = req.query;
  
  let type = 'home';
  if (owner && repo) type = 'repo';
  else if (username) type = 'user';
  
  // Redirect to new endpoint structure
  const newUrl = `/social-cards/${type}?${new URLSearchParams(req.query).toString()}`;
  res.redirect(301, newUrl);
});

// Start server (only if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('Social cards service running on port %s', PORT);
    console.log('Health check: http://localhost:%s/health', PORT);
    console.log('Metrics: http://localhost:%s/metrics', PORT);
    if (!supabase) {
      console.warn('Warning: Running without database connection. Using fallback data only.');
    }
  });
}

// Export for testing
export { app };