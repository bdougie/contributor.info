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

### Phase 1: Meta Tag Management (1-2 days) ✅ COMPLETE
- [x] Add basic Open Graph and Twitter Card meta tags to index.html
- [x] Install react-helmet-async for dynamic meta tags
- [x] Create MetaTagsProvider component
- [x] Implement useSocialMeta hook for page-specific meta data
- [x] Add dynamic meta tags to all route components

### Phase 2: Social Card Generation with Supabase Storage + CDN (2-3 days)
**Note: Pivoted to Supabase Storage approach for better performance and simpler architecture**

- [ ] Create Supabase Storage bucket for social cards
- [ ] Set up build-time social card generation script
- [ ] Install dependencies: `playwright` for card generation
- [ ] Create social card templates matching design system
- [ ] Implement card generation for:
  - Home page social card
  - Repository-specific cards with dynamic data
- [ ] Upload generated cards to Supabase Storage
- [ ] Configure Smart CDN for automatic cache invalidation
- [ ] Update meta tags to point to Supabase Storage URLs

**Technical Implementation:**
```javascript
// scripts/generate-social-cards.js
import puppeteer from 'puppeteer';
import { supabase } from '../src/lib/supabase.js';

async function generateSocialCard(url, fileName) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport for social card dimensions
  await page.setViewport({ width: 1200, height: 630 });
  
  // Navigate to card generation page
  await page.goto(`http://localhost:3000/social-cards/${url}`);
  
  // Generate screenshot
  const screenshot = await page.screenshot({ type: 'png' });
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('social-cards')
    .upload(fileName, screenshot, {
      contentType: 'image/png',
      cacheControl: '31536000' // 1 year cache
    });
    
  await browser.close();
  return { data, error };
}
```

### Phase 3: Chart Integration (1-2 days)
- [ ] Create dedicated social card view pages at `/social-cards/*` routes
- [ ] Extract chart components from contributions.tsx for card rendering
- [ ] Implement simplified chart components for card display
- [ ] Add mini contribution charts for repo cards
- [ ] Include top contributor avatars (max 5)
- [ ] Add PR/issue statistics display
- [ ] Ensure cards render properly for screenshot generation

### Phase 4: Local Testing Infrastructure (1 day)
- [ ] Create `/dev/social-cards` preview page for manual testing
- [ ] Set up card generation script with local development mode
- [ ] Build preview interface showing:
  - Generated card preview
  - Meta tag inspector
  - Different content scenarios
  - Storage URL testing
- [ ] Add test cases for:
  - Long repository names
  - Repos with no activity
  - Various contributor counts
  - Error states

### Phase 5: Production Deployment (1 day)
- [ ] Integrate card generation into build pipeline
- [ ] Configure Supabase Storage bucket permissions and policies
- [ ] Test with platform validators:
  - Twitter Card Validator
  - Facebook Sharing Debugger
  - LinkedIn Post Inspector
  - Discord/Slack preview
- [ ] Monitor CDN performance and cache hit rates
- [ ] Set up automated card regeneration on data updates
- [ ] Document deployment and maintenance process

## Architecture Benefits

### Chosen Approach: Supabase Storage + Build-Time Generation
- **Performance**: Zero latency after first load via global CDN
- **Cost**: No function execution costs, only storage
- **Reliability**: No function timeouts or cold starts
- **Scale**: Handles any traffic volume
- **Maintenance**: Simple architecture, fewer moving parts

### Alternative Approaches Considered

### Option A: On-Demand Function Generation
- Real-time card generation via Netlify Functions
- Pros: Always up-to-date content
- Cons: 3-second latency, function limits, complexity

### Option B: External Service
- Use Cloudinary or Bannerbear
- Pros: Robust, scalable
- Cons: Additional cost, external dependency, vendor lock-in

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
- Build-time card generation < 2 minutes total
- CDN caching with Smart CDN auto-invalidation
- Fallback to static image on error
- Cards served with <100ms latency globally

### Dependencies
```json
{
  "dependencies": {
    "react-helmet-async": "^2.0.0"
  },
  "devDependencies": {
    "playwright": "^1.40.0"
  }
}
```

## Success Metrics
- [x] All pages have appropriate meta tags
- [ ] Social cards generate during build process
- [ ] Cards display correctly on all major platforms
- [ ] Build time increase < 2 minutes
- [ ] Storage costs stay within Supabase free tier (100GB)

## Estimated Timeline: 6-9 days total

## Notes
- The existing `social.png` will serve as the fallback image
- Consider implementing webhook for cache invalidation on data updates
- May need to optimize Supabase queries for card data fetching