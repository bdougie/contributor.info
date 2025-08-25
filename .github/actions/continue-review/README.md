# Continue Agent Review Action

An automated code review action that uses Continue AI to provide intelligent feedback on pull requests, with support for custom project-specific rules.

## Overview

This GitHub Action integrates Continue AI's code review capabilities directly into your pull request workflow. It automatically reviews code changes, applies project-specific rules from `.continue/rules`, and posts detailed feedback as PR comments.

## Features

- 🤖 **Automated AI Code Reviews** - Comprehensive code analysis on every PR
- 📝 **Custom Rules Support** - Reads and applies project-specific rules from `.continue/rules`
- 💬 **Interactive Commands** - Trigger reviews with `@continue-agent` comments
- 🎯 **Context-Aware** - Applies only relevant rules based on changed files
- 📊 **Smart Formatting** - Clean, markdown-formatted review comments

## Setup

### Prerequisites

1. **Continue API Key** - Obtain from [Continue](https://continue.dev)
2. **GitHub Token** - Repository token with PR comment permissions
3. **Continue Organization** - Your Continue org name (default: `continuedev`)
4. **Continue Config** - Your config path (default: `continuedev/review-bot`)

### GitHub Secrets Required

Add these secrets to your repository:

- `CONTINUE_API_KEY` - Your Continue API key
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Basic Workflow Configuration

```yaml
name: Continue Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    # Only run on PR comments with @continue-agent
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       contains(github.event.comment.body, '@continue-agent') && 
       github.event.issue.pull_request)
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Continue Review
        uses: ./.github/actions/continue-review
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'continuedev'  # Optional, defaults to 'continuedev'
          continue-config: 'continuedev/review-bot'  # Optional
```

## How It Works

### 1. Review Trigger

The action triggers in three scenarios:
- **New PR opened** - Automatic review of initial changes
- **PR updated** - Review of new commits
- **Comment command** - Manual trigger via `@continue-agent` comment

### 2. Rules Processing

The action automatically discovers and applies rules from `.continue/rules/`:

```
.continue/
└── rules/
    ├── typescript-no-any.md      # Applies to *.ts, *.tsx files
    ├── console-log-security.md   # Security rules for logging
    ├── react-component-naming.md # React component conventions
    └── ...
```

#### Rule Structure

Each rule is a markdown file with YAML frontmatter:

```markdown
---
globs: "**/*.{ts,tsx}"  # File patterns this rule applies to
description: "Never use 'any' type in TypeScript"
alwaysApply: true  # Optional, defaults to true
---

# Rule Title

Rule content and examples...
```

#### Rule Matching

Rules are applied based on:
- **Glob patterns** - Matches against changed files (e.g., `**/*.tsx` for React files)
- **Always apply** - Rules with `alwaysApply: true` apply to all reviews
- **Skip conditions** - Rules with `alwaysApply: false` are skipped

### 3. Review Process

1. **Load rules** - Reads all `.continue/rules/*.md` files
2. **Match patterns** - Filters rules based on changed files
3. **Build prompt** - Creates review prompt with:
   - PR metadata (title, description, files)
   - Applicable project rules
   - Code diff (truncated if >12KB)
4. **Call Continue** - Sends to Continue AI for analysis
5. **Post comment** - Formats and posts review as PR comment

### 4. Interactive Commands

Users can request specific reviews using PR comments:

```
@continue-agent check for security issues
@continue-agent review the TypeScript types
@continue-agent suggest performance improvements
```

The action will respond with targeted feedback based on the request.

## Input Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `github-token` | ✅ | - | GitHub token for API access |
| `continue-api-key` | ✅ | - | Continue API key |
| `continue-org` | ❌ | `continuedev` | Continue organization name |
| `continue-config` | ❌ | `continuedev/review-bot` | Continue configuration path |

## Comment Format

Reviews are posted as formatted markdown comments:

```markdown
## 🤖 Continue Agent Review

[Review content with specific feedback, suggestions, and code examples]

---
*Powered by [Continue](https://continue.dev)*
```

When responding to commands:

```markdown
## 🤖 Continue Agent Review

**Responding to:** `@continue-agent check for security issues`

---

[Targeted review based on the request]

---
*Powered by [Continue](https://continue.dev)*
```

## Creating Custom Rules

### Example: Adding a New Rule

1. Create a new file in `.continue/rules/`:

```bash
touch .continue/rules/api-error-handling.md
```

2. Add frontmatter and content:

```markdown
---
globs: "**/api/**/*.{ts,js}"
description: "Ensure proper error handling in API routes"
---

# API Error Handling

All API routes must include proper error handling with:
- Try-catch blocks for async operations
- Meaningful error messages
- Appropriate HTTP status codes
- Error logging for debugging
```

3. The rule will automatically apply to API file changes in future reviews

### Rule Best Practices

- **Specific globs** - Target specific file types/directories
- **Clear descriptions** - Explain what the rule enforces
- **Provide examples** - Show good vs bad patterns
- **Actionable feedback** - Include how to fix issues

## Troubleshooting

### No Review Posted

Check:
1. Continue API key is valid
2. GitHub token has PR comment permissions
3. Workflow conditions are met
4. Action logs for specific errors

### Rules Not Applied

Verify:
1. Rules exist in `.continue/rules/`
2. Frontmatter is valid YAML
3. Glob patterns match changed files
4. Rules aren't marked `alwaysApply: false`

### Empty Reviews

Ensure:
1. PR has actual code changes
2. Continue service is operational
3. Diff isn't too large (>12KB is truncated)

## Security Considerations

- **API Keys** - Never commit API keys; use GitHub Secrets
- **Token Permissions** - Use minimal required permissions
- **Review Content** - Reviews are public PR comments
- **Rate Limits** - Consider Continue API rate limits

## Examples

### Full Workflow with Manual Trigger

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to review'
        required: true

jobs:
  continue-review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' || 
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'issue_comment' && 
       contains(github.event.comment.body, '@continue-agent'))
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better context
      
      - name: AI Review
        uses: ./.github/actions/continue-review
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
```

### Review Only TypeScript Files

Add a rule that always applies to TypeScript:

```markdown
---
globs: "**/*.{ts,tsx}"
description: "TypeScript code quality standards"
alwaysApply: false  # Only when TS files change
---

# TypeScript Standards
- Use strict type checking
- No implicit any
- Prefer interfaces over types for objects
```

## Support

- **Continue Documentation**: https://continue.dev/docs
- **Issue Tracking**: Open issues in your repository
- **API Status**: Check Continue service status

## License

This action is part of the contributor.info project and follows the same license.