# PRD: Activity Feed Improvements & Historical Stars Tracking

## Overview

This PRD addresses issues #660 and #661 for workspace activity feed improvements, plus fixes the Total Stars card to use historical data from the `github_events_cache` table.

**Issues:**
- #660: Phase 2 - Pagination, defensive payload checks, caching strategies
- #661: Phase 3 - Rate limiting, error boundaries, lazy loading
- **New**: Total Stars card shows only current count without historical trend data

**Current State:**
- Activity feed fetches star/fork events but has no pagination
- No payload validation or error boundaries around event processing
- No caching strategy - fresh fetch on every page load
- Total Stars card sums `stargazers_count` from repos instead of using historical `WatchEvent` data
- No rate limiting on API calls
- Missing lazy loading optimizations

**Success Metrics:**
- Activity feed handles 1000+ events smoothly
- Total Stars shows accurate historical trends
- < 2s page load time with caching
- Zero crashes from malformed event data
- Reduced API calls by 70% through caching

---

## Phase 1: Historical Stars Tracking (HIGH Priority)

### Problem
The Total Stars card in `WorkspaceDashboard` currently displays:
- `totalStars`: Sum of current `stargazers_count` from all repos
- `starsTrend`: Compares current total against `previousMetrics.starCount`

**But there's no mechanism to capture/store `previousMetrics`!**

The data is available in `github_events_cache` table as `WatchEvent` records, but the workspace page doesn't use it.

### Solution

#### 1.1 Integrate Event-Based Stars into Workspace Metrics

**File:** `src/services/workspace-aggregation.service.ts`

Add method to calculate historical star metrics:

```typescript
private async calculateHistoricalStarMetrics(
  workspaceId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<{ totalStars: number; starsTrend: number }> {
  // Get repositories in workspace
  const { data: repos } = await this.supabase
    .from('workspace_repositories')
    .select('repository_id, repositories(owner, name, stargazers_count)')
    .eq('workspace_id', workspaceId);

  if (!repos?.length) return { totalStars: 0, starsTrend: 0 };

  // Get star events for current period
  const currentStarEvents = await this.getStarEventsForPeriod(
    repos.map(r => ({ owner: r.repositories.owner, name: r.repositories.name })),
    currentPeriodStart,
    currentPeriodEnd
  );

  // Get star events for previous period
  const previousStarEvents = await this.getStarEventsForPeriod(
    repos.map(r => ({ owner: r.repositories.owner, name: r.repositories.name })),
    previousPeriodStart,
    previousPeriodEnd
  );

  // Calculate trend
  const currentCount = currentStarEvents.length;
  const previousCount = previousStarEvents.length;
  const starsTrend = previousCount > 0
    ? ((currentCount - previousCount) / previousCount) * 100
    : currentCount > 0 ? 100 : 0;

  // Total stars = current repo count (absolute) + new stars in period
  const totalStars = repos.reduce((sum, r) => sum + (r.repositories.stargazers_count || 0), 0);

  return { totalStars, starsTrend };
}
```

#### 1.2 Update Workspace Page to Use Historical Data

**File:** `src/pages/workspace-page.tsx`

Replace `calculateRealMetrics` to use event-based star data:

```typescript
// Use workspace events service for star trends
const { metrics: eventMetrics } = useWorkspaceEvents({
  workspaceId,
  timeRange,
  enabled: !!workspaceId
});

// Merge event-based stars with other metrics
const realMetrics = {
  totalStars: eventMetrics?.stars.total || totalStarsFromRepos,
  starsTrend: eventMetrics?.stars.percentChange || 0,
  // ... other metrics
};
```

**Acceptance Criteria:**
- ✅ Total Stars shows count from `stargazers_count` (absolute truth)
- ✅ Stars trend shows % change based on `WatchEvent` timestamps in selected time range
- ✅ Trend compares current period vs previous period (e.g., last 30d vs prior 30d)
- ✅ Card subtitle shows "vs previous period" with accurate percentage

