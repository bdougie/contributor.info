// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config({ 
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
    'app/'
  ] 
}, {
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
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
        message: 'Use .maybeSingle() instead of .single() to prevent 406 errors. .single() throws when no rows are found, while .maybeSingle() returns null safely.'
      }
    ],
  },
}, storybook.configs["flat/recommended"]);
