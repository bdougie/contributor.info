# Continue Review Webhook Handler

AI-powered code reviews using Continue Agent, integrated into the contributor.info webhook server.

## Features

- 🤖 Automated AI code reviews on every PR
- 💬 Interactive reviews via `@continue-agent` comments
- 📝 Custom rules from `.continue/rules/*.md`
- 🔐 GitHub App authentication for private repos
- ⚡ Runs in parallel with other webhook handlers

## How It Works

The continue-review handler is integrated into `fly-github-webhooks/src/server.js` and triggers on:

1. **Pull Request Events**: `opened`, `synchronize`, `ready_for_review`
2. **Issue Comment Events**: Comments containing `@continue-agent`

When triggered, it:
1. Posts a progress comment
2. Fetches PR files and loads project rules
3. Generates review using Continue CLI
4. Updates the comment with final review

## Architecture: Centralized Service

This is a **centralized GitHub App service** - you (the app owner) run the webhook server and provide Continue reviews for all users:

- **Users**: Just install the contributor-info GitHub App on their repositories
- **You**: Configure Continue API key and review settings once for everyone
- **No user setup**: Users don't need Continue accounts, API keys, or configuration

This model provides:
- ✅ Zero configuration for end users
- ✅ Consistent review quality across all repositories
- ✅ Centralized cost management and rate limiting
- ✅ Single source of truth for review rules

## Environment Variables (App Owner Only)

Configure these once in your Fly.io secrets:

```bash
# Required - your Continue API key
CONTINUE_API_KEY=your_continue_api_key

# Optional - customize the review configuration (defaults shown)
CONTINUE_ORG=continuedev
CONTINUE_CONFIG=continuedev/review-bot
```

### Customizing Review Configuration

As the app owner, you can customize the Continue configuration for all users:

**Option 1: Use a hub configuration** (easiest)
```bash
fly secrets set CONTINUE_CONFIG=your-org/custom-review-bot
```
- Create custom configurations at [Continue Hub](https://hub.continue.dev)
- Format: `organization/config-name`
- No Dockerfile changes needed

**Option 2: Mount a local config file** (advanced)
```bash
# 1. Add to Dockerfile
COPY your-config.yaml /app/config/review-config.yaml

# 2. Set the path
fly secrets set CONTINUE_CONFIG=/app/config/review-config.yaml
```

Your configuration controls review behavior for all users:
- AI model selection (Claude, GPT-4, etc.)
- Review rules and patterns
- Tool permissions and restrictions
- Custom prompts and review focus areas

See [Continue config.yaml documentation](https://docs.continue.dev/reference/config) for configuration options.

## Deployment

### 1. Set Fly.io Secrets

```bash
cd fly-github-webhooks
fly secrets set CONTINUE_API_KEY=your_key_here
```

### 2. Deploy to Fly.io

```bash
fly deploy
```

### 3. Verify Deployment

```bash
# Check logs
fly logs

# Check health
curl https://your-app.fly.dev/health
```

## Testing

### Test on contributor.info

1. Open a PR on this repository
2. Should see a Continue review comment automatically posted by the bot
3. Or comment with `@continue-agent check for security issues` for on-demand reviews

### Test on gh-datapipe (Private Repo)

1. Install the contributor-info GitHub App on `open-source-ready/gh-datapipe`
2. Open a PR
3. Continue review should work automatically with private repo access

**Note**: End users only need to install the GitHub App - no Continue setup required. The webhook server handles all Continue API interactions.

## Project Rules

Create rules in `.continue/rules/*.md`:

```markdown
---
globs: "**/*.{ts,tsx}"
description: "TypeScript best practices"
---

# TypeScript Standards

- Use strict type checking
- No implicit any
- Prefer interfaces over types for objects
```

Rules are automatically loaded and applied based on file glob patterns.

## Interactive Commands

Trigger specific reviews with PR comments:

```
@continue-agent check for security issues
@continue-agent review the TypeScript types
@continue-agent suggest performance improvements
```

## Architecture

```
GitHub Webhook
    ↓
fly-github-webhooks (Express server on Fly.io)
    ↓
handlers/continue-review.js
    ↓
Continue CLI (headless mode)
    ↓
GitHub Comment (review posted)
```

### Handler Integration

The handler is registered in `server.js` and runs in parallel with other handlers:

```javascript
// Pull request events
if (['opened', 'synchronize', 'ready_for_review'].includes(payload.action)) {
  handleContinueReview(payload, githubApp, supabase, logger).catch((err) =>
    logger.error('Continue review failed:', err)
  );
}

// Issue comment events
handleContinueReviewComment(payload, githubApp, supabase, logger).catch((err) =>
  logger.error('Continue review comment failed:', err)
);
```

## Troubleshooting

### Reviews Not Posting

**Check Continue API key:**
```bash
fly secrets list
```

**Check logs:**
```bash
fly logs --app your-app-name
```

**Verify Continue CLI is installed:**
The Continue CLI (`@continuedev/cli`) should be in `package.json` dependencies.

### Authentication Failures

**Verify GitHub App has correct permissions:**
- Contents: Read
- Pull requests: Write
- Issues: Write

**Check installation:**
```bash
# Logs will show installation ID
fly logs | grep "installation"
```

### Timeout Issues

Continue reviews have a 7-minute timeout. If reviews timeout:
- Reduce PR size
- Simplify rules
- Check Continue API status

## Local Development

The webhook server can run locally for testing:

```bash
cd fly-github-webhooks
npm install
npm start
```

For local webhook testing, you'll need to:
1. Expose local server (e.g., using Cloudflare Tunnel)
2. Update GitHub App webhook URL temporarily
3. Trigger webhooks from test PRs

**Tip**: It's faster to just deploy to Fly.io for testing since deployment is quick:

```bash
fly deploy  # Usually takes < 1 minute
```

## Performance

- Reviews run in parallel with other webhook handlers (non-blocking)
- Average review time: 30-60 seconds
- Concurrent reviews supported
- Progress comments provide user feedback during processing

## Migration from GitHub Action

If migrating from the GitHub Action-based continue-review:

1. The webhook handler provides the same functionality
2. No workflow files needed in user repositories
3. GitHub App installation is the only requirement
4. Rules location stays the same (`.continue/rules/*.md`)
5. All existing rules work without modification

## Security

- GitHub App private key stored as Fly.io secret
- Webhook signature verification required
- Installation tokens expire and refresh automatically
- No sensitive data logged (debug mode can be toggled)

## Monitoring

Check webhook processing:

```bash
# Metrics endpoint
curl https://your-app.fly.dev/metrics

# Health check
curl https://your-app.fly.dev/health
```

Metrics include:
- Webhooks received/processed/failed
- Average processing time
- Success rate

## Related Files

- Handler: `fly-github-webhooks/src/handlers/continue-review.js`
- Server: `fly-github-webhooks/src/server.js`
- Original Action: `actions/continue-review/index.ts` (for reference)