# contributor.info GitHub App

This directory contains the GitHub App implementation for contributor.info, providing PR-time insights and issue intelligence.

## Directory Structure

```
app/
├── api/                 # API endpoints for app management
│   ├── installations.ts # Manage GitHub App installations
│   ├── settings.ts      # User preferences for app behavior
│   └── webhooks.ts      # Webhook event handlers
├── config/              # Configuration files
│   ├── app.ts          # GitHub App configuration
│   ├── permissions.ts   # Required permissions manifest
│   └── webhooks.ts      # Webhook event types
├── lib/                 # Core libraries
│   ├── auth.ts         # JWT and installation token handling
│   ├── client.ts       # GitHub App API client
│   └── octokit.ts      # Configured Octokit instance
├── services/            # Business logic
│   ├── insights.ts     # Generate contributor insights
│   ├── similarity.ts   # Issue similarity matching
│   ├── reviewers.ts    # Reviewer recommendations
│   └── comments.ts     # PR comment formatting
├── types/               # TypeScript definitions
│   ├── github.ts       # GitHub webhook payloads
│   ├── insights.ts     # App-specific types
│   └── database.ts     # Database models
├── utils/               # Utility functions
│   ├── cache.ts        # Redis caching helpers
│   ├── metrics.ts      # Performance tracking
│   └── webhooks.ts     # Webhook verification
└── webhooks/           # Webhook event handlers
    ├── installation.ts  # App installation events
    ├── issues.ts       # Issue events
    └── pull-request.ts # PR events
```

## Key Features

### 1. PR-Time Insights
Automatically comments on PRs with:
- Contributor statistics and expertise
- Smart reviewer suggestions
- Related issues and context
- Potential impact analysis

### 2. Issue Intelligence
- Semantic similarity matching
- Cross-repository issue tracking
- Duplicate detection
- Fix confirmation

### 3. Installation Management
- Easy one-click installation
- Per-repository configuration
- Team-wide settings
- Usage analytics

## Setup Instructions

### 1. Create GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Use configuration from `app/config/app.ts`
4. Set webhook URL to: `https://contributor.info/api/github/webhook`
5. Generate and save private key

### 2. Environment Variables

```bash
# GitHub App credentials
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key_base64
GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret

# App configuration
GITHUB_APP_NAME=contributor-insights
GITHUB_APP_SLUG=contributor-insights
```

### 3. Database Setup

Run migrations to add app-specific tables:
```bash
npm run db:migrate -- app/migrations/
```

### 4. Development

```bash
# Run webhook listener locally
npm run app:dev

# Test webhook handling
npm run app:test-webhook

# Generate types from GitHub webhooks
npm run app:generate-types
```

## API Endpoints

### Installation Management
- `GET /api/github-app/installations` - List user's installations
- `POST /api/github-app/installations/:id/config` - Update settings
- `DELETE /api/github-app/installations/:id` - Uninstall

### Webhook Handler
- `POST /api/github/webhook` - GitHub webhook events

### Settings
- `GET /api/github-app/settings/:installation_id`
- `PUT /api/github-app/settings/:installation_id`

## Webhook Events

The app listens for:
- `installation` - App installed/uninstalled
- `pull_request` - PR opened/edited/closed
- `issues` - Issue opened/edited/closed
- `issue_comment` - Comments on issues/PRs
- `pull_request_review` - Review submitted

## Security

- All webhooks verified using HMAC-SHA256
- Installation tokens cached for 1 hour
- JWT tokens for app authentication
- Rate limiting on all endpoints
- Audit logging for installations

## Monitoring

Track these metrics:
- Installation count
- PR comments posted
- API rate limit usage
- Webhook processing time
- Error rates by event type

## Development Guidelines

1. **Error Handling**: Always gracefully handle API failures
2. **Rate Limits**: Respect GitHub's rate limits, use app limits when available
3. **Caching**: Cache expensive operations (contributor stats, similarities)
4. **Security**: Never log sensitive data, verify all webhooks
5. **Performance**: Process webhooks async, respond quickly