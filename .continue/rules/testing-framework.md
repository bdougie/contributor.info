---
globs: "**/*.{test,spec}.{ts,tsx,js,jsx}"
description: Use Vitest for all tests, never Jest (except Storybook)
---

# Testing Framework Requirements

This project uses **Vitest** as the primary testing framework. Never use Jest for application tests.

## Rules

1. **Always use Vitest** for application tests
2. **Never import from Jest** in test files
3. **Jest is only used internally by Storybook** - don't configure or use it elsewhere

## Examples

❌ **Wrong - Never use Jest imports:**
```javascript
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

jest.mock('./some-module');
```

✅ **Correct - Always use Vitest:**
```javascript
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('./some-module');
```

## Test File Patterns

- Test files should use `.test.ts` or `.test.tsx` extensions
- Place tests next to the code they test or in `__tests__` directories
- Use descriptive test names that explain what is being tested

## Storybook Exception

Storybook internally uses Jest for its test runner. This is the only acceptable Jest usage in the project. Do not modify Storybook's Jest configuration unless absolutely necessary.