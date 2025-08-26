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
    // React hooks dependencies - warn instead of error for flexibility
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Warn about nested ternaries - they can impact readability and tree shaking
    // See: https://github.com/rollup/rollup/issues/5747
    'no-nested-ternary': 'warn',
    // Allow single ternaries but encourage helper functions for complex conditions
    'multiline-ternary': ['warn', 'always-multiline'],
    // Warn about 'any' type usage - encourage proper TypeScript typing
    // Changed to warning to not block development while we incrementally improve types
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // Variables assigned but not used - warning for legitimate patterns
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^_',           // Ignore variables prefixed with _
        argsIgnorePattern: '^_',           // Ignore arguments prefixed with _
        destructuredArrayIgnorePattern: '^_', // Ignore destructured arrays with _
        ignoreRestSiblings: true,          // Allow rest properties for omitting
        caughtErrors: 'none'               // Don't check catch clause errors
      }
    ],
    
    // Additional rules configured as warnings to not block development
    'no-empty': 'warn',                    // Empty block statements
    'no-control-regex': 'warn',            // Control characters in regex
    'no-useless-escape': 'warn',           // Unnecessary escape characters
    'no-constant-condition': 'warn',       // Constant conditions in control flow
    'no-case-declarations': 'warn',        // Lexical declarations in case blocks
    '@typescript-eslint/no-unused-expressions': 'warn', // Unused expressions
    '@typescript-eslint/no-require-imports': 'warn',    // Require imports
    'react-hooks/rules-of-hooks': 'warn',  // React hooks rules
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
