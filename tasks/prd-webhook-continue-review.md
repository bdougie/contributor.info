# PRD: Webhook-Based Continue Review System

## Overview

✅ **COMPLETED**: Integrated continue-review into existing `fly-github-webhooks` infrastructure, enabling:
- Webhook-based reviews (no GitHub Action files needed)
- Private repository support via GitHub App
- Fast deployment to Fly.io
- Parallel execution with other webhook handlers

## Current State Analysis

### Existing Implementation
- **Location**: `actions/continue-review/index.ts`
- **Trigger**: GitHub Actions workflow (`.github/workflows/continue-review.yml`)
- **Authentication**: GitHub App with private key
- **Review Engine**: Continue CLI via child process
- **Dependencies**: `@actions/core`, `@actions/github`, Continue CLI

### Key Features to Preserve
- AI-powered code reviews using Continue Agent
- Custom rules from `.continue/rules/*.md`
- Interactive commands via `@continue-agent` comments
- Sticky comment updates
- Context-aware analysis with codebase patterns
- Enhanced prompts with project context

### Limitations
- Requires users to add GitHub Action workflow files
- Cannot run locally for development
- No dry-run testing capability
- Tightly coupled to GitHub Actions environment

## Implementation Plan

### Phase 1: Core Webhook Server (HIGH Priority)

**Goal**: Create Express-based webhook server that receives GitHub events

**Deliverables**:
- [ ] Express server with webhook endpoint (`/webhook`)
- [ ] GitHub webhook signature verification
- [ ] Event type routing (pull_request, issue_comment)
- [ ] Environment configuration (.env support)
- [ ] Basic error handling and logging

**Technical Details**:
```typescript
// server/webhook-server.ts
- POST /webhook - Main webhook endpoint
- POST /webhook/test - Test endpoint for dry-run
- GET /health - Health check
```

**Acceptance Criteria**:
- Server starts and listens on configurable port
- Webhook signature verification works
- Events are properly parsed and routed
- Logs show incoming webhook payloads in debug mode

---

### Phase 2: Local Development with ngrok (HIGH Priority)

**Goal**: Enable local testing with ngrok tunneling

**Deliverables**:
- [ ] ngrok integration script
- [ ] Development environment setup
- [ ] Local webhook registration helper
- [ ] Environment-specific configuration (local vs production)

**Technical Details**:
```typescript
// scripts/dev-server.ts
- Automatically start ngrok tunnel
- Register webhook with GitHub App
- Hot reload on code changes
- Pretty logging for development
```

**Acceptance Criteria**:
- `npm run dev:webhook` starts server with ngrok
- Webhook URL is automatically registered
- Local changes trigger reviews on test PRs
- Logs clearly show webhook events

---

### Phase 3: Dry-Run Mode (HIGH Priority)

**Goal**: Test reviews without posting to GitHub

**Deliverables**:
- [ ] Dry-run flag support
- [ ] Mock GitHub API responses
- [ ] Local output of review results
- [ ] Test fixtures for common scenarios

**Technical Details**:
```typescript
// server/dry-run.ts
- DRY_RUN=true environment variable
- Mock Octokit client
- File-based output for review results
- Test data fixtures
```

**Acceptance Criteria**:
- Dry-run mode generates reviews without API calls
- Review output saved to local files
- All GitHub API calls are mocked
- Test suite validates dry-run behavior

---

### Phase 4: Review Processing Logic (MEDIUM Priority)

**Goal**: Extract and adapt review logic from GitHub Action

**Deliverables**:
- [ ] Review processor module (extracted from index.ts)
- [ ] Rule loading system
- [ ] Continue CLI integration
- [ ] Comment posting logic
- [ ] Metrics tracking

**Technical Details**:
```typescript
// server/review-processor.ts
- class ReviewProcessor
  - processWebhook(event)
  - loadRules(files)
  - generateReview(context)
  - postReview(pr, review)
```

**Acceptance Criteria**:
- Review logic works identically to GitHub Action
- All existing rules are supported
- Enhanced prompts with codebase analysis
- Metrics are tracked and logged

---

### Phase 5: GitHub App Authentication (MEDIUM Priority)

**Goal**: Implement secure authentication for webhook server

**Deliverables**:
- [ ] App installation detection
- [ ] Installation access token generation
- [ ] Token caching with expiration
- [ ] Private repository access verification

