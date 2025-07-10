# Feature Implementation Template

Use this template when implementing any new feature that involves data loading, background processing, or user interactions.

## Feature Planning Template

### Feature Name: `[Your Feature Name]`

#### User Value Proposition
**What value does this provide to users?**
- [ ] Immediate benefit: _[What users get right away]_
- [ ] Progressive enhancement: _[How it gets better over time]_
- [ ] User problem solved: _[What frustration this eliminates]_

**User Journey**:
1. User visits/interacts with: _[trigger point]_
2. They immediately see: _[instant value]_
3. In the background: _[automatic improvements]_
4. When complete: _[enhanced experience]_

#### Technical Architecture
- [ ] **Data Source**: Database-first with API fallback
- [ ] **Auto-Detection**: Triggers when _[condition]_
- [ ] **Background Processing**: Handles _[heavy operations]_
- [ ] **User Notifications**: _[when/what to show]_

#### UX Requirements
- [ ] **No manual user actions** required for basic functionality
- [ ] **Immediate rendering** with cached/skeleton data
- [ ] **Subtle notifications** that don't interrupt workflow
- [ ] **Graceful degradation** when services unavailable

## Implementation Template

### 1. Component Structure

```typescript
import { useState, useEffect } from 'react';
import { SmartDataNotifications } from '@/lib/progressive-capture/smart-notifications';
import { toast } from 'sonner';

interface FeatureProps {
  // Define your props
}

export function YourFeatureComponent({ /* props */ }: FeatureProps) {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
    
    // Auto-detection for data quality improvement
    if (shouldAutoDetect) {
      SmartDataNotifications.checkRepositoryAndNotify(owner, repo);
    }
  }, [/* dependencies */]);

  const loadInitialData = async () => {
    try {
      // 1. Always try database/cache first
      const cachedData = await fetchFromDatabase();
      
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
      } else {
        // 2. Fallback to API if needed
        const freshData = await fetchFromAPI();
        setData(freshData);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      
      // 3. Graceful degradation
      setData(getDefaultData());
    }
  };

  // Loading state with skeleton
  if (loading) {
    return <YourFeatureSkeleton />;
  }

  // Error state with fallback
  if (error && !data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Unable to load data right now</p>
        <p className="text-sm">Using cached information instead</p>
      </div>
    );
  }

  return (
    <div>
      {/* Your feature UI */}
      {data && <YourFeatureContent data={data} />}
    </div>
  );
}
```

### 2. Data Loading Pattern

```typescript
// data-loader.ts
export async function loadFeatureData(params: LoadParams): Promise<DataResult<FeatureData>> {
  try {
    // 1. Database first (fast, no rate limits)
    const cached = await queryDatabase(params);
    if (isDataFresh(cached)) {
      return createSuccessResult(cached);
    }

    // 2. API fallback (when needed)
    const fresh = await fetchFromAPI(params);
    
    // 3. Store for future use
    await storeInDatabase(fresh);
    
    return createSuccessResult(fresh);
    
  } catch (error) {
    // 4. Error handling with graceful degradation
    if (isRateLimited(error)) {
      const staleData = await queryDatabase(params, { allowStale: true });
      return createPartialResult(staleData, 'Using cached data due to rate limits');
    }
    
    return createErrorResult(error.message, getDefaultData());
  }
}
```

### 3. Auto-Detection Integration

```typescript
// smart-detection.ts
export class FeatureSmartDetection {
  static async checkAndImprove(params: CheckParams): Promise<void> {
    const issues = await this.detectIssues(params);
    
    if (issues.length > 0) {
      // Show subtle notification
      toast.info(`Updating ${params.resourceName}...`, {
        description: 'Loading fresh data in the background',
        duration: 4000
      });
      
      // Fix issues in background
      await this.autoFix(issues);
      
      // Show completion
      toast.success('Data updated!', {
        description: 'Fresh information is now available',
        duration: 6000,
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        }
      });
    }
  }

  private static async detectIssues(params: CheckParams): Promise<Issue[]> {
    // Implement your issue detection logic
    return [];
  }

  private static async autoFix(issues: Issue[]): Promise<void> {
    // Queue background jobs to fix issues
    for (const issue of issues) {
      await queueFixJob(issue);
    }
  }
}
```

### 4. Background Processing

```typescript
// background-processor.ts
export class FeatureBackgroundProcessor {
  static async processJob(job: FeatureJob): Promise<ProcessResult> {
    try {
      console.log(`Processing ${job.type} for ${job.resourceId}`);
      
      const result = await this.executeJob(job);
      
      if (result.success) {
        await this.markJobComplete(job.id);
        
        // Notify relevant components
        this.notifyCompletion(job.resourceId, job.type);
        
        return { success: true };
      } else {
        await this.markJobFailed(job.id, result.error);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error(`Job ${job.type} failed:`, error);
      await this.markJobFailed(job.id, error.message);
      return { success: false, error: error.message };
    }
  }

  private static notifyCompletion(resourceId: string, jobType: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('feature-data-updated', {
        detail: { resourceId, jobType }
      }));
    }
  }
}
```

