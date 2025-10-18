# Pre-Commit Hooks Guide

## Overview

This project uses pre-commit hooks to ensure code quality and prevent common issues before they reach the repository. **Never use `--no-verify` to bypass these checks.**

## What Runs on Pre-Commit

### 1. TypeScript Type Checking
- Runs on all `.ts` and `.tsx` files
- Uses `tsc -b --noEmit` for full project type checking
- Catches type errors before they reach CI/CD

### 2. Deno Type Checking
- Runs on Supabase Edge Functions (`supabase/functions/**/*.ts`)
- Only runs if Deno is installed
- Validates edge function types

### 3. ESLint
- Runs on all JavaScript/TypeScript files
- Automatically fixes issues with `--fix`
- Fails if there are unfixable errors or warnings

### 4. Prettier
- Formats all code files
- Ensures consistent code style
- Runs on JS, TS, JSON, YAML, CSS files

### 5. CSP Hash Verification
- Runs when `index.html` or `public/_headers` changes
- Validates Content Security Policy hashes
- Ensures inline scripts match CSP headers

## Why We Don't Use `--no-verify`

Using `--no-verify` bypasses all pre-commit checks, which can lead to:

❌ **Type errors in production**
- Breaks the build in CI/CD
- Causes runtime errors
- Wastes time debugging issues that could have been caught

❌ **Code style inconsistencies**
- Makes code reviews harder
- Creates merge conflicts
- Violates team conventions

❌ **Security vulnerabilities**
- CSP violations can expose XSS vulnerabilities
- Bypassed linting can miss security issues

❌ **Broken builds**
- Fails CI/CD pipeline
- Blocks other developers
- Delays deployments

## Installation

Pre-commit hooks are installed automatically when you run:

```bash
npm install
```

This installs Husky hooks in `.husky/` directory.

### Manual Installation

If hooks aren't installed, run:

```bash
npm run hooks:install
```

## Common Issues and Solutions

### Issue: "TypeScript type check failed"

**Solution:**
```bash
# Run type check to see errors
npx tsc -b --noEmit

# Fix the errors in your code
# Then commit again
git commit -m "fix: resolve type errors"
```

### Issue: "ESLint errors"

**Solution:**
```bash
# Run ESLint to see errors
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Manually fix remaining issues
# Then commit again
```

### Issue: "Prettier formatting"

**Solution:**
```bash
# Format all files
npm run format

# Then commit again
git commit -m "style: format code"
```

### Issue: "CSP hash verification failed"

**Solution:**
```bash
# Verify CSP hash
npm run verify:csp

# If it fails, update the hash
npm run update:csp

# Then commit again
```

### Issue: Pre-commit is slow

**Optimization tips:**
1. Stage only the files you're working on
2. TypeScript checking runs on entire project (necessary for type safety)
3. Consider committing smaller, focused changes
4. Use `git add -p` for partial staging

## Bypassing Hooks (Emergency Only)

⚠️ **WARNING:** Only use this in absolute emergencies (e.g., critical hotfix with broken CI)

```bash
# Only if absolutely necessary
git commit --no-verify -m "emergency: critical hotfix"

# Then immediately create a follow-up commit to fix issues
git commit -m "fix: address type errors from emergency commit"
```

**Better approach:**
1. Fix the issues locally
2. Commit without `--no-verify`
3. Push to a hotfix branch
4. Create PR for review

## Development Workflow

### Recommended Workflow

```bash
# 1. Make your changes
vim src/components/MyComponent.tsx

# 2. Run checks manually (optional but recommended)
npm run lint
npm run format
npx tsc -b --noEmit

# 3. Stage your changes
git add src/components/MyComponent.tsx

# 4. Commit (hooks run automatically)
git commit -m "feat: add new component"

# 5. If hooks fail, fix issues and try again
npm run lint:fix
git add .
git commit -m "feat: add new component"
```

### Working with Multiple Files

```bash
# Stage all changes
git add .

# Or stage specific patterns
git add src/**/*.tsx

# Commit (hooks run on all staged files)
git commit -m "refactor: update components"
```

## Configuration Files

### Husky Configuration
- `.husky/pre-commit` - Main pre-commit hook script
- `.husky/_/` - Husky runtime files

### Lint-Staged Configuration
- `.lintstagedrc.json` - Defines what runs on which files

### TypeScript Configuration
- `tsconfig.json` - Main TypeScript config
- `tsconfig.app.json` - App-specific config
- `tsconfig.node.json` - Node-specific config

### ESLint Configuration
- Package.json `eslintConfig` section
- Runs React, TypeScript, and custom rules

### Prettier Configuration
- `.prettierrc.json` - Code formatting rules
- `.prettierignore` - Files to skip

## CI/CD Integration

Pre-commit hooks mirror what runs in CI/CD:

| Check | Pre-Commit | CI/CD |
|-------|-----------|-------|
| TypeScript | ✅ | ✅ |
| ESLint | ✅ | ✅ |
| Prettier | ✅ | ✅ |
| Unit Tests | ❌ | ✅ |
| E2E Tests | ❌ | ✅ |
| Build | ❌ | ✅ |

This means:
- Pre-commit catches most issues early
- CI/CD runs additional checks (tests, build)
- Both must pass for code to be merged

## Troubleshooting

### Hooks not running

```bash
# Check if Husky is installed
ls -la .husky/

# Reinstall hooks
rm -rf .husky
npm run hooks:install

# Verify git hooks path
git config core.hooksPath
# Should output: .husky
```

### TypeScript is slow

TypeScript checks the entire project because:
1. Type changes can affect other files
2. Ensures no breaking changes
3. Catches cross-file type errors

To speed up:
- Keep project dependencies updated
- Use incremental compilation (already configured)
- Commit smaller changes more frequently

### ESLint is failing on auto-fixable issues

```bash
# Run lint with fix
npx eslint --fix src/

# Stage the fixes
git add .

# Try commit again
git commit -m "fix: resolve linting issues"
```

## Best Practices

### ✅ Do

- Run `npm run lint` before committing large changes
- Fix type errors as you code
- Use editor integration for ESLint and Prettier
- Commit small, focused changes
- Read error messages carefully
- Ask for help if stuck

### ❌ Don't

- Use `--no-verify` unless absolutely necessary
- Ignore type errors
- Commit without testing locally
- Stage unrelated changes together
- Skip reading pre-commit output
- Force push without checking hooks passed

## Editor Integration

### VS Code

Install these extensions:
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- TypeScript and JavaScript Language Features (built-in)

Configuration (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Other Editors

- **WebStorm/IntelliJ**: Built-in support for ESLint, Prettier, and TypeScript
- **Vim/Neovim**: Use ALE or CoC with ESLint and Prettier plugins
- **Sublime Text**: Use LSP-typescript and SublimeLinter-eslint

## Related Documentation

- [Development Hooks](./hooks.md)
- [TypeScript Guidelines](../typescript-no-any.md)
- [ESLint Rules](../../.eslintrc.json)
- [Prettier Configuration](../../.prettierrc.json)

## Support

If you encounter issues with pre-commit hooks:

1. Check this documentation
2. Run manual checks to identify the issue
3. Fix the reported errors
4. Ask team members for help
5. Create an issue if it's a hook configuration problem

**Remember:** Pre-commit hooks are your friend! They catch issues early and save time in the long run. 🚀
