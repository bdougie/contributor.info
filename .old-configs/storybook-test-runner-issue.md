# Storybook Test Runner Configuration Issue

## Problem
The `@storybook/test-runner` v0.23.0 is not properly detecting and running tests from Storybook stories when used with Storybook v8.6.14.

## Symptoms
- Running `npx test-storybook` results in "No tests found" error
- Jest is looking in `.storybook` directory instead of transforming stories into tests
- The test runner shows: `testMatch: **/__tests__/**/*.[jt]s?(x), **/?(*.)+(spec|test).[tj]s?(x) - 0 matches`

## Current Workaround
The CI/CD workflow has been configured to pass with no tests using the `--passWithNoTests` flag to prevent build failures while we investigate the proper configuration.

## Root Cause
The test-runner appears to be running Jest in the wrong directory (`.storybook` instead of project root) and is not properly transforming Storybook stories into executable tests.

## Files Involved
- `.github/workflows/storybook-tests.yml` - CI/CD workflow
- `test-runner-jest.config.js` - Jest configuration for test-runner
- `.storybook/test-runner-jest.config.js` - Additional Jest config
- `.storybook/test-runner.ts` - Test runner configuration

## Next Steps
1. Investigate if we need to upgrade/downgrade test-runner version
2. Check if we need additional configuration for Storybook 8
3. Consider alternative testing approaches (Playwright, Cypress)
4. File issue with @storybook/test-runner if configuration issue persists

## Temporary Solution
For now, interaction tests are written as play functions in the stories themselves, which:
- Provide documentation of component behavior
- Can be manually tested in Storybook UI
- Will be ready when test-runner configuration is fixed

## References
- [Storybook Test Runner Documentation](https://storybook.js.org/docs/react/writing-tests/test-runner)
- [Issue #493 - Design System Implementation](https://github.com/bdougie/contributor.info/issues/493)