# Quick Reference: Cleanup Priorities

## Immediate Actions (Delete These Files)

### Critical Deletions
```bash
# File 1: Backup test setup (9KB) - NEVER USED
rm src/__mocks__/setup.backup.ts

# File 2: Orphaned test component (70 lines) - NEVER IMPORTED
rm src/test-social-links.tsx

# Files 3-5: Unused mock setup files (not referenced in vitest config)
rm src/__mocks__/isolated-setup.ts
rm src/__mocks__/minimal-setup.ts
rm src/__mocks__/simple-setup.ts
```

**Total lines removed: ~600 lines**

---

## Type Safety Fixes (High Priority)

### Pattern 1: Fix `any` in evaluations
**File:** `src/evals/datasets/ground-truth-extractor.ts`
```typescript
// BEFORE (WRONG)
private balanceDataset(contributorRoles: any[]): any[] {

// AFTER (CORRECT)
private balanceDataset(contributorRoles: ContributorRole[]): ContributorRole[] {
```

### Pattern 2: Fix `any` in components
**File:** `src/components/features/contributor/contributor-of-the-month-simple.tsx`
```typescript
// BEFORE (WRONG)
contributor: any;
contributors: any[];

// AFTER (CORRECT)
contributor: Contributor;
contributors: Contributor[];
```

### Pattern 3: Fix error handling
**File:** `src/hooks/use-admin-auth.ts`
```typescript
// BEFORE (WRONG)
} catch (error: any) {

// AFTER (CORRECT)
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

---

## TODO Items by Component

### Activity Feed (Blocking features)
- [ ] `metrics-and-trends-card.tsx` - Add debouncing/rate limiting
- [ ] `ActivityFeed.tsx` - Use real workspaceId data fetch

### Layout (Missing features)
- [ ] `layout.tsx` - Populate recent repositories
- [ ] `layout.tsx` - Track recent items

### Workspace (Mock data)
- [ ] `workspace-page.tsx` - Generate real activities from repositories
- [ ] `workspace-page.tsx` - Generate real trend data
- [ ] `workspace.service.ts` (4 TODOs) - Calculate star/contributor counts

---

## Large File Refactoring Targets

| File | Size | Suggestion |
|------|------|-----------|
| `workspace-page.tsx` | 1831L | Split into hooks/components |
| `workspace.service.ts` | 1825L | Extract into focused modules |
| `health-metrics.ts` | 1556L | Merge with issue-metrics.ts |
| `llm-service.ts` | 1289L | Extract OpenAI integration |
| `ContributorProfileModal.tsx` | 1265L | Extract modal sections |

---

## Files with Multiple `any` Types

```
🔴 CRITICAL (Use immediately)
- src/evals/datasets/ground-truth-extractor.ts (4+ any)
- src/components/features/contributor/contributor-of-the-month-simple.tsx (2+ any)
- src/hooks/use-repository-summary.ts (3+ any)

🟠 HIGH (Next week)
- src/components/features/repository/progressive-repo-view.tsx
- src/components/features/repository/repo-stats-summary.tsx
- src/hooks/use-github-organizations.ts
- src/hooks/use-admin-auth.ts
```

---

## Unused Dependencies to Verify

1. **d3-interpolate** - Only in mocks, check if needed
2. **@nivo/core** - Used only in contributions.tsx (OK)
3. **@react-spring/web** - Used only in contributions.tsx (OK)
4. **dub** - Verify sharing functionality is active
5. **html2canvas** - Verify social card generation is active

---

## Copy-Paste Template: Fixing `any` Types

```typescript
// Step 1: Find the interface definition
import type { Contributor } from '@/types';

// Step 2: Replace any with interface
// ❌ BEFORE
const contributors: any[] = data;

// ✅ AFTER
const contributors: Contributor[] = data;

// Step 3: Add proper error handling if needed
// ✅ AFTER
const contributors = (data: unknown): data is Contributor[] => {
  return Array.isArray(data) && 
    data.every(item => 'id' in item && 'username' in item);
};
```

---

## Verification Commands

```bash
# Check remaining any types
grep -r ": any" src --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v __mocks__

# Check remaining TODOs
grep -r "TODO\|FIXME" src --include="*.ts" --include="*.tsx" | grep -v __tests__

# Check references to deleted files (after cleanup)
grep -r "setup.backup\|test-social-links\|isolated-setup" src --include="*.ts"

# Count lines before/after
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs wc -l | tail -1
```

---

## Expected Outcomes

✅ 600+ lines of dead code removed  
✅ 20+ `any` types converted to proper interfaces  
✅ 18 TODOs tracked and prioritized  
✅ Test setup configuration simplified  
✅ Type safety improved  
✅ Codebase clarity improved  

---

**Duration:** 2-3 sprints (phased cleanup)  
**Risk Level:** Low (mostly removing unused code)  
**Testing:** Run `npm run typecheck` and `npm run test` after changes
