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

## Environment Variables

Add these to your Fly.io secrets:

```bash
# Required
CONTINUE_API_KEY=your_continue_api_key

# Optional (defaults shown)
CONTINUE_ORG=continuedev
CONTINUE_CONFIG=continuedev/review-bot
```

### Using Custom Continue Configurations

The `CONTINUE_CONFIG` variable accepts two formats:

1. **Hub Configuration** (default): `continuedev/review-bot`
   - References a configuration from Continue Hub
   - Format: `organization/config-name`
   - Example: `CONTINUE_CONFIG=your-org/your-config`

2. **Local Config File**: `/path/to/config.yaml`
   - Path to a custom `config.yaml` file
   - Must be accessible within the Docker container
   - Example: `CONTINUE_CONFIG=/app/config/review-config.yaml`

To use your own configuration:

```bash
# Option 1: Use a hub configuration
fly secrets set CONTINUE_CONFIG=your-org/custom-review-bot

# Option 2: Mount a custom config file (requires Dockerfile changes)
# Add to Dockerfile: COPY your-config.yaml /app/config/review-config.yaml
# Then set: fly secrets set CONTINUE_CONFIG=/app/config/review-config.yaml
```

The configuration file supports:
- Custom AI model selection (Claude, GPT-4, etc.)
- Review rules and patterns
- Tool permissions and restrictions
- Custom prompts and behaviors

See [Continue config.yaml documentation](https://docs.continue.dev/reference/config) for full configuration options.

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
2. Should see a Continue review comment automatically
3. Or comment with `@continue-agent check for security issues`

### Test on gh-datapipe (Private Repo)

1. Install the contributor-info GitHub App on `open-source-ready/gh-datapipe`
2. Open a PR
3. Continue review should work with private repo access

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