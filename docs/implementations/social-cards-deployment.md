# Social Cards Production Deployment Guide (Deprecated)

## Note: This documentation is for the OLD build-time generation system which has been replaced

**Current System**: Social cards are now served dynamically by a Fly.io service.
See `/docs/social-cards.md` for the current implementation.

## Legacy Architecture (No Longer Used)

### Previous Approach: Supabase Storage + Build-Time Generation

**Why Supabase over Netlify Functions:**
- **Performance**: Zero latency after first load via global CDN
- **Cost**: No function execution costs, only storage (~$0.021/GB/month)
- **Reliability**: No function timeouts or cold starts
- **Scale**: Handles unlimited traffic without function limits
- **Simplicity**: Fewer moving parts than serverless functions

**Alternative approaches considered:**
- ❌ Netlify Functions: 10-second timeout limits, cold starts, execution costs
- ❌ External services (Bannerbear/Cloudinary): Vendor lock-in, additional costs
- ✅ **Supabase Storage**: Perfect fit for static asset CDN with global distribution

## Prerequisites

### Environment Variables

```bash
# Required for build process
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_TOKEN=your-service-role-key  # NOT the anon key

# Optional - for custom base URL during builds
BASE_URL=https://your-domain.com  # Defaults to localhost:4173 for production builds
```

### Dependencies

All required dependencies are included in package.json:
- `playwright` - Browser automation for screenshot generation
- `@supabase/supabase-js` - Supabase client
- `react-helmet-async` - Dynamic meta tag management

## Deployment Steps

### 1. Initial Setup

```bash
# Install dependencies
npm install

# Set up Supabase storage bucket
npm run setup-storage

# Set up automated regeneration system (optional)
npm run setup-regeneration
```

### 2. Build Process

The build process now includes social card generation:

```bash
# Full build with social cards
npm run build
```

This runs:
1. `npm test` - Run all tests
2. `tsc -b` - TypeScript compilation
3. `vite build` - Build the application
4. `node scripts/build-with-social-cards.js` - Generate and upload social cards

### 3. Storage Configuration

The system automatically creates and configures the `social-cards` bucket with:

- **Public access** for CDN distribution
- **Service role permissions** for build uploads
- **Cache control** headers (1 year cache)
- **File size limits** (5MB per image)
- **MIME type restrictions** (PNG/JPEG only)

### 4. Generated Social Cards

The build process generates cards for:

#### Home Page Card
- URL: `/social-cards/home`
- Dimensions: 1200x630px
- Contains: Site branding, tagline, key statistics

#### Repository Cards  
- URL: `/social-cards/{owner}/{repo}`
- Dynamic content: Repository stats, contributor avatars, activity charts
- Popular repositories pre-generated during build

## Testing and Validation

### Platform Validators

Use these tools to test social card rendering:

```bash
# Run automated meta tag and image testing
npm run test-social-cards
```

Manual testing platforms:
- **Twitter**: https://cards-dev.twitter.com/validator
- **Facebook**: https://developers.facebook.com/tools/debug/
- **LinkedIn**: https://www.linkedin.com/post-inspector/
- **Discord/Slack**: Share links directly to test preview

### Performance Monitoring

```bash
# Monitor CDN performance and cache hit rates
npm run monitor-cdn
```

This checks:
- Global load times from multiple regions
- File sizes and compression
- Cache header configuration
- Storage usage statistics

## Maintenance

### Automated Regeneration

The system includes automated card regeneration:

```bash
# Check which cards need regeneration
npm run check-regeneration
```

**Regeneration triggers:**
- Cards older than 30 days
- High-priority repositories (configurable)
- Significant activity changes (>20% change in PR count)

**Setting up automated regeneration:**
1. Add to your CI/CD pipeline as a daily job
2. Configure webhook triggers for repository updates
3. Monitor the `social_card_tracking` table for metrics

### Manual Regeneration

For immediate card updates:

```bash
# Regenerate all social cards
npm run generate-social-cards

# Or build the entire project (includes card generation)
npm run build
```

