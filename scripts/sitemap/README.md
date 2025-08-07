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
# Manual submission (if needed)
node scripts/sitemap/submit-sitemap.js
```

**Note:** This script runs automatically after each release via GitHub Actions workflow.

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
   - Verifies sitemap accessibility at `https://contributor.info/sitemap.xml`
   - Automatically submits sitemaps to Google and Bing
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

The sitemap submission is integrated into the release workflow (`.github/workflows/release.yml`):

- **Trigger:** Runs automatically after a successful release
- **Job:** `submit-sitemap` 
- **Steps:**
  1. Waits for Netlify deployment (2 minutes)
  2. Verifies sitemap is accessible
  3. Submits to search engines
  4. Updates release summary with sitemap link

## Notes

- News sitemap includes only repositories updated in the last 2 days
- Repository subpages (/health, /distribution) are only included for high-priority repos (>= 0.75)
- Sitemap is regenerated on every build to ensure fresh data
- XML escaping is applied to all dynamic content for safety
- Sitemap submission runs with `continue-on-error: true` to prevent release failures
- Search engine submission happens automatically - no manual intervention needed