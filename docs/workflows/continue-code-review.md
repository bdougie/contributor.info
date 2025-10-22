# Continue Code Review Workflow

## Overview

This project uses [Continue.dev](https://continue.dev) for automated AI-powered code reviews on pull requests. The review bot automatically analyzes changes and provides feedback based on project-specific standards.

## How It Works

### Automatic Reviews

The workflow runs automatically when:
- A pull request is opened
- New commits are pushed to an open PR
- A PR is marked as "ready for review"

### Manual Trigger

You can also trigger a focused review by commenting on a PR:
```
@review-bot check for [specific concern]
```

Example:
```
@review-bot check for security issues
```

## Review Standards

The bot reviews code against these custom rules defined in `.continue/rules/`:

### 1. TypeScript Standards
- No `any` types allowed
- No `unknown` as lazy fix
- Proper interfaces/types required
- Explicit function parameters and return types

### 2. Security
- No committed environment variables
- Safe logging practices (no template literal injection)
- Proper handling of sensitive data
- API keys and tokens secured

### 3. Code Quality
- Build must pass (`npm run build`)
- Use Vitest, not Jest (except in Storybook)
- Follow bulletproof testing guidelines
- No premature optimizations
- Scripts must be documented

### 4. Supabase Integration
- Use MCP server for migrations
- Edge functions manually deployed
- Proper RLS policies
- Environment variables not committed

### 5. User Experience
- Database-first approach
- Auto-detection of data issues
- Subtle, helpful notifications
- No manual intervention required
- Components match design language

## Setup Requirements

### Required Secrets

Add these secrets in your GitHub repository settings:

1. **CONTINUE_API_KEY** (Required)
   - Get your API key from [Continue.dev](https://continue.dev)
   - Settings → Secrets and variables → Actions → New repository secret

2. **APP_PRIVATE_KEY** (Optional, but recommended)
   - For better GitHub API rate limits
   - Create a GitHub App and generate a private key
   - Add as repository secret

### Optional Variables

For GitHub App integration (better rate limits):

1. **APP_ID** (Optional)
   - Your GitHub App ID
   - Settings → Variables → New repository variable

## Review Output

The bot posts a comment on your PR with:

1. **Summary of changes** - What was modified
2. **Key findings** - Issues, security concerns, suggestions
3. **Positive observations** - Good practices, improvements
4. **Actionable recommendations** - Specific steps to improve

## Updating Review Rules

To modify what the bot checks:

1. Edit files in `.continue/rules/`
2. Changes take effect on next PR
3. Consider adding new rule files for specific concerns

## Troubleshooting

### Bot doesn't comment
- Check CONTINUE_API_KEY is set correctly
- Verify workflow has proper permissions
- Check Actions tab for error logs

### Reviews are too generic
- Add more specific rules in `.continue/rules/`
- Use `@review-bot check for [specific]` for focused reviews

### Rate limit errors
- Set up GitHub App with APP_ID and APP_PRIVATE_KEY
- This provides better rate limits than default GITHUB_TOKEN

## Local Testing

To test the workflow locally before pushing:

```bash
# Install Continue CLI
npm i -g @continuedev/cli

# Get PR diff
gh pr diff <PR_NUMBER> > pr.diff

# Run review locally
cn --config continuedev/code-reviewer -p "Review this diff: $(cat pr.diff)"
```

## Related Documentation

- [Continue.dev Official Docs](https://docs.continue.dev)
- [GitHub PR Review Bot Guide](https://docs.continue.dev/guides/github-pr-review-bot)
- Project coding standards: `/CLAUDE.md`
- Testing guidelines: `/docs/testing/BULLETPROOF_TESTING_GUIDELINES.md`
- UX standards: `/docs/user-experience/`
