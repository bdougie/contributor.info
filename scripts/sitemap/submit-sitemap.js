#!/usr/bin/env node

/**
 * Script to submit sitemap to search engines
 * Run this after deploying to production
 */

// Use native fetch (available in Node 18+) or https as fallback
import https from 'https';

const SITE_URL = 'https://contributor.info';
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const NEWS_SITEMAP_URL = `${SITE_URL}/sitemap-news.xml`;

// Search engine submission endpoints
const SUBMISSION_URLS = {
  google: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
  googleNews: `https://www.google.com/ping?sitemap=${encodeURIComponent(NEWS_SITEMAP_URL)}`,
  bing: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
  bingNews: `https://www.bing.com/ping?sitemap=${encodeURIComponent(NEWS_SITEMAP_URL)}`
};

function submitSitemap(name, url) {
  return new Promise((resolve) => {
    console.log(`📤 Submitting to ${name}...`);
    
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Successfully submitted to ${name}`);
        resolve(true);
      } else {
        console.error(`❌ Failed to submit to ${name}: ${res.statusCode} ${res.statusMessage}`);
        resolve(false);
      }
    }).on('error', (error) => {
      console.error(`❌ Error submitting to ${name}:`, error.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🚀 Starting sitemap submission to search engines...\n');
  console.log(`📍 Main sitemap: ${SITEMAP_URL}`);
  console.log(`📰 News sitemap: ${NEWS_SITEMAP_URL}\n`);
  
  const results = [];
  
  for (const [name, url] of Object.entries(SUBMISSION_URLS)) {
    const success = await submitSitemap(name, url);
    results.push({ name, success });
    
    // Add a small delay between submissions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log(`✅ Successful submissions: ${successful.map(r => r.name).join(', ')}`);
  }
  
  if (failed.length > 0) {
    console.log(`❌ Failed submissions: ${failed.map(r => r.name).join(', ')}`);
  }
  
  console.log('\n💡 Additional steps:');
  console.log('1. Submit sitemap via Google Search Console: https://search.google.com/search-console');
  console.log('2. Submit sitemap via Bing Webmaster Tools: https://www.bing.com/webmasters');
  console.log('3. Verify robots.txt is accessible: https://contributor.info/robots.txt');
  console.log('4. Monitor indexing status in search console dashboards');
}

main().catch(error => {
  console.error('Failed to submit sitemaps:', error);
  process.exit(1);
});