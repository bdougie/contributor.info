# Contributor Confidence Trend Indicators

## Overview

The Contributor Confidence Trend feature adds visual indicators to show how confidence scores change over time, helping maintainers understand if their project is becoming more or less approachable.

## Phase 1: Basic Trend Calculation (Implemented)

### Features

1. **Trend Calculation**
   - Compares current confidence score with previous period
   - Returns trend direction: `improving`, `declining`, or `stable`
   - Uses configurable threshold (default: ±5%) for "stable" classification
   - Handles cases with no historical data gracefully

2. **Visual Indicators**
   - ↗️ TrendingUp icon for improving trends (green)
   - ↘️ TrendingDown icon for declining trends (red)
   - ➡️ Minus icon for stable trends (gray)
   - Percentage change displayed next to icon
   - Hover tooltip shows full trend details

3. **Data Integration**
   - Automatically saves confidence scores to history table
   - Retrieves previous period's score for comparison
   - Caches trend data along with confidence scores
   - Gracefully handles first-time calculations (no historical data)

## Architecture

### Core Function

```typescript
async function calculateConfidenceTrendData(
  supabase: SupabaseClient<Database>,
  owner: string,
  repo: string,
  timeRangeDays: number,
  currentScore: number,
  trendThreshold: number = 5
): Promise<ConfidenceTrendData>
```

**Parameters:**
- `supabase`: Supabase client for database access
- `owner`: Repository owner
- `repo`: Repository name
- `timeRangeDays`: Time range for calculation (e.g., 30, 60, 90 days)
- `currentScore`: The newly calculated confidence score
- `trendThreshold`: Percentage threshold for stable classification (default: 5)

**Returns:**
```typescript
interface ConfidenceTrendData {
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  currentScore: number;
  previousScore: number;
  hasSufficientData: boolean;
}
```

### Modified Interfaces

#### ConfidenceResultWithTrend
```typescript
export interface ConfidenceResultWithTrend extends ConfidenceResult {
  trend?: ConfidenceTrendData;
}
```

#### ConfidenceBreakdownWithTrend
```typescript
export interface ConfidenceBreakdownWithTrend extends ConfidenceBreakdown {
  trend?: ConfidenceTrendData;
}
```

### Function Signature Updates

The `calculateRepositoryConfidence` function now supports trend calculation:

```typescript
// With breakdown and trend
const result = await calculateRepositoryConfidence(
  owner,
  repo,
  '30',           // timeRange
  false,          // forceRecalculate
  false,          // returnMetadata
  true,           // returnBreakdown
  true,           // saveToHistory (required for trends)
  true            // returnTrend
) as ConfidenceBreakdownWithTrend;
```

## UI Components

### ContributorConfidenceCard

**New Props:**
```typescript
interface ContributorConfidenceCardProps {
  // ... existing props
  trend?: {
    direction: 'improving' | 'declining' | 'stable';
    changePercent: number;
    currentScore: number;
    previousScore: number;
    hasSufficientData: boolean;
  };
}
```

**Visual Implementation:**
- Trend indicator appears next to the confidence title
- Icon and percentage change shown inline
- Color-coded based on direction:
  - Green for improving
  - Red for declining
  - Gray for stable
- Tooltip shows full details on hover

## Database Schema

Uses the existing `repository_confidence_history` table:

```sql
CREATE TABLE repository_confidence_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_owner text NOT NULL,
  repository_name text NOT NULL,
  confidence_score integer NOT NULL,
  time_range_days integer NOT NULL,
  breakdown jsonb,
  calculated_at timestamptz NOT NULL DEFAULT NOW(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  data_version integer NOT NULL DEFAULT 1,
  calculation_time_ms integer
);
```

## Usage Examples

### Basic Usage with Trend

```typescript
import { calculateRepositoryConfidence } from '@/lib/insights/health-metrics';

// Calculate confidence with trend
const result = await calculateRepositoryConfidence(
  'facebook',
  'react',
  '30',
  false,
  false,
  true,  // returnBreakdown
  true,  // saveToHistory
  true   // returnTrend
);

console.log('Score:', result.score);
console.log('Trend:', result.trend?.direction);
console.log('Change:', result.trend?.changePercent);
```

### In React Components