## Testing Template

### Unit Tests

```typescript
// feature.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { YourFeatureComponent } from './your-feature';

describe('YourFeatureComponent', () => {
  it('should show cached data immediately', async () => {
    mockCachedData({ /* test data */ });
    
    render(<YourFeatureComponent />);
    
    // Should show data without waiting
    expect(screen.getByTestId('feature-content')).toBeInTheDocument();
  });

  it('should show loading skeleton while fetching', () => {
    mockSlowDataFetch();
    
    render(<YourFeatureComponent />);
    
    expect(screen.getByTestId('feature-skeleton')).toBeInTheDocument();
  });

  it('should handle errors gracefully', async () => {
    mockDataFetchError();
    
    render(<YourFeatureComponent />);
    
    await waitFor(() => {
      expect(screen.getByText(/unable to load data/i)).toBeInTheDocument();
    });
  });

  it('should trigger auto-detection for data improvement', async () => {
    const mockAutoDetect = jest.fn();
    mockSmartDetection(mockAutoDetect);
    
    render(<YourFeatureComponent owner="test" repo="repo" />);
    
    await waitFor(() => {
      expect(mockAutoDetect).toHaveBeenCalledWith('test', 'repo');
    });
  });
});
```

### Integration Tests

```typescript
// feature-integration.test.tsx
describe('Feature Integration', () => {
  it('should complete full auto-improvement cycle', async () => {
    // 1. Render with stale data
    mockStaleData();
    render(<YourFeatureComponent />);
    
    // 2. Should show updating notification
    await waitFor(() => {
      expect(screen.getByText(/updating/i)).toBeInTheDocument();
    });
    
    // 3. Should show completion notification
    mockDataUpdateComplete();
    await waitFor(() => {
      expect(screen.getByText(/data updated/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });
  });
});
```

## Code Review Checklist

When reviewing your feature implementation:

### User Experience
- [ ] Component renders immediately with cached/skeleton data
- [ ] Auto-detection triggers appropriately
- [ ] Notifications are subtle and helpful
- [ ] Error states provide graceful fallbacks
- [ ] No manual user actions required for basic functionality

### Technical Implementation
- [ ] Database-first queries implemented
- [ ] Proper error handling and fallbacks
- [ ] Background processing for heavy operations
- [ ] Development vs production behavior differences
- [ ] Tests cover happy path, error cases, and auto-detection

### Performance
- [ ] Initial render is fast (< 100ms)
- [ ] Background operations don't block UI
- [ ] Appropriate loading states and skeletons
- [ ] Memory leaks prevented (cleanup in useEffect)

## Documentation Template

### Feature Documentation

```markdown
# [Feature Name]

## What it does
[Brief description of user-facing functionality]

## How it works
1. **Immediate display**: Shows cached data instantly
2. **Auto-detection**: Checks for data quality issues in background
3. **Progressive enhancement**: Improves data quality automatically
4. **User notification**: Subtle updates when fresh data is available

## User experience
- User visits [trigger location]
- Sees [immediate value] right away
- If data needs updating: sees "Updating..." notification
- When complete: sees "Data updated!" with refresh option

## Technical details
- **Data source**: [Database tables/API endpoints]
- **Auto-detection**: [When and how it triggers]
- **Background jobs**: [What gets processed automatically]
- **Fallbacks**: [What happens when services fail]

## Development notes
- Located in: `src/components/features/[feature-name]/`
- Tests in: `src/components/features/[feature-name]/__tests__/`
- Background processing: `src/lib/progressive-capture/[feature-name]-processor.ts`
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Background job processing enabled
- [ ] Database migrations applied
- [ ] Error monitoring configured
- [ ] Performance metrics baseline established
- [ ] User acceptance testing completed

## Success Metrics

Define how you'll measure if the feature is working well:

### User Experience Metrics
- **Time to Value**: How quickly users see useful information
- **User Satisfaction**: Feedback about automatic behavior
- **Support Tickets**: Related to confusion or issues

### Technical Metrics
- **Cache Hit Rate**: Percentage of requests served from database
- **Background Job Success**: Percentage of auto-improvements completing
- **Error Rate**: How often graceful fallbacks are needed

### Business Metrics
- **Feature Adoption**: Usage without explicit instruction
- **User Retention**: Users returning because feature "just works"
- **Performance Impact**: Page load times and user engagement

Remember: The goal is to create features that work so smoothly, users don't think about the technical complexity behind them.