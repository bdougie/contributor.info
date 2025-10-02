# Admin Dashboard & Monitoring Implementation

## Overview
Admin tooling and monitoring for the priority queue system. This allows administrators to monitor job health, view failures, and make informed decisions about rollout percentages.

## Goals
1. **Visibility**: Show failed jobs with detailed error information
2. **Actionability**: Allow admins to retry failed jobs
3. **Learning**: Track patterns in job failures to improve the system

## Components

### 1. Failed Jobs Dashboard (`/admin/failed-jobs`)

**Features:**
- List of all failed jobs from `progressive_capture_jobs` table
- Filter by:
  - Job type (capture/pr.reviews, capture/pr.comments, etc.)
  - Date range
  - Repository
  - Processor type (inngest vs github_actions)
- Display:
  - Job ID
  - Type
  - Error message
  - Repository name
  - Failed timestamp
  - Retry count
  - Processor type

**Actions:**
- View job details (payload, error stack)
- Retry individual job (if retry_count < max_retries)
- Bulk retry failed jobs

### 2. Priority Queue Monitoring

**Metrics to Track:**
- Total jobs processed (last 24h, 7d, 30d)
- Success rate by processor type
- Average processing time by processor type
- Failed jobs by repository
- Most common error types

### 3. Rollout Configuration

**Admin Controls:**
- Set rollout percentage for Supabase processing (10%, 25%, 50%, 100%)
- Enable/disable Supabase processing entirely
- Whitelist specific repositories for Supabase processing
- Blacklist repositories that consistently fail

## Database Schema

```sql
-- Already exists in background_jobs table:
- id: uuid
- type: text (job type)
- status: text ('queued', 'processing', 'completed', 'failed', 'cancelled')
- error: text (error message)
- repository_id: uuid
- retry_count: integer
- max_retries: integer
- failed_at: timestamp
- payload: jsonb (job data)

-- New table for rollout configuration:
CREATE TABLE inngest_rollout_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_rollout_percentage integer DEFAULT 10,
  supabase_enabled boolean DEFAULT false,
  whitelist_repositories uuid[] DEFAULT '{}',
  blacklist_repositories uuid[] DEFAULT '{}',
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES app_users(id)
);
```

## Implementation Steps

### Step 1: Create Failed Jobs Page Component
- [x] Create `src/components/features/admin/failed-jobs-dashboard.tsx`
- [x] Query `progressive_capture_jobs` WHERE status = 'failed'
- [x] Display in data table with filters
- [ ] Add retry action buttons

### Step 2: Add to Admin Menu
- [ ] Add menu item in `admin-menu.tsx`
- [ ] Icon: `AlertTriangle`
- [ ] Badge: Show count of failed jobs in last 24h

### Step 3: Create Rollout Configuration UI
- [ ] Admin page for rollout settings
- [ ] Slider for percentage (10%, 25%, 50%, 100%)
- [ ] Toggle for enable/disable
- [ ] Repository whitelist/blacklist management

### Step 4: Add Monitoring Dashboard
- [ ] Success rate charts
- [ ] Processing time comparison (Inngest vs GitHub Actions)
- [ ] Error type breakdown
- [ ] Repository failure heatmap

## Success Metrics

- Admin can see all failed jobs
- Admin can understand why jobs failed
- Admin can retry failed jobs
- Admin can adjust rollout percentage based on failure rates

## Future Enhancements

- **Auto-retry logic**: Automatically retry failed jobs with exponential backoff
- **Alert system**: Notify admins when failure rate exceeds threshold
- **Job health scores**: Score repositories based on job success rates
- **Predictive routing**: Route jobs based on historical success patterns
