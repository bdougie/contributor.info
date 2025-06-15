# Storybook Netlify Deployment Setup

This repository is configured to deploy its Storybook design system to `design.contributor.info` using Netlify.

## Quick Start

### Local Development
```bash
# Start Storybook development server
npm run storybook

# Build and preview production Storybook locally
npm run preview-storybook

# Test build script
npm run test-storybook-build
```

### Deployment Setup

#### 1. Create Netlify Site
1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect to this GitHub repository
4. Use these build settings:
   - **Build command**: `npm run build-storybook`
   - **Publish directory**: `storybook-static`
   - **Node version**: 18

#### 2. Configure GitHub Secrets
Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

- `NETLIFY_AUTH_TOKEN`: Your Netlify personal access token
- `NETLIFY_SITE_ID`: Your Netlify site ID

#### 3. Set Up Custom Domain
1. In Netlify site settings → "Domain management"
2. Add custom domain: `design.contributor.info`
3. Configure DNS with your domain provider:
   ```
   CNAME design your-netlify-site-name.netlify.app
   ```

## Files Created

### Configuration Files
- **`netlify.toml`** - Netlify build and deployment configuration
- **`.github/workflows/deploy-storybook.yml`** - GitHub Actions for automated deployment
- **`.storybook/DEPLOYMENT.md`** - Detailed deployment documentation
- **`.storybook/test-build.sh`** - Local build testing script

### New npm Scripts
- `preview-storybook` - Build and serve locally
- `test-storybook-build` - Test build with detailed output

## Deployment Triggers

Automatic deployment occurs when:
- Changes are pushed to `main` branch
- Pull requests are created (deploy previews)
- Changes affect these paths:
  - `src/components/**`
  - `src/stories/**`
  - `.storybook/**`
  - `package.json`
  - `package-lock.json`

## Build Process

1. **Install dependencies** with `npm ci`
2. **Build Storybook** with `npm run build-storybook`
3. **Deploy to Netlify** with optimized assets
4. **Apply security headers** and caching rules

## Features

✅ **Automatic Deployment** - GitHub Actions integration  
✅ **Deploy Previews** - Every PR gets a preview URL  
✅ **Custom Domain** - Configured for design.contributor.info  
✅ **Performance Optimization** - Minified assets, CDN, caching  
✅ **Security Headers** - XSS protection, content type, frame options  
✅ **Build Testing** - Local preview and testing scripts  

## Project Structure

```
.storybook/
├── DEPLOYMENT.md          # Detailed deployment guide
├── main.ts               # Storybook configuration
├── preview.ts            # Global styles and parameters
└── test-build.sh         # Build testing script

.github/workflows/
└── deploy-storybook.yml  # Automated deployment

netlify.toml              # Netlify configuration
```

## Monitoring

- **Build Status**: Check GitHub Actions
- **Deploy Logs**: Monitor in Netlify dashboard
- **Performance**: Lighthouse scores in Netlify
- **Preview URLs**: Automatically generated for PRs

## Next Steps

1. **Complete Repository Setup**: Ensure all GitHub secrets are configured
2. **Domain Configuration**: Set up DNS records for design.contributor.info
3. **Test Deployment**: Push changes to trigger first deployment
4. **Monitor Performance**: Review build times and asset optimization

## Support

For issues:
1. Check GitHub Actions logs
2. Review Netlify deploy logs  
3. Verify environment variables
4. See `.storybook/DEPLOYMENT.md` for troubleshooting

---

**Design System URL**: https://design.contributor.info  
**Storybook Version**: 9.0.9  
**Last Updated**: December 2024