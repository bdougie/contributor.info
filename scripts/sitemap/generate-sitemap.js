#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY3h6b25wbW1jaXJtZ3FkcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxODAzNzEsImV4cCI6MjA2Nzc1NjM3MX0.SY1LMsRFyrBtHiZfgDhXD9ZlKl37-L7Uar4HnyDgw24';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SITE_URL = 'https://contributor.info';

// Priority structure based on requirements
const PRIORITY_LEVELS = {
  homepage: 1.0,
  popular: 0.9,
  regular: 0.7,
  static: 0.5,
  docs: 0.7,
  lowPriority: 0.4
};

// Change frequency based on content type
const CHANGE_FREQ = {
  homepage: 'daily',
  repository: 'daily',
  popular: 'daily',
  docs: 'weekly',
  static: 'monthly'
};

// Static pages configuration
const staticPages = [
  { loc: '/', priority: PRIORITY_LEVELS.homepage, changefreq: CHANGE_FREQ.homepage },
  { loc: '/changelog', priority: 0.8, changefreq: CHANGE_FREQ.docs },
  { loc: '/docs', priority: 0.9, changefreq: CHANGE_FREQ.docs },
  { loc: '/privacy', priority: PRIORITY_LEVELS.static, changefreq: CHANGE_FREQ.static },
  { loc: '/privacy/data-request', priority: PRIORITY_LEVELS.lowPriority, changefreq: CHANGE_FREQ.static },
  { loc: '/terms', priority: PRIORITY_LEVELS.static, changefreq: CHANGE_FREQ.static },
];

// Documentation pages
const docPages = [
  'feature-lottery-factor',
  'insight-pr-activity',
  'feature-distribution-charts',
  'feature-contributor-of-month',
  'feature-activity-feed',
  'feature-contribution-analytics',
  'feature-repository-search',
  'feature-social-cards',
  'feature-contributor-profiles',
  'feature-repository-health',
  'feature-time-range-analysis',
  'feature-authentication'
];

// Popular repositories (hardcoded list based on common frameworks)
const popularRepos = [
  'facebook/react',
  'vercel/next.js',
  'microsoft/vscode',
  'nodejs/node',
  'vuejs/vue',
  'angular/angular',
  'sveltejs/svelte',
  'pytorch/pytorch',
  'tensorflow/tensorflow',
  'kubernetes/kubernetes',
  'docker/docker',
  'rust-lang/rust',
  'golang/go',
  'python/cpython',
  'torvalds/linux',
  'apache/spark',
  'elastic/elasticsearch',
  'grafana/grafana',
  'prometheus/prometheus',
  'vitejs/vite'
];

async function fetchRepositories() {
  try {
    console.log('Fetching tracked repositories from database...');
    
    // Fetch all repositories with their stats
    const { data: repositories, error } = await supabase
      .from('repositories')
      .select(`
        id,
        owner,
        name,
        stargazers_count,
        open_issues_count,
        forks_count,
        last_updated_at
      `)
      .order('stargazers_count', { ascending: false });

    if (error) {
      console.error('Error fetching repositories:', error);
      return [];
    }

    console.log(`Found ${repositories?.length || 0} repositories`);
    return repositories || [];
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    return [];
  }
}

