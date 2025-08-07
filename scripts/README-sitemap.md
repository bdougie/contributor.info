# Sitemap Generation and Management

This directory contains scripts for generating and managing XML sitemaps for contributor.info.

## Scripts

### `generate-sitemap.js`
Generates comprehensive XML sitemaps with dynamic content from the database.

**Features:**
- Fetches all tracked repositories from Supabase
- Generates main sitemap with priority scores based on repository popularity
- Creates separate news sitemap for recent updates (last 2 days)
- Includes static pages, documentation, and repository pages
- Adds `lastmod` dates for better crawl optimization

**Priority Structure:**
- Homepage: 1.0
- Popular repositories (React, Next.js, etc.): 0.9
- High-star repositories (>10k stars): 0.85
- Medium-star repositories (>1k stars): 0.8
- Small repositories (>100 stars): 0.75
- Regular repositories: 0.7
- Static pages: 0.5
- Low priority pages: 0.4

**Usage:**
```bash
# Generate sitemap manually
npm run generate-sitemap

# Automatically runs during build
npm run build
```

### `submit-sitemap.js`
Submits generated sitemaps to search engines.

**Supported Search Engines:**
- Google (main and news sitemap)
- Bing (main and news sitemap)

**Usage:**
```bash
# Submit sitemaps after deployment
node scripts/submit-sitemap.js
```

## Generated Files

- `/public/sitemap.xml` - Main sitemap with all pages
- `/public/sitemap-news.xml` - News sitemap for recent updates
- `/public/robots.txt` - Updated to reference both sitemaps

## Deployment Process

1. **During Build:**
   - Sitemap is automatically generated via `npm run build`
   - Fetches latest repository data from database
   - Creates both main and news sitemaps

2. **After Deployment:**
   - Run `node scripts/submit-sitemap.js` to ping search engines
   - Verify in Google Search Console and Bing Webmaster Tools
   - Monitor indexing status

## Environment Variables

The sitemap generator uses these environment variables:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Monitoring

After submission, monitor sitemap status at:
- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)

## Notes

- News sitemap includes only repositories updated in the last 2 days
- Repository subpages (/health, /distribution) are only included for high-priority repos (>= 0.75)
- Sitemap is regenerated on every build to ensure fresh data
- XML escaping is applied to all dynamic content for safety