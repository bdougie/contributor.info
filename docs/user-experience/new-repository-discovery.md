# New Repository Discovery - User Experience Guide

## Overview

This guide explains how contributor.info handles new or unknown repositories when users search for or visit them. The system is designed to provide an invisible, Netflix-like experience where repository setup happens automatically without requiring user intervention.

## The User Journey

### 1. User Discovers New Repository

**What the user does:**
- Visits a repository page directly (e.g., `/pytorch/pytorch`)
- Searches for a repository that isn't yet tracked
- Follows a link to an unknown repository

**What the user sees immediately:**
- Page loads instantly with basic layout
- Empty state or skeleton content while system detects the repository
- No loading spinners or blank pages

### 2. Automatic Repository Detection

**Behind the scenes (invisible to user):**
```typescript
// useTrackRepositoryWithNotification hook runs automatically
const { isNewRepository, isTracking, hasData } = useTrackRepositoryWithNotification({
  owner: 'pytorch',
  repo: 'pytorch',
  enabled: true
});
```

**What happens:**
1. System checks if repository exists in database
2. If not found, automatically recognizes this as a new repository
3. Hook manages the entire setup process invisibly

### 3. User-Friendly Setup Notification

**What the user sees:**
```
🔄 Setting up pytorch/pytorch...
This is a new repository! We're gathering contributor data for you. 
This usually takes 1-2 minutes.

[Learn More] [Dismiss]
```

**Key messaging principles:**
- **Positive framing:** "Setting up" (not "missing data")
- **Clear timeline:** "1-2 minutes" sets expectations
- **Educational option:** "Learn More" for interested users
- **Non-blocking:** User can continue browsing

### 4. Background Repository Setup

**What happens automatically:**
1. Repository added to tracking database
2. Size classification job queued
3. Initial data collection job queued with high priority
4. Processing notification shown to user

**Processing notification:**
```
⚡ Getting familiar with pytorch/pytorch...
We're fetching the latest data. Check back in a minute!
```

### 5. Completion and Next Steps

**When data collection completes:**
```
✅ Repository data updated!
Fresh data is now available

[Refresh] [View]
```

**User experience:**
- Clear completion notification with action button
- Single click to see fresh data
- No technical details about what was processed

## Technical Implementation

### Hook: useTrackRepositoryWithNotification

**Purpose:** Automatically detect and set up new repositories

**Key features:**
- Runs once per repository page load
- Prevents duplicate setup attempts
- Handles all error scenarios gracefully
- Shows appropriate notifications for each state

**Usage pattern:**
```typescript
// In any repository component
function RepositoryPage({ owner, repo }) {
  const trackingState = useTrackRepositoryWithNotification({
    owner,
    repo,
    enabled: true // Automatically enabled for all repository pages
  });

  // Component renders immediately, setup happens in background
  return <RepositoryContent trackingState={trackingState} />;
}
```

### Database Operations

**Repository Discovery Flow:**
1. **Check repositories table:**
   ```sql
   SELECT id FROM repositories 
   WHERE owner = $1 AND name = $2
   ```

2. **If not found, check tracking table:**
   ```sql
   SELECT id FROM tracked_repositories 
   WHERE organization_name = $1 AND repository_name = $2
   ```

3. **If not tracked, add to tracking:**
   ```sql
   INSERT INTO tracked_repositories (
     organization_name, repository_name, 
     tracking_enabled, priority, created_at
   ) VALUES ($1, $2, true, 'medium', NOW())
   ```

### Background Job Orchestration

**Comprehensive Setup Process:**
```typescript
// Two parallel jobs for complete setup
await Promise.all([
  // 1. Classify repository size for optimal processing
  inngest.send({
    name: 'classify/repository.single',
    data: {
      repositoryId: newRepo.id,
      owner: 'pytorch',
      repo: 'pytorch'
    }
  }),
  
  // 2. Begin initial data collection
  inngest.send({
    name: 'capture/repository.sync',
    data: {
      owner: 'pytorch',
      repo: 'pytorch',
      priority: 'high', // User-initiated gets high priority
      source: 'user-search'
    }
  })
]);
```

## Notification Strategy

### New Repository Setup Notification

**Design principles:**
- **Informative:** Explains what's happening
- **Reassuring:** Sets clear timeline expectations  
- **Educational:** Optional "Learn More" action
- **Non-intrusive:** 8-second duration, dismissible

**Implementation:**
```typescript
toast.info(`Setting up ${owner}/${repo}...`, {
  description: "This is a new repository! We're gathering contributor data for you. This usually takes 1-2 minutes.",
  duration: 8000,
  action: {
    label: 'Learn More',
    onClick: () => {
      toast.info('How it works', {
        description: 'We analyze pull requests, reviews, and contributions to show you insights about this repository.',
        duration: 6000
      })
    }
  }
});
```

### Processing Progress Notification

**Purpose:** Keep user informed during data collection

**Implementation:**
```typescript
ProgressiveCaptureNotifications.showProcessingStarted(
  `${owner}/${repo}`,
  'inngest',
  60000 // 1 minute estimate
);
```

**User sees:**
```
⚡ Getting familiar with pytorch/pytorch...
We're fetching the latest data. Check back in a minute!
```

### Completion Notification

**Purpose:** Inform user when data is ready

**User sees:**
```
✅ Repository data updated!
Fresh data is now available

[Refresh]
```

