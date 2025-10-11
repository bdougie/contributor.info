# Postmortem: Type Checking Gaps in Edge Functions

**Date**: January 2025
**Impact**: CI failures from uncaught TypeScript errors in Supabase edge functions
**Severity**: Medium (caught in CI, not production)

## Summary

TypeScript errors in Supabase edge function tests were not caught during local development, leading to CI failures. The pre-commit hooks were only checking the main TypeScript codebase but not the Deno-based edge functions.

## Timeline

- **Initial Issue**: CI pipeline failing with 24 TypeScript errors in edge function tests
- **Root Cause Identified**: Pre-commit hooks missing Deno type checking
- **Resolution**: Updated pre-commit hooks + documentation

## What Happened

### The Errors

24 TypeScript errors across 4 test files:
- `logger.test.ts`: 11 errors - `unknown` type not properly asserted before `JSON.parse()`
- `metrics.test.ts`: 6 errors - `unknown` type in array access
- `spam-detection-service.test.ts`: 6 errors - `null` used instead of `undefined`
- `integration.test.ts`: 1 error - Type mismatch from test helper

### Why It Wasn't Caught Locally

The `.husky/pre-commit` hook was running:
- ✅ `tsc -b --noEmit` for main TypeScript code
- ❌ Missing: `deno check` for edge functions

This meant developers could commit edge function changes without type checking, leading to CI failures.

## Root Cause

**Gap in pre-commit validation**: The commit hooks didn't include Deno type checking, even though CI (`.github/workflows/edge-functions-quality.yml`) did run these checks.

## Resolution

### 1. Fixed All Type Errors

**Logger Tests** (11 errors):
```typescript
// Before (error)
const logEntry = JSON.parse(consoleOutput[0].message);

// After (fixed)
assert(typeof consoleOutput[0].message === 'string');
const logEntry = JSON.parse(consoleOutput[0].message);
```

**Metrics Tests** (6 errors):
```typescript
// Before (error)
assert(consoleOutput[0].message[0].includes('No timer found'));

// After (fixed)
assert(typeof consoleOutput[0].message[0] === 'string');
assert(consoleOutput[0].message[0].includes('No timer found'));
```

**Spam Detection Tests** (6 errors):
```typescript
// Before (error)
bio: null,
company: null,
location: null,

// After (fixed)
bio: undefined,
company: undefined,
location: undefined,
```

**Test Setup** (1 error):
```typescript
// Before (error in generateSpamUser)
name: null,
email: null,
// ...

// After (fixed)
name: '',
email: '',
// ...
```

### 2. Updated Pre-commit Hook

Added Deno type checking to `.husky/pre-commit`:

```bash
# Check if any staged files are in supabase/functions
if echo "$STAGED_FILES" | grep -qE '^supabase/functions/.*\.ts$'; then
  echo "🔍 Running Deno type check on edge functions..."

  if ! command -v deno &> /dev/null; then
    echo "⚠️  Deno not found. Skipping edge function type check."
    echo "   Install Deno to enable pre-commit checks"
  else
    cd supabase/functions && deno check _shared/*.ts tests/*.ts spam-detection/*.ts
    if [ $? -ne 0 ]; then
      echo "❌ Deno type check failed."
      exit 1
    fi
    echo "✅ Deno type check passed"
  fi
fi
```

### 3. Updated Documentation

Enhanced `supabase/functions/README.md` with:
- Type checking requirements and commands
- Pre-commit hook explanation
- Deno installation instructions
- Type safety rules with examples
- CI/CD pipeline overview

## Impact

### Before Fix
- ❌ Type errors caught only in CI (delayed feedback)
- ❌ Failed CI builds requiring force pushes or new commits
- ❌ Wasted CI minutes and developer time

### After Fix
- ✅ Type errors caught immediately at commit time
- ✅ Faster feedback loop (seconds vs minutes)
- ✅ Clean CI builds
- ✅ Better developer experience

## Lessons Learned

### What Went Well
- CI caught the errors before production
- Clear error messages from TypeScript/Deno
- Quick identification and resolution

### What Could Be Improved

1. **Pre-commit Parity**: Ensure pre-commit hooks match CI checks
2. **Documentation**: Make type checking requirements more visible
3. **Onboarding**: Include Deno installation in setup docs

## Action Items

- [x] Fix all type errors in edge function tests
- [x] Update pre-commit hook to include Deno type checking
- [x] Document type checking requirements
- [x] Add type safety examples to README
- [ ] Consider adding GitHub Action status badge to README
- [ ] Add Deno installation to main project setup guide
- [ ] Consider pre-commit CI for automatic PR checks

## Prevention

To prevent similar issues:

1. **Developers**: Install Deno locally to enable pre-commit checks
2. **New Contributors**: Follow setup guide including Deno installation
3. **Code Reviews**: Reviewers should verify CI passes before merge
4. **Monitoring**: Watch for CI failures and address immediately

## References

- [Pre-commit hook](.husky/pre-commit)
- [CI workflow](.github/workflows/edge-functions-quality.yml)
- [Edge Functions README](supabase/functions/README.md)
- [TypeScript Guidelines](CLAUDE.md)

## Type Safety Principles

This incident reinforced our TypeScript principles:

1. **Never use `any`** - Always define proper types
2. **Never use `unknown` as lazy fix** - Use proper type assertions
3. **Prefer `undefined` over `null`** - Better TypeScript ergonomics
4. **Assert types before use** - Runtime type checking for `unknown` values

These principles are now clearly documented in the edge functions README.
