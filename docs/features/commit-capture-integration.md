# Commit Capture Integration with Progressive Capture System

## Overview
This document describes the integration of commit capture into the progressive capture system, enabling automatic commit data collection with configurable time ranges and API cost caps.

## Implementation Details

### Key Components

1. **CommitProcessor** (`src/lib/progressive-capture/commit-processor.ts`)
   - Handles commit capture job processing
   - Integrates with existing `captureCommits` function
   - Manages time range configuration and API limits
   - Queues commit PR analysis after capture

2. **Configuration** (`.env.example`)
   - `VITE_COMMITS_INITIAL_DAYS=7` - Days to capture on first run
   - `VITE_COMMITS_UPDATE_DAYS=1` - Days for incremental updates
   - `VITE_COMMITS_MAX_PER_RUN=1000` - Max commits per capture run
   - `VITE_GITHUB_COMMITS_BATCH_SIZE=100` - Batch size per API call
   - `VITE_GITHUB_COMMITS_MAX_PAGES=10` - Maximum API pages to fetch

3. **Database Schema** (`supabase/migrations/20250928_add_commit_capture_tracking.sql`)
   - Added `last_commit_capture_at` column for tracking
   - Added `commit_capture_status` column for status
   - Created index for efficient querying

4. **Event Types** (`src/lib/inngest/types/event-data.ts`)
   - Added `CommitCaptureEventData` interface
   - Updated mapping function to handle commit events

5. **Repository Tracking** (`netlify/functions/api-track-repository.mts`)
   - Added automatic commit capture when repository is tracked
   - Initial capture for new repositories (7 days)
   - Incremental updates for existing repositories (1 day)

### How It Works

1. **When Repository is Tracked**:
   - New repositories trigger initial capture (7 days of commits)
   - Existing repositories trigger incremental update (1 day)
   - Events are sent through Inngest for processing

2. **Progressive Capture Integration**:
   - Commits are captured using same patterns as PRs, reviews, and comments
   - Smart scheduling based on repository status
   - Configurable time ranges prevent excessive API usage
   - Automatic queuing of commit PR analysis after capture

3. **Cost Management**:
   - Initial capture limited to 7 days (configurable)
   - Daily updates capture only last 24 hours
   - Maximum 1,000 commits per run
   - Max 10 API pages per capture session

4. **Hybrid Queue Routing**:
   - Recent commits (<24 hours) → Inngest for real-time processing
   - Historical commits → GitHub Actions for bulk processing
   - Smart routing based on data volume and age

### API Cost Implications

- **Initial Repository**: ~5-10 API calls (7 days of commits)
- **Daily Updates**: 1-2 API calls (last 24 hours)
- **Per Repository Per Week**: ~10-15 API calls total

### Monitoring

The system provides monitoring through:
- Data gap analysis showing repositories needing commit capture
- Queue status tracking for commit jobs
- Processing notifications for user feedback
- Telemetry for API usage tracking

### Usage

#### Manual Trigger (Development)
```javascript
// In browser console
ProgressiveCapture.analyze() // Check data gaps
ProgressiveCapture.bootstrap() // Queue missing data including commits
```

#### Automatic Trigger
- Commits are automatically captured when:
  - A new repository is tracked
  - Daily incremental updates run
  - Bootstrap process detects stale commit data

### Testing Checklist

- [x] TypeScript compilation passes
- [x] Database migration applied
- [x] Environment variables configured
- [x] Integration with existing progressive capture system
- [ ] Test new repository tracking (should capture 7 days)
- [ ] Test existing repository re-tracking (should capture 1 day)
- [ ] Verify commit PR analysis queuing
- [ ] Monitor API usage stays within limits

### Next Steps

1. Deploy to staging environment
2. Monitor API usage patterns
3. Adjust time ranges based on actual usage
4. Consider adding workspace-level commit capture scheduling
5. Implement commit analysis for YOLO coder detection