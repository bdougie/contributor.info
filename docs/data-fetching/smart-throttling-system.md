# Smart Throttling System

## Overview

The Smart Throttling System is designed to provide an optimal user experience by ensuring data is available quickly on first visit while preventing API abuse. It uses context-aware throttling that adapts based on data completeness and sync reason.

## Key Features

### 1. Data Completeness Detection
The system checks if a repository has complete engagement data (reviews and comments) before applying strict throttling:

- **Complete Data**: Repository has PRs with reviews or comments
- **Incomplete Data**: Repository has PRs but missing engagement data
- **No Data**: Repository has no PR data at all

### 2. Dynamic Throttling by Reason

Different sync reasons have different cooldown periods:

| Reason | Cooldown | Use Case |
|--------|----------|----------|
| `manual` | 5 minutes | User-initiated manual sync |
| `auto-fix` | 15 minutes | Auto-detection fixing missing data |
| `scheduled` | 2 hours | Regular scheduled syncs |
| `pr-activity` | 1 hour | Triggered by PR activity |
| `default` | 30 minutes | Fallback for unknown reasons |

### 3. Intelligent Throttle Adjustment

The effective throttle time is calculated based on data completeness:

```typescript
effectiveThrottle = hasCompleteData 
  ? baseThrottle 
  : Math.min(baseThrottle, 5 minutes)
```

- **With complete data**: Use full throttle period
- **Without complete data**: Cap at 5 minutes maximum

### 4. Immediate Sync for Empty Repositories

If a repository has no engagement data and was synced less than 5 minutes ago, the system allows immediate re-sync to ensure users see data quickly.

## User Experience Flow

### First Visit (No Data)
1. User visits repository page
2. Auto-detection identifies missing data
3. Sync job queued with `auto-fix` reason
4. Data fetched immediately (no throttling)
5. User sees data within 1-2 minutes

### Subsequent Visits (Partial Data)
1. User visits repository page
2. Auto-detection identifies incomplete data
3. Sync allowed with minimal throttling (5 min max)
4. Missing data fetched to complete the picture

### Regular Updates (Complete Data)
1. Repository has complete data
2. Full throttling applied based on reason
3. Prevents unnecessary API calls

## Implementation Details

### Core Throttling Logic

```typescript
// Check data completeness
const { data: prData } = await supabase
  .from('pull_requests')
  .select('id')
  .eq('repository_id', repositoryId)
  .limit(10);

const { count: reviewCount } = await supabase
  .from('reviews')
  .select('*', { count: 'exact', head: true })
  .eq('repository_id', repositoryId);

const hasCompleteData = prData && prData.length > 0 && 
                        (reviewCount || 0) > 0;

// Apply smart throttling
const throttleHours = THROTTLE_CONFIG[reason] || THROTTLE_CONFIG.default;
const effectiveThrottle = hasCompleteData 
  ? throttleHours 
  : Math.min(throttleHours, 0.083);
```

### CORS Configuration

The API endpoint includes proper CORS headers for cross-origin requests:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

## API Endpoints

### Queue Event Endpoint
**URL**: `/.netlify/functions/api-queue-event`
**Method**: POST
**Purpose**: Queue Inngest events from the browser

**Request Body**:
```json
{
  "eventName": "capture/repository.sync.graphql",
  "data": {
    "repositoryId": "uuid",
    "repositoryName": "owner/repo",
    "days": 7,
    "priority": "high",
    "reason": "manual"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Event queued successfully",
  "eventId": "event-id",
  "eventIds": ["event-id"]
}
```

## Testing Strategy

Following bulletproof testing guidelines:

1. **Pure Function Tests**: Throttling logic extracted into pure functions
2. **No Async Tests**: All tests are synchronous
3. **Quick Execution**: Tests complete in milliseconds
4. **No External Dependencies**: No database or API calls

### Test Coverage

- Throttle configuration by reason
- Effective throttle calculation
- Sync permission logic
- CORS header generation
- Request method validation

## Benefits

1. **Fast Initial Experience**: Users see data within 1-2 minutes on first visit
2. **Smart Resource Usage**: Prevents unnecessary API calls for complete data
3. **Flexible Throttling**: Adapts based on context and data state
4. **User Control**: Manual sync button with reasonable cooldown
5. **Automatic Recovery**: Auto-detection fixes missing data transparently

## Configuration

### Environment Variables
No special configuration needed - the system adapts automatically.

### Tuning Parameters

Adjust in `capture-repository-sync-graphql.ts`:

```typescript
const THROTTLE_CONFIG = {
  'manual': 0.083,    // 5 minutes
  'auto-fix': 0.25,   // 15 minutes
  'scheduled': 2,     // 2 hours
  'pr-activity': 1,   // 1 hour
  'default': 0.5      // 30 minutes
};
```

## Monitoring

Monitor these metrics:
- Time to first data display
- Sync job success rate
- Throttle bypass frequency
- Data completeness over time

## Future Improvements

1. **Repository-specific throttling**: Different limits for different repo sizes
2. **User-based limits**: Per-user rate limiting
3. **Adaptive throttling**: Learn from usage patterns
4. **Priority queuing**: Fast-track popular repositories