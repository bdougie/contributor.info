# Continue Agent Review Action

A GitHub Action that performs AI-powered code reviews using Continue Agent on pull requests.

## Features

- 🤖 **Automated AI Code Reviews** - Comprehensive code analysis on every PR
- 📝 **Custom Rules Support** - Reads and applies project-specific rules from `.continue/rules`
- 💬 **Interactive Commands** - Trigger reviews with `@continue-agent` comments
- 🎯 **Context-Aware** - Applies only relevant rules based on changed files
- 📊 **Sticky Comments** - Single comment that updates with progress and results
- ✅ **TypeScript Implementation** - Type-safe and linted code
- 🔐 **GitHub App Authentication** - Secure authentication via GitHub Apps

## Setup

### Prerequisites

1. **GitHub App** - Create a GitHub App with these permissions:
   - **Repository permissions:**
     - Contents: Read
     - Issues: Write  
     - Pull requests: Write
   - Generate a private key and note the App ID

2. **Continue Hub Account** - Sign up at [hub.continue.dev](https://hub.continue.dev)

3. **Continue Assistant** - Create an assistant following the Continue documentation

### GitHub Configuration

Store these as secrets in your repository or organization:

**Secrets:**
- `APP_ID` - Your GitHub App ID (from [codebunny](https://github.com/bdougie/codebunny))
- `APP_PRIVATE_KEY` - Your GitHub App private key
- `CONTINUE_API_KEY` - Your Continue API key

### Workflow Configuration

```yaml
name: Continue Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       contains(github.event.comment.body, '@continue-agent'))
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      # Generate GitHub App token for secure authentication
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
      
      # Run Continue Review with App token
      - name: Continue Review
        uses: bdougie/contributor.info/actions/continue-review@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'your-org'
          continue-config: 'your-org/assistant-name'
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

## Advanced Configuration

### Token Permission Scoping

You can limit the App token permissions:

```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    permissions: |
      contents: read
      pull-requests: write
      issues: write
```

### Multiple Repository Support

For organizations with many repositories:

```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    repositories: |
      repo1
      repo2
      repo3
```

## Troubleshooting

### App Not Installed
- Verify the App is installed on the repository
- Check App installation settings in GitHub

### Authentication Failures
- Verify the App ID is correct
- Check the private key secret is properly formatted
- Ensure the private key hasn't expired

### Token Permission Issues
- Review the App's permission configuration
- Check if permissions are limited in the workflow
- Verify repository settings allow App access

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