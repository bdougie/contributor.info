# GitHub Webhook Handler Service

A reliable, scalable GitHub App webhook handler deployed on Fly.io, replacing the problematic Netlify Functions implementation.

## Overview

This service handles GitHub webhook events for the contributor.info GitHub App, providing:
- Real-time processing of GitHub events (PRs, issues, comments, installations)
- Automatic welcome comments for first-time contributors
- Database tracking of all GitHub activity
- Special label handling and automation
- Command processing in comments

## Architecture

- **Platform**: Fly.io (persistent Node.js service)
- **Runtime**: Node.js 20 with Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: GitHub App with JWT tokens
- **Region**: San Jose (primary), auto-scales globally

## Features

### Webhook Events Handled

- **Pull Requests**: opened, closed, reopened, edited, synchronized, labeled
- **Issues**: opened, closed, reopened, edited, labeled
- **Issue Comments**: created, edited, deleted
- **Installations**: created, deleted, repositories_added, repositories_removed

### Automated Responses

1. **First-time Contributors**: Welcome messages on first PR/issue
2. **Good First Issues**: Guidance for new contributors
3. **Help Wanted**: Call for community contributions
4. **Bug Reports**: Template for reproduction steps
5. **Comment Commands**: `/help`, `/assign me`, etc.

## Deployment

### Prerequisites

- [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Fly.io account
- GitHub App credentials
- Supabase project

### Environment Variables

```bash
# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### Deploy to Fly.io

1. **First Deployment**:
   ```bash
   cd fly-github-webhooks
   ./deploy.sh
   ```
   The script will prompt for secrets on first run.

2. **Subsequent Deployments**:
   ```bash
   fly deploy -a contributor-info-webhooks
   ```

3. **Update Secrets**:
   ```bash
   fly secrets set KEY=value -a contributor-info-webhooks
   ```

### GitHub App Configuration

1. Go to your GitHub App settings
2. Update the Webhook URL to: `https://contributor-info-webhooks.fly.dev/webhook`
3. Ensure these permissions are granted:
   - **Repository**: Issues, Pull requests, Metadata
   - **Organization**: Members (read)
4. Subscribe to these events:
   - Issues
   - Issue comment
   - Pull request
   - Pull request review
   - Pull request review comment
   - Installation

## Development

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env` file**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run locally**:
   ```bash
   npm run dev
   ```

4. **Test webhooks locally** (using ngrok):
   ```bash
   ngrok http 8080
   # Update GitHub App webhook URL to ngrok URL
   ```

### Testing

```bash
npm test
```

## Monitoring

### Health Check
```bash
curl https://contributor-info-webhooks.fly.dev/health
```

### Metrics
```bash
curl https://contributor-info-webhooks.fly.dev/metrics
```

### Logs
```bash
fly logs -a contributor-info-webhooks
```

### SSH into container
```bash
fly ssh console -a contributor-info-webhooks
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service information |
| `/health` | GET | Health check |
| `/metrics` | GET | Performance metrics |
| `/webhook` | POST | GitHub webhook receiver |

## Performance

- **Response Time**: < 200ms average
- **Uptime Target**: 99.9%
- **Concurrent Webhooks**: 20 soft limit, 25 hard limit
- **Memory Usage**: ~100MB baseline
- **CPU**: Shared CPU, auto-scales as needed

## Troubleshooting

### Webhook Delivery Failures

1. Check GitHub App webhook deliveries tab
2. Verify signature secret matches
3. Check Fly.io logs: `fly logs -a contributor-info-webhooks`

### Database Connection Issues

1. Verify Supabase URL and keys
2. Check Supabase service status
3. Ensure RLS policies allow operations

### Memory Issues

Scale up if needed:
```bash
fly scale memory 512 -a contributor-info-webhooks
```

## Migration from Netlify Functions

This service replaces the Netlify Functions webhook handler which suffered from:
- 10-second timeout limitations
- Cold start delays
- Stateless execution issues
- Limited debugging capabilities

Key improvements:
- Persistent connections
- No timeout limitations
- Better error handling and retry logic
- Comprehensive logging and metrics
- Proper async processing

## Security

- Webhook signatures verified using HMAC-SHA256
- Non-root container user
- Environment variables stored as Fly secrets
- HTTPS enforced
- Rate limiting via Fly.io platform

## Related Documentation

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps)
- [Fly.io Documentation](https://fly.io/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Issue #411](https://github.com/bdougie/contributor.info/issues/411) - Migration rationale

## Support

For issues or questions:
1. Check the logs: `fly logs -a contributor-info-webhooks`
2. Review metrics: `https://contributor-info-webhooks.fly.dev/metrics`
3. Open an issue in the main repository