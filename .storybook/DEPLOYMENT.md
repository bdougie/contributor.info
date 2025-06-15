# Storybook Deployment Guide

This document outlines how to deploy the Storybook design system to `design.contributor.info` using Netlify.

## Overview

The Storybook is deployed as a separate site from the main application:
- **Main App**: `contributor.info`
- **Design System**: `design.contributor.info`

## Netlify Setup

### 1. Create New Netlify Site

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub repository
4. Configure build settings:
   - **Base directory**: Leave empty (root)
   - **Build command**: `npm run build-storybook`
   - **Publish directory**: `storybook-static`
   - **Node version**: 18

### 2. Environment Variables

Add these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

```
NETLIFY_AUTH_TOKEN=your_netlify_personal_access_token
NETLIFY_SITE_ID=your_netlify_site_id
```

To get these values:
- **NETLIFY_AUTH_TOKEN**: Go to Netlify → User Settings → Personal Access Tokens → Create new token
- **NETLIFY_SITE_ID**: Found in your site settings under "Site information"

### 3. Custom Domain Setup

1. In Netlify site settings, go to "Domain management"
2. Click "Add custom domain"
3. Enter: `design.contributor.info`
4. Add DNS records to your domain provider:
   ```
   CNAME design your-netlify-site-name.netlify.app
   ```

### 4. Deploy Triggers

The Storybook automatically deploys when:
- Changes are pushed to `main` branch
- Changes affect components, stories, or Storybook config
- Pull requests are created (deploy previews)

Specific paths that trigger deployment:
- `src/components/**`
- `src/stories/**`
- `.storybook/**`
- `package.json`
- `package-lock.json`

## Build Process

### Local Build
```bash
npm run build-storybook
```

### Production Build
The production build includes:
- Minified CSS and JavaScript
- Optimized assets
- Proper caching headers
- Security headers

## Configuration Files

- **`netlify.toml`**: Netlify build configuration
- **`.github/workflows/deploy-storybook.yml`**: GitHub Actions workflow
- **`.storybook/main.ts`**: Storybook configuration
- **`.storybook/preview.ts`**: Global styles and parameters

## Performance Optimizations

The deployment includes:
- **Asset optimization**: CSS/JS minification and bundling
- **Caching**: Long-term caching for static assets
- **CDN**: Global content delivery via Netlify Edge
- **Compression**: Automatic gzip compression

## Security Headers

The following security headers are automatically applied:
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Monitoring

### Build Status
- Check GitHub Actions for build status
- Monitor Netlify deploy logs
- Review PR deploy previews

### Performance
- Lighthouse scores in Netlify
- Core Web Vitals monitoring
- Bundle size analysis

## Troubleshooting

### Build Failures
1. Check GitHub Actions logs
2. Verify Node.js version (should be 18)
3. Ensure all dependencies are in `package.json`
4. Check Storybook configuration

### Deploy Issues
1. Verify Netlify environment variables
2. Check custom domain DNS settings
3. Review netlify.toml configuration

### Common Commands
```bash
# Test local build
npm run build-storybook

# Start local Storybook
npm run storybook

# Test production build locally
npx http-server storybook-static -p 6006
```

## Branch Strategy

- **Main branch**: Deploys to production (`design.contributor.info`)
- **Feature branches**: Create deploy previews
- **Pull requests**: Generate preview URLs for review

## Updating the Design System

1. Create feature branch
2. Update components and stories
3. Create pull request
4. Review deploy preview
5. Merge to main
6. Automatic deployment to production

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review Netlify deploy logs
3. Verify configuration files
4. Check domain settings

---

**Last Updated**: December 2024  
**Storybook Version**: 9.0.9  
**Node.js Version**: 18.x