**Implementation:**
```typescript
toast.success('Repository data updated!', {
  description: 'Fresh data is now available',
  duration: 6000,
  action: {
    label: 'Refresh',
    onClick: () => window.location.reload()
  }
});
```

## Error Handling

### Repository Setup Failures

**If database insert fails:**
```typescript
toast.error('Failed to set up repository', {
  description: 'Please try refreshing the page.',
  duration: 6000
});
```

**Key principles:**
- Clear problem statement
- Actionable solution ("refresh the page")
- No technical error details exposed
- Reasonable timeout for user action

### Background Job Failures

**If Inngest jobs fail:**
- Error logged for debugging but not shown to user
- Hook continues functioning normally
- Repository remains in tracking table for retry
- User experience is not interrupted

**Graceful degradation:**
```typescript
try {
  await inngest.send(/* job data */);
  ProgressiveCaptureNotifications.showProcessingStarted(/* ... */);
} catch (error) {
  console.error('Failed to trigger repository sync:', error);
  // User experience continues - no notification about this failure
}
```

## Data State Communication

### DataStateIndicator for New Repositories

**Pending State:**
- Blue spinning loader icon  
- Title: "Getting familiar with repository..."
- Message: "We're fetching the latest data. Check back in a minute!"

**Implementation:**
```typescript
<DataStateIndicator
  status="pending"
  message="This repository is being set up. Data will be available in 1-2 minutes."
  onRefresh={handleRefresh}
/>
```

**Visual design:**
- Blue theme indicates active processing
- Animated spinner shows ongoing work
- Clear messaging about timeline
- Optional refresh button when user wants to check progress

## Performance Considerations

### Immediate Page Load
- Repository pages render instantly regardless of tracking status  
- No blocking API calls during initial page render
- Progressive enhancement as data becomes available
- Skeleton content while detection runs

### Efficient Database Queries
- Single queries to check repository status
- Minimal database operations for setup
- Indexed lookups for fast response times
- Batch operations where possible

### Background Processing Priority
- User-initiated repositories get high priority in job queue
- Classification happens in parallel with data collection
- Smart retry logic for failed jobs
- Rate limit awareness for API calls

## Testing New Repository Flow

### Manual Testing Checklist

1. **Visit unknown repository page:**
   - [ ] Page loads instantly
   - [ ] Setup notification appears within 3-4 seconds
   - [ ] Notification is user-friendly and informative

2. **Wait for processing:**
   - [ ] Processing notification appears
   - [ ] No console errors
   - [ ] Page remains usable during setup

3. **Check completion:**
   - [ ] Completion notification appears when ready
   - [ ] Refresh button works correctly
   - [ ] Data appears after refresh

### Automated Testing

**Repository detection test:**
```typescript
describe('New Repository Discovery', () => {
  it('should automatically set up new repository', async () => {
    render(<RepositoryPage owner="new" repo="repository" />);
    
    // Should show setup notification
    await waitFor(() => {
      expect(screen.getByText(/setting up new\/repository/i)).toBeInTheDocument();
    });
    
    // Should show processing notification
    await waitFor(() => {
      expect(screen.getByText(/getting familiar with/i)).toBeInTheDocument();
    });
  });
});
```

## Analytics and Monitoring

### Key Metrics

**User Experience Metrics:**
- Time from page load to setup notification
- Setup completion rate (successful vs failed)
- User interaction with "Learn More" action
- Refresh button click-through rate

**Technical Metrics:**
- Repository detection accuracy
- Database insert success rate
- Background job queue time
- Data collection completion time

**Success Indicators:**
- High setup completion rate (>90%)
- Fast notification display (<4 seconds)
- Low user confusion (measured via support tickets)
- High user satisfaction with automatic setup

## Best Practices

### For Developers

**When implementing repository features:**
1. Always include `useTrackRepositoryWithNotification` hook
2. Handle all tracking states (new, tracking, has data)
3. Show appropriate DataStateIndicator components
4. Never block UI while repository setup happens

**Testing considerations:**
1. Test with truly unknown repositories
2. Verify notification content and timing
3. Check error handling scenarios
4. Ensure mobile experience works well

### For Content/UX

**Notification writing:**
1. Use positive, active language ("Setting up" not "Loading")
2. Set clear time expectations
3. Avoid technical jargon
4. Provide optional educational content
5. Make actions clear and beneficial

**Visual design:**
1. Use color coding consistently across states
2. Ensure notifications don't obstruct content
3. Make progress indicators meaningful
4. Keep animations subtle and purposeful

## Future Enhancements

### Planned Improvements

**Predictive Repository Setup:**
- Analyze user browsing patterns
- Pre-setup repositories they're likely to visit
- Reduce "new repository" scenarios

**Enhanced Progress Tracking:**
- Real-time progress updates during data collection
- Detailed breakdown of what's being processed
- Estimated completion times based on repository size

**Smart Notification Timing:**
- Learn optimal notification timing per user
- Reduce notification fatigue
- Context-aware messaging

**Improved Error Recovery:**
- Automatic retry for failed setups
- Better error categorization and messaging
- Self-healing for common issues

### Advanced Features

**Repository Recommendations:**
- Suggest related repositories during setup
- Show similar repositories with existing data
- Guide users to well-populated repositories

**Collaborative Setup:**
- Allow team members to request repository additions
- Share setup status across team members
- Coordinate data collection for organization repositories

The new repository discovery system transforms a potentially frustrating experience (searching for unknown data) into a delightful one where the system anticipates user needs and handles complexity invisibly. Users get immediate value while the system works behind the scenes to provide comprehensive data.