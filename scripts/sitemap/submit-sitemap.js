#!/usr/bin/env node

/**
 * Script to verify sitemap accessibility
 *
 * NOTE: As of June 2023, Google and Bing have deprecated their sitemap ping endpoints.
 * Sitemaps must now be submitted manually through:
 * - Google Search Console: https://search.google.com/search-console
 * - Bing Webmaster Tools: https://www.bing.com/webmasters
 *
 * Since sitemaps are referenced in robots.txt, search engines will also discover them automatically.
 */

// Use native fetch (available in Node 18+) or https as fallback
import https from 'https';

const SITE_URL = 'https://contributor.info';
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const NEWS_SITEMAP_URL = `${SITE_URL}/sitemap-news.xml`;

function verifySitemap(url) {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

async function main() {
  console.log('🔍 Verifying sitemap accessibility...\n');
  console.log(`📍 Main sitemap: ${SITEMAP_URL}`);
  console.log(`📰 News sitemap: ${NEWS_SITEMAP_URL}\n`);

  // Verify sitemaps are accessible
  const mainAccessible = await verifySitemap(SITEMAP_URL);
  const newsAccessible = await verifySitemap(NEWS_SITEMAP_URL);

  console.log('📊 Verification Results:');
  console.log(`Main sitemap: ${mainAccessible ? '✅ Accessible' : '❌ Not accessible'}`);
  console.log(`News sitemap: ${newsAccessible ? '✅ Accessible' : '❌ Not accessible'}`);

  console.log('\n⚠️  IMPORTANT: Sitemap ping endpoints have been deprecated!');
  console.log(
    'Google deprecated ping in June 2023: https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping'
  );
  console.log('\n📝 Manual submission required:');
  console.log('1. Google Search Console: https://search.google.com/search-console');
  console.log('   - Add property for contributor.info if not already done');
  console.log('   - Navigate to Sitemaps section');
  console.log('   - Submit both sitemap URLs');
  console.log('\n2. Bing Webmaster Tools: https://www.bing.com/webmasters');
  console.log('   - Add site if not already done');
  console.log('   - Go to Sitemaps section');
  console.log('   - Submit both sitemap URLs');
  console.log(
    '\n✨ Good news: Since sitemaps are in robots.txt, search engines will discover them automatically!'
  );
  console.log('   Robots.txt: https://contributor.info/robots.txt');
}

main().catch((error) => {
  console.error('Failed to submit sitemaps:', error);
  process.exit(1);
});
