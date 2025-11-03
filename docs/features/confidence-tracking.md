# Contributor Confidence Tracking Over Time

## Overview

The confidence tracking system stores historical confidence scores for repositories, enabling trend analysis and comparison over time. This feature helps maintainers understand if their project is becoming more or less approachable to contributors.

## Architecture

### Database Schema

#### `repository_confidence_history` Table

Stores historical snapshots of confidence calculations:

```sql
- id (uuid): Primary key
- repository_owner (text): GitHub owner/org name
- repository_name (text): Repository name
- confidence_score (integer): Score 0-100
- time_range_days (integer): Period used for calculation (30, 90, 365)
- breakdown (jsonb): Detailed confidence breakdown
- calculated_at (timestamptz): When score was calculated
- period_start (timestamptz): Start of measured period
- period_end (timestamptz): End of measured period
- data_version (integer): Algorithm version
- calculation_time_ms (integer): Performance tracking
```

**Key Indexes:**
- Composite index on `(repository_owner, repository_name, calculated_at DESC)` for trend queries
- Index on `time_range_days` for filtering by calculation period

### Services

#### `confidence-history.service.ts`

**Core Functions:**

```typescript
// Save confidence score to history
saveConfidenceToHistory(
  client: SupabaseClient,
  owner: string,
  repo: string,
  timeRangeDays: number,
  score: number,
  breakdown?: object,
  calculationTimeMs?: number
): Promise<void>

// Fetch historical scores for trend analysis
getConfidenceHistory(
  client: SupabaseClient,
  owner: string,
  repo: string,
  timeRangeDays: number,
  lookbackPeriods: number = 4
): Promise<ConfidenceHistoryPoint[]>

// Calculate trend from history
calculateConfidenceTrend(
  history: ConfidenceHistoryPoint[]
): ConfidenceTrend | null
```

#### `workspace-confidence.service.ts`

**Workspace-Level Aggregation:**

```typescript
// Get confidence trends for all repos in workspace
getWorkspaceConfidenceTrends(
  client: SupabaseClient,
  workspaceId: string,
  timeRangeDays: number
): Promise<WorkspaceConfidenceTrends>

// Calculate weighted average confidence
calculateWorkspaceConfidence(
  repoConfidences: Array<{ score: number; weight?: number }>
): number
```

## Usage

### Enable History Tracking

When calculating confidence, pass `saveToHistory: true`:

```typescript
import { calculateRepositoryConfidence } from '@/lib/insights/health-metrics';

// Calculate and save to history
const score = await calculateRepositoryConfidence(
  'owner',
  'repo',
  '30',       // timeRange
  false,      // forceRecalculate
  false,      // returnMetadata
  false,      // returnBreakdown
  true        // saveToHistory ✅
);
```

### Fetch Trend Data

```typescript
import { getConfidenceHistory, calculateConfidenceTrend } from '@/lib/insights/confidence-history.service';
import { supabase } from '@/lib/supabase';

// Get historical scores
const history = await getConfidenceHistory(
  supabase,
  'facebook',
  'react',
  30,  // time range days
  4    // look back 4 periods (120 days total)
);

// Calculate trend
const trend = calculateConfidenceTrend(history);
console.log(trend);
// {
//   direction: 'improving',
//   changePercent: 12.5,
//   currentScore: 45,
//   previousScore: 40,
//   dataPoints: 4
// }
```

### Workspace Overview Integration

The workspace overview automatically displays confidence trends:

```typescript
// WorkspaceDashboard.tsx receives:
interface WorkspaceMetrics {
  contributorConfidence?: number;
  confidenceTrend?: number;
  confidenceTrendDirection?: 'improving' | 'declining' | 'stable';
}
```

## Trend Calculation

### Threshold for "Stable"

- **±5%**: Changes within 5% are considered "stable"
- **>5%**: Marked as "improving"
- **<-5%**: Marked as "declining"

### Comparison Method

1. Fetch last N historical scores (default: 4 periods)
2. Compare most recent vs. previous score
3. Calculate percentage change
4. Apply threshold logic

## Data Retention

- **History**: Kept for 365 days
- **Cache**: Expires based on repository activity (30 min - 1 hour)
- **Cleanup**: Automated function `cleanup_old_confidence_history()`

## Performance Considerations

### Caching Strategy

