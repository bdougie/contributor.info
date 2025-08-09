# Git Hooks

This directory contains Git hooks to ensure code quality before pushing to the repository.

## Available Hooks

### pre-push
Runs the build process before allowing a push to ensure:
- TypeScript compilation succeeds
- No type errors exist
- Build process completes without errors

## Installation

To use these hooks locally, run one of the following commands:

### Option 1: Configure Git to use the hooks directory
```bash
git config core.hooksPath .githooks
```

### Option 2: Copy hooks to your local .git/hooks directory
```bash
cp .githooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

### Option 3: Create a symlink (recommended for updates)
```bash
ln -sf ../../.githooks/pre-push .git/hooks/pre-push
```

## Bypassing Hooks (Use with caution!)

If you need to push without running the hooks (not recommended):
```bash
git push --no-verify
```

## Customization

You can modify the hooks to also run tests by uncommenting the test section in the pre-push hook.

## Troubleshooting

If the hook isn't executing:
1. Check that the hook file is executable: `ls -la .git/hooks/pre-push`
2. Ensure Node.js and npm are available in your PATH
3. Run `chmod +x .git/hooks/pre-push` if needed