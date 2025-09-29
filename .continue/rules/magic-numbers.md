# Magic Numbers and Constants Code Review Rule

## Purpose
Prevent magic numbers from being introduced into the codebase by enforcing the use of named constants.

## What to Flag in Code Review

### Always Flag
- Numeric literals used directly in code (except 0, 1, -1 for basic operations)
- Time calculations using raw milliseconds: `24 * 60 * 60 * 1000`
- Day calculations: `30`, `7`, `14`, `60`, `90` when referring to time periods
- API limits hardcoded inline: `if (items.length > 100)`
- Batch sizes: `500`, `1000`, `50`
- Timeouts: `30000`, `60000`, `5000`

### Required Fixes
1. Extract to `src/lib/constants/time-constants.ts`:
   - Time periods (days, weeks, months)
   - Millisecond conversions
   - Cache TTLs
   - Timeout values

2. Extract to `src/lib/constants/api-constants.ts`:
   - API rate limits
   - Pagination sizes
   - Batch processing limits
   - HTTP status codes

3. Use helper functions:
   ```typescript
   // ❌ BAD
   const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

   // ✅ GOOD
   const date = timeHelpers.daysAgo(TIME_PERIODS.DEFAULT_METRICS_DAYS);
   ```

## Detection Patterns

```bash
# Find potential magic numbers
rg '\b(30|60|24|1000|100|500|1440|3600|86400)\b' --type ts --type tsx | grep -v constants/

# Find time calculations
rg '\d+\s*\*\s*24\s*\*\s*60\s*\*\s*60' --type ts --type tsx

# Find hardcoded limits
rg '(length|size|count|limit)\s*[<>=]+\s*\d{2,}' --type ts --type tsx
```

## Example Violations and Fixes

```typescript
// ❌ VIOLATION: Magic number for days
if (daysSinceUpdate <= 30) { ... }

// ✅ FIX
if (daysSinceUpdate <= TIME_PERIODS.ONE_MONTH) { ... }

// ❌ VIOLATION: Hardcoded batch size
const BATCH_SIZE = 100;

// ✅ FIX
import { API_LIMITS } from '@/lib/constants/api-constants';
const BATCH_SIZE = API_LIMITS.MAX_BATCH_SIZE;

// ❌ VIOLATION: Raw timeout value
setTimeout(() => {}, 5000);

// ✅ FIX
setTimeout(() => {}, TIMEOUT_SETTINGS.POLLING_INTERVAL_MS);
```

## Review Checklist
- [ ] No raw numeric literals for time periods
- [ ] All millisecond calculations use timeHelpers
- [ ] API limits use constants from api-constants.ts
- [ ] Timeout values are named constants
- [ ] Cache TTLs are defined in constants
- [ ] HTTP status codes use HTTP_STATUS constants