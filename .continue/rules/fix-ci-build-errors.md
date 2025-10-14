# Fix CI Build Errors

## Purpose
Automatically diagnose and fix common CI/CD build failures that occur during pull requests, including TypeScript errors, linting issues, formatting problems, and test failures.

## Common Error Patterns & Solutions

### 1. TypeScript Type Errors

#### Missing Type Definitions
**Error Pattern**: `Cannot find name 'X'` or `Property 'X' does not exist on type 'Y'`

**Fix**:
```typescript
// Add proper type imports
import { type SomeType } from './types'

// Or define inline types
interface MyComponentProps {
  propertyName: string
}

// For third-party libraries without types
declare module 'library-name' {
  export function methodName(param: any): any
}
```

#### Type 'any' Usage
**Error Pattern**: `Unexpected any. Specify a different type`

**Fix**:
```typescript
// ❌ Bad
const data: any = response

// ✅ Good - Use specific types
const data: UserData = response as UserData

// ✅ Good - Use unknown for truly unknown types
const data: unknown = response
if (isUserData(data)) {
  // Type guard
}
```

#### Async/Await Type Issues
**Error Pattern**: `Type 'Promise<X>' is not assignable to type 'X'`

**Fix**:
```typescript
// ❌ Bad - Missing await
const data = fetchData() // Returns Promise

// ✅ Good
const data = await fetchData()
```

### 2. ESLint Errors

#### Unused Variables
**Error Pattern**: `'X' is defined but never used`

**Fix**:
```typescript
// Remove unused imports
- import { UnusedComponent } from './components'

// Or prefix with underscore if intentionally unused
const _unusedButRequired = someFunction()
```

#### Missing Dependencies in Hooks
**Error Pattern**: `React Hook useEffect has missing dependencies`

**Fix**:
```typescript
// ❌ Bad
useEffect(() => {
  doSomething(value)
}, [])

// ✅ Good
useEffect(() => {
  doSomething(value)
}, [value])

// Or use disable comment if intentional
useEffect(() => {
  doSomething(value)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

#### Console Statements
**Error Pattern**: `Unexpected console statement`

**Fix**:
```typescript
// Remove console statements
- console.log('debug info')

// Or use proper logging
import { logger } from '@/lib/logger'
logger.debug('debug info')
```

### 3. Prettier Formatting

**Error Pattern**: `Code style issues`

**Fix**:
```bash
# Auto-fix all formatting
npm run format

# Or fix specific files
npx prettier --write "src/**/*.{ts,tsx}"
```

Common formatting issues:
- Use single quotes (not double)
- Add semicolons at line ends
- 2 spaces for indentation
- Max line width: 100 characters
- Trailing commas in multi-line objects/arrays

### 4. Import/Export Issues

#### Circular Dependencies
**Error Pattern**: `Circular dependency detected`

**Fix**:
```typescript
// Move shared types to separate file
// types/shared.ts
export interface SharedType {}

// Then import from shared location
import { SharedType } from '@/types/shared'
```

#### Module Resolution
**Error Pattern**: `Cannot find module '@/...'`

**Fix**:
```typescript
// Ensure path aliases are correct
// Use @ for src directory
import { Component } from '@/components/Component'

// Not relative paths for cross-module imports
- import { Component } from '../../../components/Component'
```

### 5. Supabase Specific Issues

#### Single vs MaybeSingle
**Error Pattern**: `Row not found` errors

**Fix**:
```typescript
// ❌ Bad - throws on no results
const { data } = await supabase
  .from('table')
  .select()
  .single()

// ✅ Good - returns null on no results
const { data } = await supabase
  .from('table')
  .select()
  .maybeSingle()
```

### 6. Build Configuration Issues

#### Environment Variables
**Error Pattern**: `Environment variable X is not defined`

**Fix**:
```typescript
// Provide defaults for CI
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key'
```

#### Vite/Build Issues
**Error Pattern**: `Failed to resolve import`

**Fix**:
```typescript
// Use proper extensions
import Component from './Component.tsx' // Add extension

// Or configure in vite.config.ts
resolve: {
  extensions: ['.tsx', '.ts', '.jsx', '.js']
}
```

### 7. Test Failures

#### Mock Issues
**Error Pattern**: `Cannot read property of undefined` in tests

**Fix**:
```typescript
// Ensure mocks are properly set up
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    }))
  }
}))
```

#### Async Test Issues
**Error Pattern**: `Test timeout exceeded`

**Fix**:
```typescript
// ❌ Bad - missing await
it('should fetch data', () => {
  const result = fetchData()
  expect(result).toBeDefined()
})

// ✅ Good
it('should fetch data', async () => {
  const result = await fetchData()
  expect(result).toBeDefined()
})
```

## Pre-commit Hook Fixes

If pre-commit hooks are failing, run these commands locally:

```bash
# Fix all TypeScript errors
npx tsc --noEmit

# Fix linting issues
npm run lint:fix

# Fix formatting
npm run format

# Run type check for edge functions (if you have Deno)
cd supabase/functions && deno check **/*.ts && cd ../..
```

## CI-Specific Environment Setup

For GitHub Actions failures, ensure these are set:

```yaml
env:
  VITE_SUPABASE_URL: http://localhost:54321
  VITE_SUPABASE_ANON_KEY: mock-anon-key
  VITE_GITHUB_TOKEN: mock-github-token
  NODE_ENV: test
  CI: true
```

## Quick Diagnosis Commands

Run these locally to replicate CI checks:

```bash
# Full CI simulation
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build

# Quick fix most issues
npm run lint:fix && npm run format && npm run build
```

## Emergency Fixes

If you need to bypass a specific check temporarily:

```typescript
// Disable TypeScript check for a line
// @ts-ignore

// Disable ESLint for next line
// eslint-disable-next-line rule-name

// Disable for entire file
/* eslint-disable rule-name */
```

**Note**: Always prefer fixing the actual issue over disabling checks. Use bypasses only as last resort and create follow-up issues to address them properly.

## Build Error Checklist

When a build fails:

1. [ ] Check GitHub Actions logs for specific error
2. [ ] Run `npm run lint:fix` locally
3. [ ] Run `npm run format` locally
4. [ ] Run `npx tsc --noEmit` to check types
5. [ ] Ensure all imports use `@/` alias correctly
6. [ ] Check for `console.log` statements
7. [ ] Verify `.maybeSingle()` is used instead of `.single()`
8. [ ] Ensure environment variables have defaults
9. [ ] Run `npm test` to verify tests pass
10. [ ] Commit fixes with conventional commit message

## Related Documentation

- [TypeScript Configuration](../../tsconfig.json)
- [ESLint Configuration](../../eslint.config.js)
- [Prettier Configuration](../../.prettierrc.json)
- [Pre-commit Hooks](../../.husky/pre-commit)
- [CI Workflows](../../.github/workflows/)