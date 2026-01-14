# Continue Agents Setup

This guide covers how to set up Continue Agents in your GitHub repository using the official reusable workflow.

## Recommended: Use the Reusable Workflow

The Continue team provides a reusable workflow that handles agent discovery and execution. **This is the recommended approach** as it stays up-to-date with the latest features and bug fixes.

### Basic Setup

Create `.github/workflows/continue-agents.yml`:

```yaml
name: Continue Agents

on:
  pull_request:
    types: [opened, reopened, synchronize]
    branches:
      - main

permissions:
  contents: write
  checks: write
  pull-requests: write

jobs:
  run-agents:
    uses: continuedev/continue/.github/workflows/continue-agents.yml@main
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Requirements

1. **ANTHROPIC_API_KEY secret**: Add your Anthropic API key to repository secrets
2. **Agent definitions**: Create `.continue/agents/*.md` files defining your agents
3. **Permissions**: The workflow needs `contents: write`, `checks: write`, and `pull-requests: write`

## GH_TOKEN Support

As of [PR #9497](https://github.com/continuedev/continue/pull/9497), the reusable workflow includes `GH_TOKEN` in the agent environment. This enables agents to use the `gh` CLI for GitHub operations like:

- Fetching PR details
- Posting comments
- Managing labels
- Accessing repository information

### Example Agent Using gh CLI

```markdown
# .continue/agents/conventional-title.md

Check if the PR title follows conventional commit format.

## Instructions

1. Get the PR title using: `gh pr view $PR_NUMBER --json title`
2. Validate it matches: `^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?!?: .+`
3. If invalid, suggest corrections
```

## Migrating from Local Workflow

If you previously used a local copy of the workflow (to work around the missing `GH_TOKEN`), you can now switch to the reusable workflow:

1. Delete your local `.github/workflows/continue-agents.yml` (if it's a copy)
2. Create a new workflow that calls the reusable version (see Basic Setup above)
3. Verify your agents work with a test PR

### Why Migrate?

- **Automatic updates**: Get bug fixes and new features without manual updates
- **Reduced maintenance**: No need to sync changes from upstream
- **Consistent behavior**: Same workflow used across the Continue community

## Troubleshooting

### Agent can't access GitHub API

Ensure your workflow has the correct permissions:

```yaml
permissions:
  contents: write
  checks: write
  pull-requests: write
```

### Missing ANTHROPIC_API_KEY

The workflow requires `ANTHROPIC_API_KEY` as a secret. Add it in:
Settings → Secrets and variables → Actions → New repository secret

### Agents not discovered

Agents must be in `.continue/agents/` directory with `.md` extension. Check:

```bash
ls -la .continue/agents/
```

## Related Resources

- [Continue Agents Documentation](https://docs.continue.dev/agents)
- [Reusable Workflow Source](https://github.com/continuedev/continue/blob/main/.github/workflows/continue-agents.yml)
- [GH_TOKEN PR](https://github.com/continuedev/continue/pull/9497)
