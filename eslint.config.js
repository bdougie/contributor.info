// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist',
      '.netlify/',
      'node_modules/',
      'storybook-static/',
      'coverage/',
      '**/*.generated.*',
      'public/',
      'lighthouse-reports/',
      '.storybook/',
      'supabase/functions/',
      'tests/',
      'app/',
      '.eslintcache',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'prettier/prettier': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Prevent nested ternaries that break Rollup tree shaking
      // See: https://github.com/rollup/rollup/issues/5747
      'no-nested-ternary': 'error',
      // Allow single ternaries but encourage helper functions for complex conditions
      'multiline-ternary': ['warn', 'always-multiline'],
      // Prevent usage of 'any' type - enforce proper TypeScript typing
      '@typescript-eslint/no-explicit-any': 'error',
      // Prevent usage of .single() from Supabase to avoid 406 errors
      // Use .maybeSingle() instead which returns null instead of throwing
      // See: /docs/postmortems/406-error-resolution.md
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="single"]',
          message:
            'Use .maybeSingle() instead of .single() to prevent 406 errors. .single() throws when no rows are found, while .maybeSingle() returns null safely.',
        },
      ],
    },
  },
  // Bulletproof testing rules - prevent async/await in unit test files
  // Excludes integration tests, API tests, and E2E tests which may legitimately need async
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    ignores: [
      'netlify/functions/**/*.test.{ts,tsx}', // API function tests
      'actions/**/*.test.{ts,tsx}', // GitHub action tests  
      'e2e/**/*.test.{ts,tsx}', // E2E tests
      'src/services/**/*.test.{ts,tsx}', // Service integration tests
      '**/integration/**/*.test.{ts,tsx}', // Explicit integration tests
      '**/*integration*.test.{ts,tsx}', // Integration test files
      '**/*e2e*.test.{ts,tsx}', // E2E test files
      '**/*api*.test.{ts,tsx}', // API test files
    ],
    rules: {
      // Prevent async/await in test functions to avoid CI hangs
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration[async=true]',
          message:
            'Async functions are forbidden in unit tests. Use synchronous patterns only. See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md',
        },
        {
          selector: 'ArrowFunctionExpression[async=true]',
          message:
            'Async arrow functions are forbidden in unit tests. Use synchronous patterns only. See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md',
        },
        {
          selector: 'AwaitExpression',
          message:
            'await expressions are forbidden in unit tests. Use synchronous mocks instead. See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md',
        },
        {
          selector: 'CallExpression[callee.name="waitFor"]',
          message:
            'waitFor() is forbidden in unit tests as it can hang indefinitely. Use synchronous assertions only. See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md',
        },
        {
          selector: 'CallExpression[callee.name="waitForElementToBeRemoved"]',
          message:
            'waitForElementToBeRemoved() is forbidden in unit tests as it can hang indefinitely. Use synchronous assertions only. See docs/testing/BULLETPROOF_TESTING_GUIDELINES.md',
        },
      ],
    },
  },
  eslintConfigPrettier,
  storybook.configs['flat/recommended']
);
