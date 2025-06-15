# PRD: Social Card Implementation for contributor.info

## Project Overview

### Objective
Implement dynamic social media preview cards (Open Graph and Twitter Cards) for contributor.info to enhance social sharing and visibility.

### Background
The project currently has a `social.png` file but lacks proper meta tags and dynamic social card generation. When shared on social platforms, the site needs rich previews showing repository statistics and contribution data.

### Deployment Context
- **Platform**: Netlify (not Vercel)
- **Database**: Supabase
- **Framework**: React + TypeScript + Vite

## Implementation Plan

### Phase 1: Meta Tag Management (1-2 days) ✅ Partially Complete
- [x] Add basic Open Graph and Twitter Card meta tags to index.html
- [ ] Install react-helmet-async for dynamic meta tags
- [ ] Create MetaTagsProvider component
- [ ] Implement useSocialMeta hook for page-specific meta data
- [ ] Add dynamic meta tags to all route components

### Phase 2: Social Card Generation with Netlify Functions (2-3 days)
**Note: Using Netlify-compatible approach instead of @vercel/og**

- [ ] Set up Netlify Functions infrastructure
- [ ] Install dependencies: `satori`, `@resvg/resvg-js`, `sharp`
- [ ] Create serverless functions:
  - `/netlify/functions/og-home` - Home page social card
  - `/netlify/functions/og-repo` - Repository-specific cards
- [ ] Implement social card templates matching design system
- [ ] Add caching headers (s-maxage: 86400 for 24hr cache)
- [ ] Handle error cases with static fallback images

**Technical Implementation:**
```javascript
// netlify/functions/og-image.js
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export async function handler(event) {
  // Parse query parameters
  const { repo, owner } = event.queryStringParameters;
  
  // Generate SVG with Satori
  const svg = await satori(
    <SocialCard repo={repo} owner={owner} />,
    { width: 1200, height: 630, fonts: [...] }
  );
  
  // Convert to PNG
  const resvg = new Resvg(svg);
  const pngData = resvg.render();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, s-maxage=86400',
    },
    body: pngData.asPng().toString('base64'),
    isBase64Encoded: true,
  };
}
```

### Phase 3: Chart Integration (1-2 days)
- [ ] Extract chart components from contributions.tsx
- [ ] Create simplified chart components for Satori rendering
- [ ] Implement mini contribution charts for repo cards
- [ ] Add top contributor avatars (max 5)
- [ ] Include PR/issue statistics
- [ ] Ensure charts work without client-side JS

### Phase 4: Local Testing Infrastructure (1 day)
- [ ] Create `/dev/social-cards` preview page
- [ ] Set up Netlify CLI for local function testing (`netlify dev`)
- [ ] Build preview interface showing:
  - Generated card preview
  - Meta tag inspector
  - Different content scenarios
  - URL sharing simulator
- [ ] Add test cases for:
  - Long repository names
  - Repos with no activity
  - Various contributor counts
  - Error states

### Phase 5: Production Deployment (1 day)
- [ ] Configure Netlify Functions in production
- [ ] Update meta tags to use function URLs
- [ ] Test with platform validators:
  - Twitter Card Validator
  - Facebook Sharing Debugger
  - LinkedIn Post Inspector
  - Discord/Slack preview
- [ ] Monitor function performance
- [ ] Implement usage analytics
- [ ] Document deployment process

## Alternative Approaches (If Performance Issues)

### Option A: Build-Time Generation
- Pre-generate cards for known routes during build
- Use Puppeteer or Playwright for complex visualizations
- Store in public directory
- Pros: Zero latency, no function limits
- Cons: Can't handle dynamic content

### Option B: External Service
- Use Cloudinary or Bannerbear
- Pros: Robust, scalable
- Cons: Additional cost, external dependency

## Technical Specifications

### Social Card Design
- **Dimensions**: 1200x630px (standard OG image size)
- **Home Card Elements**:
  - Site logo and title
  - Tagline: "Visualizing Open Source Contributions"
  - Dark theme with grid background
  - Key statistics (total repos, contributors)
  
- **Repository Card Elements**:
  - Repository name and owner
  - Mini contribution chart
  - Top 5 contributor avatars
  - PR/Issue counts
  - Last activity indicator

### Performance Requirements
- Image generation < 3 seconds
- CDN caching for 24 hours minimum
- Fallback to static image on error
- Function memory limit: 1024MB (Netlify default)

### Dependencies
```json
{
  "dependencies": {
    "react-helmet-async": "^2.0.0"
  },
  "devDependencies": {
    "satori": "^0.10.0",
    "@resvg/resvg-js": "^2.6.0",
    "@netlify/functions": "^2.0.0"
  }
}
```

## Success Metrics
- [ ] All pages have appropriate meta tags
- [ ] Social cards generate in < 3 seconds
- [ ] Cards display correctly on all major platforms
- [ ] No increase in build time > 30 seconds
- [ ] Function costs stay within free tier

## Estimated Timeline: 6-9 days total

## Notes
- The existing `social.png` will serve as the fallback image
- Consider implementing webhook for cache invalidation on data updates
- May need to optimize Supabase queries for card data fetching