**Technical Details**:
```typescript
// server/github-auth.ts
- class GitHubAppAuth
  - getInstallationToken(installationId)
  - refreshToken()
  - verifyRepoAccess(owner, repo)
```

**Acceptance Criteria**:
- Tokens are cached and refreshed automatically
- Private repository access works
- Installation permissions are validated
- Secure storage of private key

---

### Phase 6: Deployment & Documentation (LOW Priority)

**Goal**: Production deployment and comprehensive documentation

**Deliverables**:
- [ ] Docker containerization
- [ ] Railway/Render deployment config
- [ ] Environment variables documentation
- [ ] Local development guide
- [ ] Troubleshooting guide

**Acceptance Criteria**:
- One-command deployment to production
- Complete setup documentation
- Local development is straightforward
- Troubleshooting covers common issues

---

## Architecture Design

### Webhook Flow

```
GitHub Event → Webhook Server → Event Router → Review Processor → Continue CLI → Post Comment
                     ↓
                ngrok (local)
                     ↓
              http://localhost:3000/webhook
```

### Components

1. **Webhook Server** (`server/webhook-server.ts`)
   - Express server
   - Webhook signature verification
   - Event routing
   - Error handling

2. **Review Processor** (`server/review-processor.ts`)
   - Event handling logic
   - Rule loading
   - Continue CLI execution
   - Comment management

3. **GitHub Auth** (`server/github-auth.ts`)
   - App authentication
   - Installation token management
   - API client creation

4. **Dry-Run Mode** (`server/dry-run.ts`)
   - Mock API client
   - Local file output
   - Test fixtures

5. **Development Tools** (`scripts/dev-server.ts`)
   - ngrok integration
   - Auto-registration
   - Hot reload

### Environment Variables

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# Continue Configuration
CONTINUE_API_KEY="your-continue-api-key"
CONTINUE_ORG="continuedev"
CONTINUE_CONFIG="continuedev/review-bot"

# Server Configuration
PORT=3000
NODE_ENV=development|production

# Development
DRY_RUN=true|false
DEBUG_MODE=true|false
NGROK_AUTH_TOKEN="your-ngrok-token"
```

### File Structure

```
server/
├── webhook-server.ts         # Main Express server
├── review-processor.ts       # Review logic (extracted from action)
├── github-auth.ts           # GitHub App authentication
├── event-router.ts          # Webhook event routing
├── dry-run.ts              # Dry-run mode implementation
└── types.ts                # Shared TypeScript types

scripts/
├── dev-server.ts           # Local development with ngrok
├── setup-webhook.ts        # GitHub webhook registration
└── test-webhook.ts         # Manual webhook testing

tests/
├── webhook-server.test.ts
├── review-processor.test.ts
└── fixtures/
    ├── pr-opened.json
    └── issue-comment.json
```

## Testing Strategy

### Local Testing with Private Repo

1. **Setup ngrok**:
   ```bash
   npm run dev:webhook
   # Outputs: https://abc123.ngrok.io
   ```

2. **Configure GitHub App**:
   - Webhook URL: `https://abc123.ngrok.io/webhook`
   - Install on `open-source-ready/gh-datapipe`

3. **Test Scenarios**:
   - Open PR in gh-datapipe
   - Comment with `@continue-agent review security`
   - Verify review appears in PR comments

### Dry-Run Testing

```bash
DRY_RUN=true npm run webhook:test -- --pr 123 --repo gh-datapipe
```

Expected output:
- Review saved to `dry-run-output/pr-123-review.md`
- No GitHub API calls made
- Continue CLI executed successfully

## Success Criteria

- [ ] Webhook server handles PR and comment events
- [ ] Local development works with ngrok
- [ ] Dry-run mode generates reviews without API calls
- [ ] Private repository (gh-datapipe) reviews work
- [ ] All existing continue-review features preserved
- [ ] Documentation covers setup and troubleshooting
- [ ] No GitHub Action workflow files needed by users

## Migration Path

1. Deploy webhook server (Phase 1-5)
2. Register webhook with GitHub App
3. Test with contributor.info repo
4. Test with gh-datapipe private repo
5. Document differences from Action-based approach
6. Deprecate GitHub Action workflow (keep as fallback initially)

## Notes

- Keep GitHub Action as backup during migration
- Ensure backward compatibility with existing rules
- Monitor webhook delivery failures
- Plan for webhook retry logic
- Consider rate limiting for webhook endpoints