# Continue Agent Review Action (TypeScript)

A GitHub Action that performs AI-powered code reviews using Continue Agent on pull requests.

## Features

- 🤖 **Automated AI Code Reviews** - Comprehensive code analysis on every PR
- 📝 **Custom Rules Support** - Reads and applies project-specific rules from `.continue/rules`
- 💬 **Interactive Commands** - Trigger reviews with `@continue-agent` comments
- 🎯 **Context-Aware** - Applies only relevant rules based on changed files
- 📊 **Sticky Comments** - Single comment that updates with progress and results
- ✅ **TypeScript Implementation** - Type-safe and linted code

## Setup

### Prerequisites

1. **Continue Hub Account** - Sign up at [hub.continue.dev](https://hub.continue.dev)
2. **Continue Assistant** - Create an assistant following the Continue documentation
3. **Continue API Key** - Get from your Hub account settings

### GitHub Secrets Required

- `CONTINUE_API_KEY` - Your Continue API key
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Workflow Configuration

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
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       contains(github.event.comment.body, '@continue-agent'))
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Continue Review
        uses: ./actions/continue-review
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-config: 'your-username/assistant-name'
```

## How It Works

1. **Triggers on**:
   - New PRs opened
   - PR updates (new commits)
   - Comments with `@continue-agent`

2. **Loads project rules** from `.continue/rules/*.md`

3. **Generates review** using Continue CLI

4. **Posts sticky comment** that updates with progress

## Creating Rules

Create markdown files in `.continue/rules/` with YAML frontmatter:

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

## Interactive Commands

Trigger specific reviews with PR comments:

```
@continue-agent check for security issues
@continue-agent review the TypeScript types
@continue-agent suggest performance improvements
```

## Implementation Details

This action is implemented in TypeScript for:
- Type safety and better error handling
- Integration with the main project's linting and build tools
- Easier maintenance and testing

The action uses:
- `@actions/core` and `@actions/github` for GitHub Actions integration
- Continue CLI via child process execution
- Sticky comments with HTML markers for clean PR threads

## License

Part of the contributor.info project.