function calculatePriority(repo) {
  const repoPath = `${repo.owner}/${repo.name}`;
  
  // Check if it's a popular repository
  if (popularRepos.includes(repoPath)) {
    return PRIORITY_LEVELS.popular;
  }
  
  // Calculate priority based on stars and activity
  if (repo.stargazers_count > 10000) {
    return 0.85;
  } else if (repo.stargazers_count > 1000) {
    return 0.8;
  } else if (repo.stargazers_count > 100) {
    return 0.75;
  }
  
  return PRIORITY_LEVELS.regular;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function generateUrl(path, priority, changefreq, lastmod = null) {
  let xml = '  <url>\n';
  xml += `    <loc>${SITE_URL}${path}</loc>\n`;
  xml += `    <changefreq>${changefreq}</changefreq>\n`;
  xml += `    <priority>${priority.toFixed(1)}</priority>\n`;
  if (lastmod) {
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
  }
  xml += '  </url>\n';
  return xml;
}

async function generateSitemap() {
  console.log('Starting sitemap generation...');
  
  // Fetch repositories from database
  const repositories = await fetchRepositories();
  
  // Start XML document
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  xml += '  \n';
  
  // Add comment
  xml += '  <!-- Main Pages -->\n';
  
  // Add static pages
  for (const page of staticPages) {
    xml += generateUrl(page.loc, page.priority, page.changefreq);
  }
  
  xml += '  \n';
  xml += '  <!-- Feature Documentation -->\n';
  
  // Add documentation pages
  for (const doc of docPages) {
    xml += generateUrl(
      `/docs/${doc}.md`,
      PRIORITY_LEVELS.docs,
      CHANGE_FREQ.docs
    );
  }
  
  xml += '  \n';
  xml += '  <!-- Repository Pages -->\n';
  
  // Add repository pages
  for (const repo of repositories) {
    const repoPath = `/${escapeXml(repo.owner)}/${escapeXml(repo.name)}`;
    const priority = calculatePriority(repo);
    const lastmod = formatDate(repo.last_updated_at);
    
    // Main repository page
    xml += generateUrl(
      repoPath,
      priority,
      CHANGE_FREQ.repository,
      lastmod
    );
    
    // Repository subpages (only for higher priority repos)
    if (priority >= 0.75) {
      xml += generateUrl(
        `${repoPath}/health`,
        priority - 0.05,
        CHANGE_FREQ.repository,
        lastmod
      );
      
      xml += generateUrl(
        `${repoPath}/distribution`,
        priority - 0.05,
        CHANGE_FREQ.repository,
        lastmod
      );
    }
  }
  
  // Close XML document
  xml += '\n</urlset>\n';
  
  // Write sitemap to file
  const outputPath = path.join(__dirname, '..', '..', 'public', 'sitemap.xml');
  await fs.writeFile(outputPath, xml, 'utf-8');
  
  console.log(`✅ Sitemap generated successfully with ${repositories.length} repositories`);
  console.log(`📍 Saved to: ${outputPath}`);
  
  // Generate news sitemap for recent updates
  await generateNewsSitemap(repositories);
  
  return xml;
}

async function generateNewsSitemap(repositories) {
  console.log('Generating news sitemap...');
  
  // Get repositories updated in the last 2 days
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const recentRepos = repositories.filter(repo => {
    if (!repo.last_updated_at) return false;
    return new Date(repo.last_updated_at) > twoDaysAgo;
  });
  
  if (recentRepos.length === 0) {
    console.log('No recent updates for news sitemap');
    return;
  }
  
  // Start XML document for news sitemap
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';
  xml += '  \n';
  
  for (const repo of recentRepos) {
    const repoPath = `/${escapeXml(repo.owner)}/${escapeXml(repo.name)}`;
    const pubDate = formatDate(repo.last_updated_at);
    
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}${repoPath}</loc>\n`;
    xml += '    <news:news>\n';
    xml += '      <news:publication>\n';
    xml += `        <news:name>Contributor.info</news:name>\n`;
    xml += `        <news:language>en</news:language>\n`;
    xml += '      </news:publication>\n';
    xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
    xml += `      <news:title>${escapeXml(repo.owner)}/${escapeXml(repo.name)} - Contributor Updates</news:title>\n`;
    xml += '    </news:news>\n';
    xml += '  </url>\n';
  }
  
  xml += '</urlset>\n';
  
  // Write news sitemap to file
  const outputPath = path.join(__dirname, '..', '..', 'public', 'sitemap-news.xml');
  await fs.writeFile(outputPath, xml, 'utf-8');
  
  console.log(`✅ News sitemap generated with ${recentRepos.length} recent updates`);
  console.log(`📍 Saved to: ${outputPath}`);
}

// Run the generator
generateSitemap().catch(error => {
  console.error('Failed to generate sitemap:', error);
  process.exit(1);
});