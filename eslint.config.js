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
  },
}, storybook.configs["flat/recommended"]);
