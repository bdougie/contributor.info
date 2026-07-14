# Chart Rendering Service for contributor.info

Fly.io service that renders analytics chart screenshots (Playwright/Chromium) for social sharing.

Social card rendering (home/repo/user og:images) moved to a same-origin Netlify Function — see `netlify/functions/social-cards.mts` and `docs/social-cards.md` in the main repo. This service keeps permanent redirects for the old card URLs because social platforms cache og:image URLs from past shares.

## Features

- ✅ Chart screenshots (lottery-factor, self-selection, health-factors, distribution) via headless Chromium
- ✅ Two-tier caching: in-memory LRU + Supabase Storage
- ✅ Real-time data from Supabase database
- ✅ Permanent redirects for legacy `/social-cards/*` URLs

## Endpoints

### Health Check
```
GET /health
```

### Metrics
```
GET /metrics
```

### Charts
```
GET /charts/{chartType}?owner={owner}&repo={repo}
```
`chartType`: `lottery-factor`, `self-selection`, `health-factors`, `distribution`

### Legacy Social Card Redirects
```
GET /social-cards/{type}?...   -> 301 https://contributor.info/social-cards/{type}?...
GET /api/social-cards?...      -> 301 https://contributor.info/social-cards/{type}?...
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

3. Run the development server:
```bash
npm run dev
```

4. Test locally:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/social-cards/home > test-home.svg
open test-home.svg
```

## Deployment

### Prerequisites

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly.io:
```bash
fly auth login
```

### Deploy

Run the deployment script:
```bash
./deploy.sh
```

Or manually:
```bash
# Create app (first time only)
fly apps create contributor-info-social-cards

# Set secrets
fly secrets set SUPABASE_URL=your-url-here
fly secrets set SUPABASE_ANON_KEY=your-key-here

# Deploy
fly deploy

# Check status
fly status
```

## Performance Targets

- **Response Time**: < 2 seconds (social crawler requirement)
- **Generation Time**: < 100ms (SVG generation)
- **Database Query**: < 500ms (with connection pooling)
- **Cache Hit Ratio**: > 80% (CDN caching)

## Monitoring

### Fly.io Dashboard
```bash
fly dashboard
```

### Logs
```bash
fly logs
```

### SSH into running instance
```bash
fly ssh console
```

## Testing

### Social Media Validators

1. **Twitter Card Validator**
   - Visit: https://cards-dev.twitter.com/validator
   - Enter: `https://contributor.info`

2. **Facebook Sharing Debugger**
   - Visit: https://developers.facebook.com/tools/debug/
   - Enter: `https://contributor.info`

3. **LinkedIn Post Inspector**
   - Visit: https://www.linkedin.com/post-inspector/
   - Enter: `https://contributor.info`

### Load Testing
```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon -c 10 -d 30 https://contributor-info-social-cards.fly.dev/social-cards/home
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Social Media   │────▶│   Fly.io     │────▶│   Supabase   │
│    Crawlers     │     │   Service    │     │   Database   │
└─────────────────┘     └──────────────┘     └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  CDN Cache   │
                        │  (24 hours)  │
                        └──────────────┘
```

## Troubleshooting

### Service not responding
```bash
fly restart
fly status
fly logs
```

### Database connection issues
- Check Supabase status: https://status.supabase.com
- Verify secrets: `fly secrets list`
- Check connection logs: `fly logs | grep supabase`

### Performance issues
- Check metrics: `curl https://contributor-info-social-cards.fly.dev/metrics`
- Scale up if needed: `fly scale vm shared-cpu-2x`
- Add more instances: `fly scale count 2`

## Migration from Netlify

The migration from Netlify Edge Functions involved:

1. **Service Migration**: Moving from serverless to containerized service
2. **Data Integration**: Direct Supabase connection vs mock data
3. **URL Structure**: New endpoint pattern for better organization
4. **Performance**: Optimized SVG generation and caching
5. **Reliability**: Better error handling and fallbacks

## License

Part of the contributor.info project.