1. **In-Memory Cache**: 5-minute TTL for frequently accessed scores
2. **Database Cache**: `repository_confidence_cache` for recent calculations
3. **History Table**: Long-term storage for trend analysis

### Query Optimization

- Use composite indexes for trend queries
- Limit lookback periods to avoid large scans
- Cache workspace-level aggregations

## Future Enhancements

### Phase 1 (This Implementation)
- ✅ Database schema for history
- ✅ History persistence during calculation
- ✅ Trend calculation API
- ✅ Workspace aggregation
- ✅ Dashboard integration

### Phase 2 (Future Work - Issue #139)
- [ ] Frontend trend indicators on repository pages
- [ ] Sparkline charts
- [ ] Interactive trend comparison
- [ ] Repository-level confidence cards with trends

### Phase 3 (Future Work)
- [ ] Scheduled background jobs for daily snapshots
- [ ] Inngest workflow for reliable calculation
- [ ] Backfill script for historical data
- [ ] Email notifications for significant changes

## Troubleshooting

### No History Data

**Problem**: Confidence scores calculated but no history shown.

**Solution**: Ensure `saveToHistory: true` is passed to `calculateRepositoryConfidence()`.

### Trend Shows "Stable" When Changing

**Problem**: Score changed but trend shows "stable".

**Solution**: Change must exceed ±5% threshold. Adjust threshold in `calculateConfidenceTrend()` if needed.

### Workspace Confidence is 0

**Problem**: Workspace shows 0% confidence despite repositories having scores.

**Solution**:
1. Check that repositories are properly linked to workspace
2. Verify confidence scores exist for each repository
3. Ensure adequate data for calculation (need events, PRs, etc.)

## API Reference

### Types

```typescript
interface ConfidenceHistoryPoint {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  confidenceScore: number;
  timeRangeDays: number;
  breakdown?: {
    starForkConfidence: number;
    engagementConfidence: number;
    retentionConfidence: number;
    qualityConfidence: number;
  };
  calculatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

interface ConfidenceTrend {
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  currentScore: number;
  previousScore: number;
  dataPoints: number;
}

interface WorkspaceConfidenceTrends {
  averageConfidence: number;
  trend: ConfidenceTrend | null;
  repositories: RepositoryConfidenceData[];
  calculatedAt: Date;
}
```

## Related Files

- Migration: `supabase/migrations/20251027221935_confidence_history.sql`
- History Service: `src/lib/insights/confidence-history.service.ts`
- Workspace Service: `src/services/workspace-confidence.service.ts`
- Calculation: `src/lib/insights/health-metrics.ts:505-732`
- UI Component: `src/components/features/workspace/WorkspaceDashboard.tsx`

## Examples

### Example 1: Manual Snapshot

```typescript
import { calculateRepositoryConfidence } from '@/lib/insights/health-metrics';

// Take a manual snapshot with history persistence
const result = await calculateRepositoryConfidence(
  'vercel',
  'next.js',
  '30',
  true,  // force recalculate
  true,  // return metadata
  false,
  true   // save to history
);

console.log(`Snapshot saved: ${result.score}% at ${result.calculatedAt}`);
```

### Example 2: Compare Time Periods

```typescript
import { getConfidenceForPeriods } from '@/lib/insights/confidence-history.service';

const periods = [
  { start: new Date('2024-10-01'), end: new Date('2024-10-31') },
  { start: new Date('2024-11-01'), end: new Date('2024-11-30') },
];

const comparisons = await getConfidenceForPeriods(
  supabase,
  'facebook',
  'react',
  periods
);

comparisons.forEach(c => {
  console.log(`${c.period.start} - ${c.period.end}: ${c.score}%`);
});
```

### Example 3: Workspace Dashboard

```typescript
import { getWorkspaceConfidenceTrends } from '@/services/workspace-confidence.service';

const trends = await getWorkspaceConfidenceTrends(
  supabase,
  'workspace-uuid',
  30
);

console.log(`Workspace Confidence: ${trends.averageConfidence}%`);
console.log(`Trend: ${trends.trend?.direction} (${trends.trend?.changePercent}%)`);
```

## Migration Guide

If migrating from the old confidence cache system:

1. Run the new migration: `20251027221935_confidence_history.sql`
2. Existing cache data remains functional
3. New calculations will populate history table when `saveToHistory: true`
4. No breaking changes to existing code
5. Optional: Run backfill script to populate historical data (future work)