### Storage Management

**Monitor storage usage:**
- Free tier: 1GB storage included
- Estimated usage: ~50KB per card
- Monitor via Supabase Dashboard → Storage

**Cleanup old cards:**
```bash
# The regeneration system handles cleanup automatically
# Manual cleanup can be done via Supabase Dashboard
```

## Troubleshooting

### Common Issues

**1. Build fails during card generation**
```bash
# Check if preview server is accessible
curl http://localhost:4173/social-cards/home

# Verify Supabase credentials
npm run setup-storage
```

**2. Cards not displaying in social platforms**
```bash
# Test meta tags
npm run test-social-cards

# Verify public URLs are accessible
# Check browser network tab for 404s
```

**3. Storage permission errors**
```bash
# Verify service role key is set
echo $SUPABASE_TOKEN

# Re-run storage setup
npm run setup-storage
```

**4. Performance issues**
```bash
# Check CDN performance
npm run monitor-cdn

# Verify cache headers in browser DevTools
# Headers should include: cache-control: max-age=31536000
```

### Debug Mode

For development debugging:

```bash
# Start dev server
npm run dev

# Visit card preview page
http://localhost:5173/dev/social-cards

# Test individual card routes
http://localhost:5173/social-cards/home
http://localhost:5173/social-cards/facebook/react
```

## Performance Optimization

### Current Performance Metrics

- **Average load time**: <100ms (after CDN cache)
- **File sizes**: 40-80KB per card (optimized PNG)
- **Global CDN**: Supabase global edge network
- **Cache duration**: 1 year (31536000 seconds)

### Optimization Opportunities

1. **WebP format**: Consider generating WebP versions for better compression
2. **Image optimization**: Further optimize PNG compression
3. **Lazy loading**: Implement progressive image loading
4. **Multiple formats**: Generate different sizes for different platforms

## Monitoring and Analytics

### Key Metrics to Track

1. **Build Performance**
   - Social card generation time
   - Upload success rates
   - Storage usage growth

2. **Runtime Performance**
   - CDN cache hit rates
   - Global load times
   - Error rates

3. **Social Engagement**
   - Click-through rates from social platforms
   - Share frequency
   - Platform-specific performance

### Alerting

Set up monitoring for:
- Build failures during card generation
- Storage quota approaching limits
- CDN performance degradation
- High error rates on social card URLs

## Cost Analysis

### Supabase Storage Costs
- **Free tier**: 1GB included
- **Paid tier**: $0.021/GB/month
- **Bandwidth**: $0.09/GB (outbound)

### Estimated Monthly Costs
- **100 repositories**: ~5MB storage → Free tier
- **1,000 repositories**: ~50MB storage → Free tier  
- **10,000 repositories**: ~500MB storage → Free tier
- **CDN bandwidth**: Included in Supabase hosting

## Rollback Procedure

If issues arise with social cards:

1. **Disable card generation in builds**:
   ```bash
   # Temporarily modify package.json
   "build": "npm test && tsc -b && vite build"
   ```

2. **Use fallback static image**:
   - The existing `/public/social.png` serves as fallback
   - Meta tags automatically fallback to static image

3. **Debug and fix**:
   - Run tests: `npm run test-social-cards`
   - Check storage: `npm run monitor-cdn`
   - Fix issues and re-enable generation

## Support and Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Monitor storage usage
- Check CDN performance metrics
- Review error logs

**Monthly:**
- Update popular repository list
- Regenerate priority cards
- Review and optimize file sizes

**Quarterly:**
- Audit social engagement metrics
- Consider new platform requirements
- Update card design if needed

### Contact and Escalation

- **Build issues**: Check CI/CD logs and package.json scripts
- **Storage issues**: Supabase Dashboard → Storage → social-cards bucket
- **Performance issues**: Use `npm run monitor-cdn` for diagnostics
- **Meta tag issues**: Use `npm run test-social-cards` for validation

---

*This deployment guide ensures reliable, performant social card generation and distribution for contributor.info using Supabase's global CDN infrastructure.*