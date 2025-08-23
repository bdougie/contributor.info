# End-to-End Tests

This directory contains Playwright e2e tests for the contributor.info application.

## Setup

1. Install Playwright browsers (if not already installed):
   ```bash
   npm run install-browsers
   ```

## Running Tests

### Run all e2e tests (headless):
```bash
npm run test:e2e
```

### Run tests with UI (interactive):
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser):
```bash
npm run test:e2e:headed
```

### Run specific test file:
```bash
npx playwright test homepage.spec.ts
```

## Test Files

### `homepage.spec.ts`
Tests for homepage functionality including:

1. **Search Form Test**: 
   - Verifies user can search for `pgvector/pgvector` 
   - Confirms correct routing to `/pgvector/pgvector`

2. **Example Link Test**:
   - Verifies user can click `continuedev/continue` example button
   - Confirms correct routing to `/continuedev/continue`

3. **Homepage Elements Test**:
   - Verifies all expected elements are present on homepage
   - Tests presence of search input, buttons, and example repository links

## Test Structure

Each test follows this pattern:
1. Navigate to the page
2. Verify page loads correctly
3. Interact with elements (type, click)
4. Verify expected outcomes (routing, content)

## Configuration

The tests are configured via `playwright.config.ts` in the project root:
- Base URL: `http://localhost:5173`
- Automatically starts dev server before tests
- Runs on Chromium only (for performance)
- Includes trace collection on retry
- Screenshots and video on failure

## Debugging

To debug tests:
1. Use `npm run test:e2e:headed` to see browser actions
2. Use `npm run test:e2e:ui` for interactive debugging
3. Add `await page.pause()` in test code to pause execution
4. Use `--debug` flag: `npx playwright test --debug`