---

## Phase 2: Pagination & Caching (#660)

### 2.1 Implement Pagination for Activity Feed

**File:** `src/services/workspace-events.service.ts`

Add pagination support to `getWorkspaceActivityFeed`:

```typescript
async getWorkspaceActivityFeed(
  workspaceId: string,
  options: {
    limit?: number;
    offset?: number;
    cursor?: string; // For cursor-based pagination
    eventTypes?: string[];
  } = {}
): Promise<{
  events: ActivityEvent[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
}> {
  const { limit = 50, offset = 0, cursor, eventTypes } = options;

  // Implement cursor-based pagination for better performance
  // Use created_at + id as cursor
}
```

**File:** `src/hooks/use-workspace-events.ts`

Add `useWorkspaceActivityFeedPaginated` hook:

```typescript
export function useWorkspaceActivityFeedPaginated(
  workspaceId?: string,
  options?: { pageSize?: number; eventTypes?: string[] }
) {
  const [page, setPage] = useState(0);
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([]);

  // Load more implementation
  // Infinite scroll integration
}
```

**Acceptance Criteria:**
- ✅ Activity feed loads 50 events initially
- ✅ "Load More" button appears when more events available
- ✅ Cursor-based pagination for consistent results
- ✅ Loading states for pagination actions

### 2.2 Add Defensive Payload Checks

**File:** `src/lib/event-validation.ts` (NEW)

```typescript
import { z } from 'zod';

// Zod schemas for event payloads
export const WatchEventPayloadSchema = z.object({
  action: z.literal('started'),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
  }),
  sender: z.object({
    login: z.string(),
    avatar_url: z.string().url(),
  }),
});

export const ForkEventPayloadSchema = z.object({
  forkee: z.object({
    id: z.number(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
      avatar_url: z.string().url(),
    }),
  }),
});

export function validateEventPayload<T>(
  payload: unknown,
  schema: z.ZodSchema<T>
): { valid: true; data: T } | { valid: false; error: string } {
  try {
    const data = schema.parse(payload);
    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof z.ZodError ? error.message : 'Invalid payload'
    };
  }
}
```

**File:** `src/services/workspace-events.service.ts`

Add validation before processing:

```typescript
private validateAndTransformEvent(event: RawEvent): ActivityEvent | null {
  // Validate payload
  const validation = validateEventPayload(event.payload, getSchemaForEventType(event.event_type));

  if (!validation.valid) {
    console.warn(`Invalid event payload for ${event.event_id}:`, validation.error);
    return null; // Skip invalid events
  }

  // Transform validated event
  return this.transformEvent(event, validation.data);
}
```

**Acceptance Criteria:**
- ✅ All event payloads validated with Zod schemas
- ✅ Invalid events logged but don't crash UI
- ✅ Fallback handling for missing avatar URLs
- ✅ Type-safe event processing throughout

### 2.3 Caching Strategy with React Query

**File:** `src/hooks/use-workspace-events.ts`

