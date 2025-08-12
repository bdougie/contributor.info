import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateSocialCard } from './card-generator.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co',
  process.env.SUPABASE_ANON_KEY || ''
);

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

// Main social card generation endpoint
app.get('/social-cards/:type?', async (req, res) => {
  const startTime = Date.now();
  global.requestCount = (global.requestCount || 0) + 1;

  try {
    const { type = 'home' } = req.params;
    const { owner, repo, username, title, subtitle } = req.query;

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

      // Try to fetch real data from Supabase
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
        console.error('Database fetch error:', dbError);
        // Use fallback data
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
        console.error('User data fetch error:', dbError);
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
      
      try {
        // Get global stats
        const [repoCount, contribCount, prCount] = await Promise.all([
          supabase.from('repositories').select('*', { count: 'exact', head: false }),
          supabase.from('contributors').select('*', { count: 'exact', head: false }),
          supabase.from('pull_requests').select('*', { count: 'exact', head: false })
        ]);

        cardData.stats = {
          repositories: repoCount.count || 0,
          contributors: contribCount.count || 0,
          pullRequests: prCount.count || 0
        };
      } catch (dbError) {
        console.error('Global stats fetch error:', dbError);
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
    console.error('Social card generation error:', error);
    
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

// Legacy endpoint compatibility
app.get('/api/social-cards', async (req, res) => {
  const { owner, repo, username } = req.query;
  
  let type = 'home';
  if (owner && repo) type = 'repo';
  else if (username) type = 'user';
  
  // Redirect to new endpoint structure
  const newUrl = `/social-cards/${type}?${new URLSearchParams(req.query).toString()}`;
  res.redirect(301, newUrl);
});

// Start server
app.listen(PORT, () => {
  console.log(`Social cards service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Metrics: http://localhost:${PORT}/metrics`);
});