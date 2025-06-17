# Chromatic Configuration - Temporarily Disabled

## Status: DISABLED during active development

Chromatic visual regression testing has been temporarily disabled to reduce build overhead during the development phase.

## Why Disabled?

The Chromatic TurboSnap feature was causing build failures due to missing `preview-stats.json` file. This is a known issue when using Vite with Storybook where TurboSnap expects Webpack-style stats files.

### Error Details:
```
✖ Failed to prepare your built Storybook
Did not find preview-stats.json in your built Storybook. Make sure you pass --webpack-stats-json when building your Storybook.
```

## Current Configuration

- **Chromatic package**: `chromatic@^12.2.0` (installed)
- **Scripts disabled**: `npm run chromatic` and `npm run chromatic:ci` 
- **Enable scripts**: `npm run chromatic:enable` and `npm run chromatic:ci:enable`

## How to Re-enable

### Option 1: Quick Re-enable
```bash
npm run chromatic:enable
```

### Option 2: Fix TurboSnap for Vite (Recommended)

Since we're using Storybook 8.6.14 with Vite, TurboSnap should work automatically. If issues persist:

1. **Verify buildStoriesJson is enabled** in `.storybook/main.ts`:
   ```typescript
   features: {
     buildStoriesJson: true,
   }
   ```

2. **Check preview-stats.json generation**:
   ```bash
   npm run build-storybook
   ls storybook-static/preview-stats.json
   ```

3. **If file exists, re-enable Chromatic**:
   ```bash
   # Edit package.json to restore original commands:
   "chromatic": "chromatic --exit-zero-on-changes",
   "chromatic:ci": "chromatic --exit-zero-on-changes --only-changed",
   ```

### Option 3: Disable TurboSnap Temporarily
```bash
# Add --force-rebuild flag to skip TurboSnap
chromatic --exit-zero-on-changes --force-rebuild
```

## Environment Variables

Make sure these are set when re-enabling:
- `CHROMATIC_PROJECT_TOKEN`: Your Chromatic project token

## Related Issues
- [Storybook Issue #27172](https://github.com/storybookjs/storybook/issues/27172) - TurboSnap incompatible with builder-vite
- [Chromatic CLI Issue #868](https://github.com/chromaui/chromatic-cli/issues/868) - Missing preview-stats.json warning

## When to Re-enable

Re-enable Chromatic when:
1. Development phase is complete
2. Ready for visual regression testing
3. TurboSnap issues are resolved
4. CI/CD pipeline is stable