```typescript
const [confidenceTrend, setConfidenceTrend] = useState<ConfidenceTrendData | undefined>();

const calculateConfidence = async () => {
  const result = await calculateRepositoryConfidence(
    owner,
    repo,
    timeRange,
    false,
    false,
    true,
    true,
    true
  ) as ConfidenceBreakdownWithTrend;
  
  setConfidenceTrend(result.trend);
};

// Pass to component
<ContributorConfidenceCard
  confidenceScore={score}
  breakdown={breakdown}
  trend={confidenceTrend}
/>
```

## Algorithm Details

### Trend Classification

1. **Calculate percentage change:**
   ```typescript
   changePercent = ((currentScore - previousScore) / previousScore) * 100
   ```

2. **Classify direction:**
   - If `|changePercent| < threshold` → `stable`
   - If `changePercent > threshold` → `improving`
   - If `changePercent < -threshold` → `declining`

3. **Default threshold:** ±5%

### Edge Cases

1. **No Historical Data**
   - Direction: `stable`
   - `hasSufficientData: false`
   - Uses current score as both current and previous

2. **First Calculation**
   - Saves to history but shows no trend
   - Future calculations will use this as baseline

3. **Database Errors**
   - Returns neutral/stable trend
   - Logs error for debugging
   - Doesn't fail the entire confidence calculation

## Testing

### Unit Tests

Location: `src/lib/insights/__tests__/confidence-trend.test.ts`

**Test Coverage:**
- ✅ Returns stable trend when no historical data exists
- ✅ Calculates improving trend when score increases > 5%
- ✅ Calculates declining trend when score decreases > 5%
- ✅ Calculates stable trend when change is within ±5%
- ✅ Includes current and previous scores in trend data
- ✅ Handles errors gracefully
- ✅ Respects returnTrend flag
- ✅ Saves to history when enabled

**Run tests:**
```bash
npm test -- confidence-trend
```

## Configuration

### Trend Threshold

The threshold can be adjusted in `calculateConfidenceTrendData`:

```typescript
const trendData = await calculateConfidenceTrendData(
  supabase,
  owner,
  repo,
  daysBack,
  finalScore,
  10  // Custom threshold: ±10%
);
```

### Cache Behavior

- Trend data is cached along with confidence scores
- Cache TTL: 30-60 minutes (based on repository activity)
- Force recalculation invalidates cache

## Performance Considerations

1. **Database Queries**
   - Single query to fetch previous score
   - No N+1 query problems
   - Uses indexed columns (owner, name, time_range_days)

2. **Caching**
   - In-memory cache for repeated requests
   - Database cache for cross-session persistence
   - Trend data included in cache payload

3. **Calculation Time**
   - Negligible overhead (~10-50ms)
   - Does not block confidence calculation
   - Fails gracefully on timeout

## Future Enhancements (Phase 2 & 3)

### Phase 2: Visual Indicators ✅ (Partially Complete)
- [x] Add trend arrow icons
- [x] Display percentage change
- [x] Color coding for trend direction
- [ ] Include trend in tooltip breakdown

### Phase 3: Historical Chart (Planned)
- [ ] Add mini sparkline chart
- [ ] Support multiple time period comparisons
- [ ] Hover states showing historical values
- [ ] Export historical data

## Related Files

- `src/lib/insights/health-metrics.ts` - Core trend calculation
- `src/lib/insights/confidence-history.service.ts` - History management
- `src/components/features/health/contributor-confidence-card.tsx` - UI display
- `src/components/features/health/repository-health-card.tsx` - Integration
- `src/lib/insights/__tests__/confidence-trend.test.ts` - Tests

## Troubleshooting

### Trend Not Showing

1. **Check if `saveToHistory` is enabled:**
   ```typescript
   calculateRepositoryConfidence(owner, repo, timeRange, false, false, true, true, true)
   //                                                                    ^^^^^ must be true
   ```

2. **Verify historical data exists:**
   ```sql
   SELECT * FROM repository_confidence_history
   WHERE repository_owner = 'owner' AND repository_name = 'repo'
   ORDER BY calculated_at DESC LIMIT 5;
   ```

3. **Check console logs:**
   - Look for `[Confidence Trend]` log messages
   - Verify no database errors

### Incorrect Trend Direction

1. **Verify threshold setting** (default: 5%)
2. **Check calculation time alignment** (same time_range_days)
3. **Ensure sufficient historical data** (`hasSufficientData` flag)

## See Also

- [Contributor Confidence Feature](./contributor-confidence.md)
- [Confidence History Service](../architecture/confidence-history-architecture.md)
- [Database Schema](../database-schema.md)
