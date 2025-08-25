---
globs: "**/*.{ts,tsx,js,jsx}"
description: Ensure code changes pass build verification
---

# Build Verification

All code changes must pass the build verification process. After making changes, ensure:

1. **TypeScript compilation succeeds** - No type errors
2. **Production build completes** - `npm run build` must succeed
3. **Lint checks pass** - Code follows project style guidelines

## Required Checks

Before marking any PR as ready:
- Run `npm run build` to verify TypeScript types and production build
- Fix any compilation errors or warnings
- Ensure no new TypeScript errors are introduced

## Note
The build command will automatically check TypeScript types and create the production bundle. Any failures indicate issues that must be resolved before merging.