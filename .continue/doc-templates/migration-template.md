# Migration Guide: [Change Name]

## Overview

Brief summary of what changed and why this migration is needed.

**Version**: From vX.X.X to vY.Y.Y
**Date**: YYYY-MM-DD
**Severity**: 🔴 Critical / 🟡 Moderate / 🟢 Minor

## Who Is Affected?

- [ ] All users
- [ ] Users of [specific feature]
- [ ] Developers using [specific API]
- [ ] Self-hosted installations only

## What Changed?

### Before

```typescript
// Old way of doing things
import { oldFunction } from 'old-module';

oldFunction('param');
```

### After

```typescript
// New way of doing things
import { newFunction } from 'new-module';

newFunction({ param: 'value' });
```

### Breaking Changes

1. **Change 1**: `oldFunction()` is removed
   - **Why**: Reason for removal
   - **Impact**: What breaks if you don't update

2. **Change 2**: `OldComponent` props changed
   - **Old props**: `{ prop1: string }`
   - **New props**: `{ config: { prop1: string } }`
   - **Why**: Reason for change
   - **Impact**: Components won't compile

3. **Change 3**: Database schema updated
   - **What changed**: Column X renamed to Y
   - **Impact**: Queries using old column will fail

## Migration Steps

### Step 1: Update Dependencies

```bash
npm install package@latest
# or
yarn upgrade package
```

### Step 2: Update Code

#### Pattern 1: [Common Update]

**Before:**
```typescript
// Old code
const result = oldMethod(param);
```

**After:**
```typescript
// New code
const result = newMethod({ param });
```

#### Pattern 2: [Another Common Update]

**Before:**
```typescript
// Old code
```

**After:**
```typescript
// New code
```

### Step 3: Update Configuration

Update your configuration files:

**Before:**
```json
{
  "oldKey": "value"
}
```

**After:**
```json
{
  "newKey": "value"
}
```

### Step 4: Update Database (if applicable)

Run migration:

```bash
npm run migrate
# or
npx supabase db push
```

The migration will:
- Rename column X to Y
- Add index on column Z
- Preserve all existing data

### Step 5: Update Environment Variables

```bash
# .env
OLD_VAR=value     # ❌ Remove
NEW_VAR=value     # ✅ Add - serves same purpose as OLD_VAR
```

### Step 6: Test Your Changes

```bash
# Run tests to verify migration
npm test

# Test in development
npm run dev
```

## Automated Migration (if available)

We provide a codemod to automate most changes:

```bash
npx codemod-name migrate
```

This will automatically:
- Update import statements
- Rename function calls
- Update prop signatures (where possible)

**Manual review required for**: Complex cases that can't be automated

## Common Migration Issues

### Issue 1: [Common Problem]

**Symptom**: Error message or behavior

**Cause**: Why this happens

**Solution**:
```typescript
// Fix code
```

### Issue 2: [Another Problem]

**Symptom**: Error message or behavior

**Solution**: Steps to fix

## Rollback Plan

If you need to rollback:

### Step 1: Revert Code

```bash
git revert <commit-hash>
npm install package@<old-version>
```

### Step 2: Revert Database (if applicable)

```bash
npm run migrate:rollback
```

### Step 3: Restore Configuration

Restore old configuration files from backup.

## Verification Checklist

After migration, verify:

- [ ] Application builds without errors
- [ ] Tests pass
- [ ] Dev environment runs successfully
- [ ] [Feature X] still works
- [ ] [Feature Y] still works
- [ ] No console errors
- [ ] Database queries work
- [ ] External integrations work

## Timeline

| Date | Action |
|------|--------|
| YYYY-MM-DD | Migration guide published |
| YYYY-MM-DD | Old APIs deprecated (still work) |
| YYYY-MM-DD | Old APIs removed (breaking) |

## Getting Help

If you encounter issues:

1. Check [Troubleshooting](#common-migration-issues) section above
2. Search existing [GitHub Issues](link)
3. Ask in [Discord/Slack](link)
4. Open a new issue with:
   - Error message
   - Your code before and after migration
   - Steps to reproduce

## Examples

### Full Example: [Real-world Scenario]

Complete before and after example showing migration in context:

**Before:**
```typescript
// Full component/file before migration
```

**After:**
```typescript
// Full component/file after migration
```

## FAQ

### Q: Do I need to update everything at once?

A: No, you can update gradually. See [gradual migration strategy](#).

### Q: Will this affect production?

A: Yes/No. Details about production impact.

### Q: Can I still use the old API temporarily?

A: Yes/No. Details about backward compatibility period.

## Related

- [Changelog](../CHANGELOG.md)
- [Original RFC](../rfcs/RFC-XXX.md)
- [Architecture Documentation](../architecture/related-doc.md)
