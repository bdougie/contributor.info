# Sitemap Generation and Management

This directory contains scripts for generating and managing XML sitemaps for contributor.info.

## Overview

The sitemap system automatically generates and submits XML sitemaps to search engines. Sitemap generation happens during the build process, and submission to search engines occurs automatically after each release.

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
- Important pages (Docs, Changelog): 0.8
- High-star repositories (>10k stars): 0.85
- Medium-star repositories (>1k stars): 0.8
- Small repositories (>100 stars): 0.75
- Regular repositories: 0.7
- Individual documentation pages: 0.7
- Static pages (Privacy, Terms): 0.5
- Low priority pages (sub-pages): 0.4

**Usage:**
```bash
# Generate sitemap manually
npm run generate-sitemap

# Automatically runs during build
npm run build
```

### `submit-sitemap.js`
Verifies sitemap accessibility (ping endpoints deprecated as of June 2023).

**Purpose:**
- Verifies sitemaps are accessible via HTTP
- Provides instructions for manual submission

**Usage:**
```bash
# Verify sitemap accessibility
node scripts/sitemap/submit-sitemap.js
```

**Important:** Google and Bing deprecated their ping endpoints in 2023. Sitemaps must now be:
1. Manually submitted via Search Console/Webmaster Tools
2. OR discovered automatically via robots.txt (already configured)

## Generated Files

- `/public/sitemap.xml` - Main sitemap with all pages
- `/public/sitemap-news.xml` - News sitemap for recent updates
- `/public/robots.txt` - Updated to reference both sitemaps

## Deployment Process

### Automatic Process (via Release Workflow)

1. **During Build Phase:**
   - Sitemap is automatically generated via `npm run build`
   - Fetches latest repository data from database
   - Creates both main and news sitemaps

2. **After Release (Automated):**
   - GitHub Actions workflow triggers after successful release
   - Waits 2 minutes for Netlify deployment to complete
   - Verifies both sitemaps are accessible via HTTP
   - Logs verification results and submission instructions
   - Adds sitemap link to release summary

### Manual Process (if needed)

1. **Generate sitemap:**
   ```bash
   npm run generate-sitemap
   ```

2. **Submit to search engines:**
   ```bash
   node scripts/sitemap/submit-sitemap.js
   ```

3. **Verify submission:**
   - Check Google Search Console
   - Check Bing Webmaster Tools

## Environment Variables

The sitemap generator uses these environment variables:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Monitoring

After submission, monitor sitemap status at:
- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)

## GitHub Actions Integration

The sitemap verification is integrated into the release workflow (`.github/workflows/release.yml`):

- **Trigger:** Runs automatically after a successful release
- **Job:** `verify-sitemap` 
- **Steps:**
  1. Waits for Netlify deployment (2 minutes)
  2. Verifies both sitemaps are accessible
  3. Logs verification results
  4. Updates release summary with sitemap link

## Notes

- News sitemap includes only repositories updated in the last 2 days
- Repository subpages (/health, /distribution) are only included for high-priority repos (>= 0.75)
- Sitemap is regenerated on every build to ensure fresh data
- XML escaping is applied to all dynamic content for safety
- Since ping endpoints are deprecated (2023), sitemaps must be manually submitted via webmaster tools
- Sitemaps are automatically discovered via robots.txt by search engine crawlers