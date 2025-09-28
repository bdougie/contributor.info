# Date Formatting Guide

## Overview

This guide documents the standardized date formatting approach used throughout the contributor.info codebase. Following these patterns ensures consistent date handling and prevents timezone-related bugs.

## Problem Statement

Prior to standardization, the codebase had:
- 121 files using `toISOString()` inconsistently
- Mixed date-only vs full timestamp formats in database queries
- Timezone-sensitive bugs when filtering data
- No centralized date utilities

## Solution: Centralized Date Utilities

All date formatting is now handled through utilities in `src/lib/utils/date-formatting.ts`.

## Key Functions

### `toDateOnlyString(date: Date): string`
Returns date in `YYYY-MM-DD` format, stripping time components.

**Use for:**
- Database date comparisons
- Date-based grouping
- Date range queries

```typescript
import { toDateOnlyString } from '@/lib/utils/date-formatting';

const dateOnly = toDateOnlyString(new Date()); // "2025-01-27"
```

### `toUTCTimestamp(date: Date): string`
Returns full ISO 8601 timestamp with timezone.

**Use for:**
- Storing exact timestamps
- Audit logs
- Cache expiration times

```typescript
import { toUTCTimestamp } from '@/lib/utils/date-formatting';

const timestamp = toUTCTimestamp(new Date()); // "2025-01-27T14:30:00.000Z"
```

### `createDateForDBQuery(date: Date, dateOnly: boolean): string`
Smart formatter that chooses the appropriate format.

```typescript
import { createDateForDBQuery } from '@/lib/utils/date-formatting';

// For date comparisons
const queryDate = createDateForDBQuery(new Date(), true); // "2025-01-27"

// For timestamp storage
const timestamp = createDateForDBQuery(new Date(), false); // "2025-01-27T14:30:00.000Z"
```

### `createDateRange(startDate: Date, endDate: Date, dateOnly: boolean): { start: string; end: string }`
Creates consistent date ranges for queries.

```typescript
import { createDateRange } from '@/lib/utils/date-formatting';

const range = createDateRange(startDate, endDate, true);
// { start: "2025-01-01", end: "2025-01-31" }
```

### `getDateDaysAgo(days: number, dateOnly: boolean): string`
Calculates dates in the past.

```typescript
import { getDateDaysAgo } from '@/lib/utils/date-formatting';

const thirtyDaysAgo = getDateDaysAgo(30, true); // "2024-12-28"
```

## Usage Patterns

### Database Queries

#### ✅ Correct - Date-only for date comparisons
```typescript
import { toDateOnlyString } from '@/lib/utils/date-formatting';

const { data } = await supabase
  .from('pull_requests')
  .select('*')
  .gte('created_at', toDateOnlyString(startDate))
  .lte('created_at', toDateOnlyString(endDate));
```

#### ❌ Incorrect - Full timestamp causes timezone issues
```typescript
// DON'T DO THIS
const { data } = await supabase
  .from('pull_requests')
  .select('*')
  .gte('created_at', startDate.toISOString()); // Timezone-sensitive!
```

### Cache Expiration

#### ✅ Correct - Full timestamp for exact times
```typescript
import { toUTCTimestamp } from '@/lib/utils/date-formatting';

const cacheEntry = {
  data: result,
  expires_at: toUTCTimestamp(expiresAt),
  calculated_at: toUTCTimestamp(new Date())
};
```

### Date Grouping

#### ✅ Correct - Consistent date format
```typescript
import { toDateOnlyString } from '@/lib/utils/date-formatting';

const groupedData = data.reduce((acc, item) => {
  const date = toDateOnlyString(new Date(item.created_at));
  acc[date] = (acc[date] || 0) + 1;
  return acc;
}, {});
```

## Migration Guide

When updating existing code:

1. **Add import:**
```typescript
import { toDateOnlyString, toUTCTimestamp } from '@/lib/utils/date-formatting';
```

2. **Replace patterns:**

| Old Pattern | New Pattern | Use Case |
|------------|-------------|----------|
| `date.toISOString().split('T')[0]` | `toDateOnlyString(date)` | Date-only comparisons |
| `date.toISOString()` (for queries) | `toDateOnlyString(date)` | Database date queries |
| `date.toISOString()` (for storage) | `toUTCTimestamp(date)` | Timestamp storage |
| `new Date().toISOString()` | `toUTCTimestamp(new Date())` | Current timestamp |

## Common Pitfalls

### 1. Timezone Boundaries
When a date is near midnight UTC, it might be a different day in other timezones.

**Solution:** Always use `toDateOnlyString()` for date comparisons to ensure consistency.

### 2. Mixed Formats in Queries
Mixing date-only and timestamp formats in the same query can cause unexpected results.

**Solution:** Use consistent formats within a query - either all date-only or all timestamps.

### 3. Direct String Manipulation
Avoid manually manipulating date strings.

```typescript
// ❌ DON'T DO THIS
const dateOnly = dateString.substring(0, 10);

// ✅ DO THIS
const dateOnly = toDateOnlyString(new Date(dateString));
```

## Testing

Always test date-sensitive code with:
- Different timezones
- Daylight saving time transitions
- Leap years
- Month/year boundaries

Example test:
```typescript
describe('date filtering', () => {
  it('should handle timezone boundaries', () => {
    const edgeDate = new Date('2025-01-31T23:59:59.999Z');
    expect(toDateOnlyString(edgeDate)).toBe('2025-01-31');
  });
});
```

## Performance Considerations

The date utilities are optimized for performance:
- Minimal object creation
- Direct string manipulation where safe
- Suitable for bulk operations (tested with 1000+ dates)

## Related Files

- Implementation: `src/lib/utils/date-formatting.ts`
- Tests: `src/lib/utils/date-formatting.test.ts`
- Issue: [#647](https://github.com/bdougie/contributor.info/issues/647)
- PR: [#826](https://github.com/bdougie/contributor.info/pull/826)

## Questions?

If you encounter date-related issues or need clarification:
1. Check this guide first
2. Review the test file for examples
3. Ask in the project discussions