Refactor to use React Query:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useWorkspaceEvents({
  workspaceId,
  timeRange = '30d',
  enabled = true,
}: UseWorkspaceEventsProps) {
  return useQuery({
    queryKey: ['workspace-events', workspaceId, timeRange],
    queryFn: () => workspaceEventsService.getWorkspaceEventMetrics(workspaceId, timeRange),
    enabled: !!workspaceId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}
```

**Acceptance Criteria:**
- ✅ Events cached for 5 minutes
- ✅ Background refetch after stale time
- ✅ Optimistic updates for UI interactions
- ✅ Query invalidation on time range changes

---

## Phase 3: Advanced Optimizations (#661)

### 3.1 Rate Limiting for API Calls

**File:** `src/lib/rate-limiter.ts` (NEW)

```typescript
class RateLimiter {
  private queue: Array<() => Promise<unknown>> = [];
  private activeRequests = 0;
  private readonly maxConcurrent = 3;
  private readonly minDelay = 100; // ms between requests

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    // Process with concurrency limits and delays
  }
}

export const githubRateLimiter = new RateLimiter();
```

**Acceptance Criteria:**
- ✅ Max 3 concurrent GitHub API requests
- ✅ 100ms minimum delay between requests
- ✅ Exponential backoff on rate limit errors
- ✅ User-friendly "Rate limited" message

### 3.2 Granular Error Boundaries

**File:** `src/components/features/workspace/ActivityFeedErrorBoundary.tsx` (NEW)

```typescript
export function ActivityItemErrorBoundary({ children, eventId }: Props) {
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <div className="p-4 border border-red-200 rounded">
          <p>Failed to load activity item</p>
          <Button onClick={resetErrorBoundary} size="sm">Retry</Button>
        </div>
      )}
      onError={(error) => {
        console.error(`Activity item ${eventId} error:`, error);
        // Optional: Send to Sentry
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

**Acceptance Criteria:**
- ✅ Individual activity items wrapped in error boundaries
- ✅ Fallback UI with retry button
- ✅ Errors don't break entire feed
- ✅ Error logging for debugging

### 3.3 Virtual Scrolling & Lazy Loading

**File:** `src/components/features/workspace/ActivityTable.tsx`

Use `@tanstack/react-virtual`:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export function ActivityTable({ activities }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Average activity item height
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div key={virtualItem.key} data-index={virtualItem.index}>
            <ActivityItem activity={activities[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- ✅ Only render visible activity items
- ✅ Smooth scrolling with 5-item overscan
- ✅ Performance with 1000+ items
- ✅ Proper height estimation for varied content

---

## Testing Strategy

### Unit Tests
```typescript
// src/services/__tests__/workspace-events.service.test.ts
describe('WorkspaceEventsService', () => {
  it('validates event payloads with Zod', () => {});
  it('handles malformed payloads gracefully', () => {});
  it('calculates star trends correctly', () => {});
});
```

### Integration Tests
```typescript
// src/hooks/__tests__/use-workspace-events.test.tsx
describe('useWorkspaceEvents', () => {
  it('caches events for 5 minutes', () => {});
  it('refetches on time range change', () => {});
});
```

### E2E Tests (only if critical)
- Activity feed renders 1000+ items
- Pagination loads more events
- Error boundaries catch failures

---

## Implementation Order

1. ✅ **Phase 1.1-1.2**: Historical stars tracking (2-3 hours)
2. **Phase 2.2**: Defensive payload checks (1-2 hours)
3. **Phase 2.3**: React Query caching (2-3 hours)
4. **Phase 2.1**: Pagination (3-4 hours)
5. **Phase 3.2**: Error boundaries (1-2 hours)
6. **Phase 3.3**: Virtual scrolling (2-3 hours)
7. **Phase 3.1**: Rate limiting (2-3 hours)

**Total Estimated Time**: 13-20 hours

---

## Files to Modify

- `src/services/workspace-aggregation.service.ts` - Historical star metrics
- `src/services/workspace-events.service.ts` - Pagination, validation
- `src/hooks/use-workspace-events.ts` - React Query integration
- `src/pages/workspace-page.tsx` - Use event-based metrics
- `src/lib/event-validation.ts` - NEW - Payload validation
- `src/lib/rate-limiter.ts` - NEW - Rate limiting
- `src/components/features/workspace/ActivityFeedErrorBoundary.tsx` - NEW
- `src/components/features/workspace/ActivityTable.tsx` - Virtual scrolling

---

## Rollout Plan

1. **Week 1**: Phase 1 (Historical stars) + Phase 2.2 (Validation)
2. **Week 2**: Phase 2.1 (Pagination) + Phase 2.3 (Caching)
3. **Week 3**: Phase 3 (All advanced optimizations)

---

## Related Issues

- #660: Phase 2 implementation
- #661: Phase 3 implementation
- #657: Original star/fork events implementation
- #659: PR that added star/fork events
