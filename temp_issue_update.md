## Problem Summary
The social cards feature is currently broken. When sharing links to contributor.info (either the homepage or specific repository pages), no social card preview is generated. The feature appears to fail due to timeout issues and generation problems with the current Netlify-based implementation.

## Migration to Fly.io

Based on similar issues (see #411), we're migrating social card generation from Netlify to **Fly.io** due to:
- Netlify Edge Function flakiness and reliability issues
- Better performance characteristics with Fly.io's infrastructure
- More predictable response times for social media crawlers
- Improved error handling and monitoring capabilities

## Current Issues

### 1. Netlify Edge Function Reliability Problems
- The current Netlify Edge Function at `/api/social-cards` experiences intermittent failures
- Timeout issues during social media crawler requests (Twitter: 2-3 seconds, Facebook: ~5 seconds)
- Current implementation uses mock/random data instead of real repository data
- Inconsistent performance and cold start issues
- No proper error handling or fallback mechanism when generation fails

### 2. Build-Time Generation Complexity
- The build script `scripts/assets/generate-social-cards.js` uses Playwright to generate cards
- Requires dev server running (`http://localhost:4173`) which isn't available in CI/CD
- 10-minute timeout configured but cards still fail to generate
- Supabase storage integration requires `SUPABASE_TOKEN` which might not be configured
- Architecture complexity mixing multiple generation approaches

### 3. Meta Tag Implementation Issues
- Meta tags in `meta-tags-provider.tsx` point to unreliable Netlify endpoints
- Fallback mechanism exists but may not work if primary endpoint times out
- URL construction for repo cards may be incorrect for new Fly.io architecture

## Root Causes

1. **Netlify Edge Function Limitations**: Unreliable performance and flakiness issues similar to #411
2. **Architecture Complexity**: Current system mixes build-time generation (Playwright screenshots) with runtime generation (Edge Function SVGs)
3. **Performance Inconsistency**: Netlify Edge Functions don't consistently meet social crawler timeout requirements (<3 seconds)
4. **Data Access**: Runtime function uses mock data instead of actual repository statistics
5. **Environment Dependencies**: Build process depends on local dev server which isn't available in production builds

## Proposed Solution - Fly.io Migration

### Phase 1: Fly.io Infrastructure Setup (Priority: HIGH)
- [ ] Deploy Fly.io application for social card generation
- [ ] Configure Fly.io app with proper scaling and performance settings
- [ ] Implement health checks and monitoring for Fly.io service
- [ ] Set up environment variables and secrets management
- [ ] Configure CDN caching with proper cache invalidation

### Phase 2: Social Card Service Implementation (Priority: HIGH)
- [ ] Create new social card generation service on Fly.io
- [ ] Optimize response times to meet social crawler requirements (<2 seconds)
- [ ] Implement proper error handling and fallback mechanisms
- [ ] Add real-time repository data integration with Supabase
- [ ] Configure proper HTTP headers for social media platforms

### Phase 3: Migration and Testing (Priority: MEDIUM)
- [ ] Update meta tags to point to new Fly.io endpoints
- [ ] Implement gradual migration with fallback to current system
- [ ] Add comprehensive monitoring and logging
- [ ] Test with all major social platforms (Twitter, Facebook, LinkedIn, Discord)
- [ ] Performance testing under load

### Phase 4: Cleanup and Optimization (Priority: LOW)
- [ ] Remove old Netlify Edge Function implementation
- [ ] Clean up build-time generation complexity
- [ ] Implement background job to regenerate cards periodically
- [ ] Add user profile cards in addition to repository cards

## Technical Implementation Details

### Fly.io Architecture Benefits

1. **Better Performance**:
   - Consistent sub-2-second response times
   - No cold start issues like Netlify Edge Functions
   - Better geographic distribution
   - More predictable scaling

2. **Improved Reliability**:
   - Better error handling and recovery
   - Health checks and automatic restarts
   - More robust infrastructure compared to Netlify Functions

3. **Enhanced Monitoring**:
   - Better observability and debugging tools
   - Performance metrics and alerting
   - Request tracing and error tracking

### Fly.io Service Implementation

```javascript
// New Fly.io service endpoint structure
// GET /social-cards/home
// GET /social-cards/{owner}/{repo}
// GET /social-cards/user/{username}

// Optimized for:
// - Response time < 2 seconds
// - Proper caching headers
// - Real repository data from Supabase
// - Fallback mechanisms
```

### Migration Strategy

1. **Parallel Deployment**: Deploy Fly.io service alongside existing Netlify function
2. **Gradual Migration**: Update meta tags with feature flags to test Fly.io
3. **Performance Monitoring**: Compare response times and reliability
4. **Full Cutover**: Switch all traffic to Fly.io once validated
5. **Cleanup**: Remove Netlify Edge Function after successful migration

## Testing Requirements

- [ ] Test with Twitter Card Validator
- [ ] Test with Facebook Sharing Debugger
- [ ] Test with LinkedIn Post Inspector
- [ ] Verify Discord/Slack embeds work
- [ ] Load testing to ensure performance under traffic spikes
- [ ] Error handling and fallback mechanism testing

## Success Criteria

1. Social cards generate successfully for all pages within 2 seconds via Fly.io
2. 99.9% uptime and reliability (improvement from current Netlify issues)
3. Fallback mechanism works when Fly.io service is unavailable
4. Cards display correctly on all major platforms (Twitter, Facebook, LinkedIn, Discord)
5. No timeout errors in production logs
6. Cards use real repository data (not mock data)
7. Improved monitoring and observability compared to current system

## Migration Timeline

- **Week 1**: Fly.io infrastructure setup and basic service deployment
- **Week 2**: Social card generation implementation and testing
- **Week 3**: Meta tag updates and gradual migration
- **Week 4**: Full cutover and Netlify cleanup

## References

- **Current Implementation**: `/netlify/functions/social-cards.mjs` (to be replaced)
- **Build Script**: `/scripts/assets/generate-social-cards.js` (to be simplified)
- **Meta Tags**: `/src/components/common/layout/meta-tags-provider.tsx` (to be updated)
- **Documentation**: `/src/components/social-cards/social-cards.mdx`
- **Related Issue**: #411 (similar Netlify reliability problems)

## Labels
- bug
- performance  
- social-cards
- high-priority
- migration
- fly.io