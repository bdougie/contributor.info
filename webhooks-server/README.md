# Webhooks Server

Consolidated GitHub App webhook handler service for contributor.info, deployed on Fly.io.

## Architecture

This is a minimal Express server that imports the consolidated webhook handlers from `../app/webhooks/`, providing a deployment wrapper for Fly.io.

### Key Components

- **Express Server** (`src/server.ts`): HTTP server with webhook routing and security
- **Consolidated Handlers** (`../app/webhooks/`): TypeScript webhook handlers with shared services
  - `issues.ts` - Issue event handler
  - `pull-request.ts` - PR event handler (includes Check Runs)
  - `pr-check-runs.ts` - GitHub Check Runs with ML-powered similarity

### Features

- ✅ **Webhook signature verification** (HMAC-SHA256)
- ✅ **Rate limiting** (100 requests/minute per IP)
- ✅ **Security headers** (Helmet)
- ✅ **Health checks** (`/health`)
- ✅ **Metrics** (`/metrics`)
- ✅ **Graceful shutdown** (SIGTERM/SIGINT)

## Local Development

### Prerequisites

- Node.js 20+
- TypeScript
- Environment variables (see `.env.example`)

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Run in development mode
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Run production build
npm start
```

### Testing Webhooks Locally

```bash
# Start the server
npm run dev

# In another terminal, send a test webhook
curl -X POST http://localhost:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-GitHub-Delivery: 12345" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"zen": "Keep it simple"}'
```

## Deployment

### Deploy to Fly.io

```bash
# First time: Create the app
fly apps create contributor-info-webhooks

# Set secrets
fly secrets set \
  CONTRIBUTOR_APP_ID=your_app_id \
  CONTRIBUTOR_APP_KEY="$(cat path/to/private-key.pem)" \
  GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_ANON_KEY=your_anon_key

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs

# Check health
curl https://contributor-info-webhooks.fly.dev/health
```

### Automated Deployment

GitHub Actions workflow (`.github/workflows/deploy-webhooks-server.yml`) automatically deploys on:
- Push to `main` branch (when `webhooks-server/` or `app/webhooks/` changes)
- Manual trigger via `workflow_dispatch`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTRIBUTOR_APP_ID` | Yes | GitHub App ID |
| `CONTRIBUTOR_APP_KEY` | Yes | GitHub App private key (PEM format) |
| `GITHUB_APP_WEBHOOK_SECRET` | Yes | Webhook secret for signature verification |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `PORT` | No | Server port (default: 8080) |
| `NODE_ENV` | No | Environment (production/development) |

## Endpoints

### `POST /webhook`
GitHub webhook handler endpoint.

**Headers:**
- `X-GitHub-Event`: Event type (issues, pull_request, etc.)
- `X-GitHub-Delivery`: Unique delivery ID
- `X-Hub-Signature-256`: HMAC signature for verification

**Response:**
```json
{
  "status": "success",
  "event": "pull_request",
  "delivery_id": "12345-67890",
  "result": {}
}
```

### `GET /health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": "3600s",
  "supabase": "configured",
  "github_app": "configured"
}
```

### `GET /metrics`
Performance metrics endpoint.

**Response:**
```json
{
  "webhooksReceived": 1234,
  "webhooksProcessed": 1230,
  "webhooksFailed": 4,
  "uptime": "3600s",
  "success_rate": "99.68%"
}
```

## Architecture Decisions

### Why Separate Server?

The consolidated webhook handlers in `app/webhooks/` are TypeScript modules that need a deployment wrapper. This minimal Express server provides:

1. **HTTP layer** - Routes webhooks to handlers
2. **Security** - Signature verification, rate limiting, CORS
3. **Monitoring** - Health checks and metrics
4. **Platform adapter** - Fly.io deployment configuration

### Why Fly.io?

- **Always-on**: Webhooks require immediate response (no cold starts)
- **Global edge**: Low latency webhook processing
- **Persistent**: Maintains metrics and state across requests
- **Cost-effective**: Free tier supports low-volume webhooks

## Troubleshooting

### Webhook signature verification fails
- Verify `GITHUB_APP_WEBHOOK_SECRET` matches GitHub App settings
- Check webhook payload isn't modified by proxies

### TypeScript compilation errors
- Run `npm run typecheck` to see detailed errors
- Ensure parent `app/` and `src/` directories are accessible
- Check import paths use `.js` extension (ES modules)

### Handler not found
- Verify import paths in `server.ts` match actual file locations
- Check handlers are exported with correct names

### Deployment fails
- Verify all environment variables are set in Fly.io secrets
- Check Dockerfile builds successfully locally: `docker build -t test .`
- Review Fly.io logs: `fly logs`

## Contributing

When adding new webhook handlers:

1. Add handler to `../app/webhooks/`
2. Import and route in `src/server.ts`
3. Update this README
4. Test locally with `npm run dev`
5. Deploy: `fly deploy`
