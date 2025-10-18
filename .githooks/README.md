# Git Hooks

This directory contains custom git hooks for the project.

## Available Hooks

### pre-push
Located in `.githooks/pre-push`

**Purpose:** Runs checks before pushing to remote repository

**What it does:**
- Ensures all commits pass basic checks
- Runs tests (optional)
- Validates branch naming conventions (if configured)

**Installation:**
```bash
# Copy to .git/hooks/
cp .githooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Pre-Commit Hooks (Husky)

The main pre-commit hooks are managed by Husky in the `.husky/` directory.

See [Pre-Commit Hooks Guide](../docs/development/pre-commit-hooks.md) for details.

## Policy on --no-verify

⚠️ **NEVER use `git commit --no-verify` or `git push --no-verify`**

These flags bypass important quality checks including:
- TypeScript type checking
- ESLint validation
- Code formatting
- Security checks

Using `--no-verify` can lead to:
- Broken builds
- Type errors in production
- Security vulnerabilities
- Code style inconsistencies

## What to do instead

If pre-commit hooks fail:

1. **Read the error message** - It tells you what's wrong
2. **Fix the issue** - Run the failing command locally to see details
3. **Commit again** - Once fixed, commit normally

```bash
# ❌ Don't do this
git commit --no-verify -m "quick fix"

# ✅ Do this instead
npm run lint:fix
npx tsc -b --noEmit
git commit -m "fix: resolve type errors"
```

## Common Commands

```bash
# Check TypeScript
npx tsc -b --noEmit

# Check and fix ESLint issues
npm run lint:fix

# Format code
npm run format

# Run all checks manually
npm run lint && npx tsc -b --noEmit
```

## Troubleshooting

### Hooks not running?

```bash
# Reinstall Husky hooks
npm run hooks:install

# Verify hooks path
git config core.hooksPath
# Should output: .husky
```

### Need to bypass hooks in emergency?

Only in absolute emergencies (e.g., critical production hotfix):

```bash
# Emergency only - document why in commit message
git commit --no-verify -m "emergency: critical security patch

Bypassing hooks due to production outage. Will fix type errors in follow-up commit.
Ticket: #1234"

# Immediately create follow-up commit
git commit -m "fix: address type errors from emergency commit"
```

## Installation

Hooks are automatically installed when you run:

```bash
npm install
```

To manually install:

```bash
npm run hooks:install
```

## More Information

See [Pre-Commit Hooks Guide](../docs/development/pre-commit-hooks.md) for comprehensive documentation.
