# Social Cards Service for contributor.info

This is the Fly.io-based social card generation service for contributor.info, replacing the previous Netlify Edge Function implementation to improve reliability and performance.

## Why Fly.io?

We migrated from Netlify Edge Functions to Fly.io due to:
- **Better Performance**: Consistent sub-2-second response times
- **Improved Reliability**: No cold start issues or flakiness
- **Real Data Integration**: Direct Supabase connection for real-time stats
- **Better Monitoring**: Enhanced observability and debugging

## Features

- ✅ Dynamic SVG generation for social media cards
- ✅ Real-time data from Supabase database
- ✅ Sub-100ms generation time (target)
- ✅ Proper caching headers for CDN optimization
- ✅ Fallback mechanisms for database failures
- ✅ Support for home, repository, and user cards

## Endpoints

### Health Check
```
GET /health
```

### Metrics
```
GET /metrics
```

### Social Cards

#### Home Page Card
```
GET /social-cards/home
```

#### Repository Card
```
GET /social-cards/repo?owner={owner}&repo={repo}
```
Example: `/social-cards/repo?owner=facebook&repo=react`

#### User Card
```
GET /social-cards/user?username={username}
```
Example: `/social-cards/user?username=bdougie`

### Legacy Compatibility
```
GET /api/social-cards?owner={owner}&repo={repo}
```
(Redirects to new endpoint structure)

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