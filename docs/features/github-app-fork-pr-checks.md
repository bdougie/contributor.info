# GitHub App Fork PR Checks

## Overview

This document describes the implementation of secure GitHub Check Runs for fork PRs, addressing the security vulnerabilities identified in issue #585. The solution uses GitHub Apps to safely analyze fork PRs without exposing secrets.

## Problem Statement

Previously, PR #583 attempted to enable GitHub Actions checks for fork PRs using `pull_request_target`, but this approach had serious security vulnerabilities as it executes untrusted code in a privileged context with access to secrets.

## Solution Architecture

### Phase 1 Implementation (Completed)

We've extended the existing contributor.info GitHub App with two new check run capabilities:

1. **Similarity Analysis** - Finds similar issues using vector embeddings
2. **Performance Impact Analysis** - Analyzes PR changes for performance implications

### Key Components

#### 1. Environment Configuration

The implementation supports both naming conventions for GitHub App credentials:

- `CONTRIBUTOR_APP_ID` and `CONTRIBUTOR_APP_KEY` (preferred)
- `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` (legacy support)

#### 2. Fly Webhook Service Integration

Located in `fly-github-webhooks/src/handlers/pr-check-runs.js`, the handler:

- Processes PR events (opened, synchronize, ready_for_review)
- Creates GitHub Check Runs via the Checks API
- Runs similarity and performance checks in parallel
- Posts results directly to the PR

#### 3. Check Run Features

##### Similarity Analysis
- Generates embeddings using MiniLM model (384 dimensions)
- Queries Supabase vector database for similar issues
- Provides similarity percentages and links to related issues
- Adds annotations for high similarity matches (>80%)

##### Performance Impact Analysis
- Analyzes file changes for performance patterns
- Detects:
  - Large file additions
  - Timer usage without cleanup
  - Multiple map operations
  - JSON parsing operations
  - New dependencies
  - Image files
- Provides severity levels (high, medium, low)
- Offers specific recommendations

## Security Benefits

1. **Isolated Execution**: GitHub Apps run in isolated context
2. **No Secret Exposure**: Fork code never has access to repository secrets
3. **Short-lived Tokens**: Uses installation tokens that expire quickly
4. **Webhook Signature Verification**: All webhooks are verified using HMAC-SHA256
5. **Fine-grained Permissions**: App only requests necessary permissions

## Configuration

### GitHub App Settings

Update your GitHub App with these webhook events:
- `pull_request` (opened, synchronize, ready_for_review)
- `installation` (for app management)

Required permissions:
- **Checks**: write
- **Pull requests**: read
- **Contents**: read
- **Metadata**: read

### Environment Variables

```bash
# For Fly webhook service
CONTRIBUTOR_APP_ID=your-app-id
CONTRIBUTOR_APP_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret

# Supabase for similarity search
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Deployment

### Local Testing

1. Set up environment variables in `.env`
2. Run the Fly webhook service locally:
   ```bash
   cd fly-github-webhooks
   npm install
   npm run dev
   ```
3. Use ngrok to expose local webhook:
   ```bash
   ngrok http 8080
   ```
4. Update GitHub App webhook URL to ngrok URL

### Production Deployment

1. Deploy to Fly.io:
   ```bash
   cd fly-github-webhooks
   fly deploy -a contributor-info-webhooks
   ```

2. Set secrets:
   ```bash
   fly secrets set CONTRIBUTOR_APP_ID=xxx -a contributor-info-webhooks
   fly secrets set CONTRIBUTOR_APP_KEY="xxx" -a contributor-info-webhooks
   ```

3. Update GitHub App webhook URL:
   ```
   https://contributor-info-webhooks.fly.dev/webhook
   ```

## How It Works

1. **PR Event Received**: GitHub sends webhook when PR is opened/updated
2. **Webhook Verification**: Fly service verifies signature
3. **Check Runs Created**: Two check runs are created in "in_progress" state
4. **Parallel Analysis**:
   - Similarity check generates embeddings and queries database
   - Performance check analyzes file changes
5. **Results Posted**: Check runs are updated with conclusions and details
6. **Annotations Added**: Inline annotations for specific issues

## Check Run Output Examples

### Similarity Check - Similar Issues Found
```
🔍 Similar Issues Found

The following issues appear to be related to this PR:

🟢 Issue #123
- Title: Add dark mode support
- Similarity: 85%
- Status: open
- Link: View Issue

💡 Recommendations
- Review the similar issues to avoid duplicate work
- Reference related issues in your PR description
- Consider closing this PR if it duplicates an existing issue
```

### Performance Check - Issues Detected
```
⚡ Performance Impact Analysis

⚠️ Potential Performance Impacts

🟡 Large file addition
- File: src/components/Dashboard.tsx
- Severity: medium
- Description: Added 750 lines which may impact bundle size

📊 Metrics
- Files changed: 5
- Lines added: 850
- Lines removed: 100

💡 Recommendations
- Run bundle size analysis to measure impact
- Consider code splitting for large components
```

## Future Enhancements (Phase 2)

1. **Continue Integration**: Separate GitHub App for AI-powered code reviews
2. **Advanced Performance Metrics**: Integration with Lighthouse CI
3. **Cross-repo Similarity**: Find similar issues across organization
4. **Custom Rules Engine**: Allow repositories to define custom checks
5. **Caching Layer**: Improve performance for frequently checked PRs

## Troubleshooting

### Check Runs Not Appearing

1. Verify GitHub App permissions include "Checks: write"
2. Check webhook delivery in GitHub App settings
3. Review Fly logs: `fly logs -a contributor-info-webhooks`

### Similarity Check Always Empty

1. Ensure repository has issues in database
2. Verify embeddings are being generated
3. Check Supabase function exists: `find_similar_issues`

### Performance Check Too Strict

Adjust thresholds in `pr-check-runs.js`:
- Line addition thresholds (currently 500/1000)
- Pattern detection sensitivity

## Related Documentation

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps)
- [GitHub Checks API](https://docs.github.com/en/rest/checks)
- [Fly Webhook Service README](../../fly-github-webhooks/README.md)
- [Issue #585](https://github.com/bdougie/contributor.info/issues/585)

## Migration from GitHub Actions

This implementation replaces the insecure `pull_request_target` approach with a secure GitHub App-based solution. Key differences:

| Aspect | GitHub Actions | GitHub App |
|--------|---------------|------------|
| Security | Exposes secrets to fork code | Isolated execution |
| Permissions | Repository-wide | Fine-grained |
| Token Lifetime | Long-lived | Short-lived (1 hour) |
| Execution | In workflow context | External service |
| Fork Support | Security risks | Safe by design |