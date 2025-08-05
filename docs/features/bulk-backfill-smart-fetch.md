# Smart Backfill: Fetching First 200 Missing PRs (30-Day Window)

## Overview

When repositories are added through bulk-add UI, the backfill should:
1. Identify gaps in historical data within the last 30 days
2. Fetch up to 200 PRs not in database (within 30-day window)
3. Skip any PRs older than 30 days
4. Let the app's organic capture handle recent PRs

## Implementation

### 1. Smart Gap Detection

```typescript
// src/lib/inngest/functions/backfill-initial.ts
async function findDataGaps(repositoryId: string, owner: string, name: string) {
  // Get the oldest PR we have
  const { data: oldestPR } = await supabase
    .from('pull_requests')
    .select('number, created_at')
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  // Get total PR count from GitHub
  const { data: repoInfo } = await supabase
    .from('repositories')
    .select('pull_request_count')
    .eq('id', repositoryId)
    .single();

  return {
    hasData: !!oldestPR,
    oldestPRNumber: oldestPR?.number || repoInfo?.pull_request_count || 0,
    oldestPRDate: oldestPR?.created_at,
    totalPRs: repoInfo?.pull_request_count || 0
  };
}

export const backfillRepositoryInitial = inngest.createFunction(
  {
    id: "backfill-repository-initial",
    concurrency: { limit: 5, scope: "account" },
    retries: 3
  },
  { event: "repository/backfill.initial" },
  async ({ event, step }) => {
    const { repositoryId, owner, name, maxPRs = 200 } = event.data;
    
    // Calculate 30-day cutoff
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Step 1: Analyze gaps
    const gaps = await step.run("analyze-gaps", async () => {
      return await findDataGaps(repositoryId, owner, name);
    });
    
    // Step 2: Determine backfill strategy
    const strategy = await step.run("determine-strategy", async () => {
      if (!gaps.hasData) {
        // No data yet - fetch the most recent 200 PRs
        return {
          type: 'initial',
          direction: 'DESC',
          startFrom: null,
          message: 'No existing data - fetching most recent 200 PRs'
        };
      } else {
        // We have some data - fetch older PRs
        return {
          type: 'historical',
          direction: 'ASC', // Oldest first
          startFrom: gaps.oldestPRNumber - 1,
          message: `Fetching PRs older than #${gaps.oldestPRNumber}`
        };
      }
    });

    // Step 3: Fetch PRs based on strategy
    let cursor = null;
    let totalFetched = 0;
    const chunkSize = 25;
    let consecutiveEmptyChunks = 0;
    let reachedTimeLimit = false;
    
    while (totalFetched < maxPRs && consecutiveEmptyChunks < 3 && !reachedTimeLimit) {
      const prs = await step.run(`fetch-prs-${totalFetched}`, async () => {
        const client = getGraphQLClient();
        
        if (strategy.type === 'historical') {
          // For historical, we need to fetch PRs before our oldest
          return await client.getHistoricalPRs(
            owner,
            name,
            chunkSize,
            cursor,
            strategy.startFrom
          );
        } else {
          // For initial, fetch most recent
          return await client.getRepositoryPRsPage(
            owner,
            name,
            chunkSize,
            cursor,
            'DESC'
          );
        }
      });
      
      if (!prs || prs.length === 0) {
        consecutiveEmptyChunks++;
        continue;
      }
      
      consecutiveEmptyChunks = 0;
      
      // Filter PRs by 30-day window
      const prsInWindow = prs.filter(pr => {
        const prDate = new Date(pr.createdAt);
        if (prDate < thirtyDaysAgo) {
          reachedTimeLimit = true;
          return false;
        }
        return true;
      });
      
      if (prsInWindow.length === 0) {
        break; // All PRs are too old
      }
      
      // Check which PRs we already have
      const prNumbers = prsInWindow.map(pr => pr.number);
      const { data: existingPRs } = await supabase
        .from('pull_requests')
        .select('number')
        .eq('repository_id', repositoryId)
        .in('number', prNumbers);
      
      const existingNumbers = new Set(existingPRs?.map(pr => pr.number) || []);
      const newPRs = prsInWindow.filter(pr => !existingNumbers.has(pr.number));
      
      if (newPRs.length > 0) {
        // Store only new PRs
        await step.run(`store-new-prs-${totalFetched}`, async () => {
          await storePRsInDatabase(repositoryId, newPRs);
          return newPRs.length;
        });
        
        totalFetched += newPRs.length;
      }
      
      cursor = prs[prs.length - 1]?.cursor;
      
      // Update progress
      await step.run(`update-progress-${totalFetched}`, async () => {
        await inngest.send({
          name: "backfill/progress.update",
          data: {
            repositoryId,
            progress: totalFetched,
            total: maxPRs,
            status: 'processing',
            strategy: strategy.type,
            message: `${strategy.message} - ${totalFetched} new PRs found`
          }
        });
      });
      
      await step.sleep("rate-limit-pause", "2s");
    }
    
    return {
      success: true,
      repository: `${owner}/${name}`,
      strategy: strategy.type,
      newPRsFetched: totalFetched,
      message: `${strategy.message} (30-day window)`,
      reachedTimeLimit,
      cutoffDate: thirtyDaysAgo.toISOString()
    };
  }
);
```

### 2. GraphQL Query with Date Filter

```typescript
// src/lib/github/graphql-historical.ts
export async function getHistoricalPRs(
  owner: string,
  name: string,
  limit: number,
  cursor: string | null,
  beforeNumber: number
) {
  // Use search API to filter by date
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
  
  const query = `
    query($searchQuery: String!, $limit: Int!, $cursor: String) {
      search(
        query: $searchQuery,
        type: ISSUE,
        first: $limit,
        after: $cursor
      ) {
        nodes {
          ... on PullRequest {
            databaseId
            number
            title
            createdAt
            state
            merged
            cursor: id
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  
  // Build search query: repo PRs created after date, before PR number
  const searchQuery = `repo:${owner}/${name} is:pr created:>${dateFilter} sort:created-asc`;
  
  const result = await graphqlClient.request(query, { searchQuery, limit, cursor });
  const prs = result.search.nodes;
  
  return prs.filter(pr => pr.number < beforeNumber);
}
```

## 2. UI Feedback with Inngest Links

### Enhanced UI Component

```typescript
// src/components/features/debug/bulk-add-repos.tsx

import { ExternalLink, Loader2, CheckCircle2 } from "lucide-react";

interface BackfillJob {
  repoName: string;
  runId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  message?: string;
}

export function BulkAddRepos() {
  const [backfillJobs, setBackfillJobs] = useState<Record<string, BackfillJob>>({});
  
  // After triggering backfill
  const triggerBackfill = async (repositories: RepoDetail[]) => {
    // Send events and get run IDs
    const events = repositories.map(({ id, owner, name }) => ({
      name: "repository/backfill.initial",
      data: { repositoryId: id, owner, name, maxPRs: 200 },
      // Add a unique ID to track this specific invocation
      id: `backfill-${id}-${Date.now()}`
    }));
    
    // In production, Inngest returns run IDs
    const response = await inngest.send(events);
    
    // Initialize job tracking
    const jobs = Object.fromEntries(
      repositories.map((repo, idx) => [
        repo.id,
        {
          repoName: `${repo.owner}/${repo.name}`,
          runId: response.ids?.[idx], // Inngest returns run IDs
          status: 'pending' as const,
          progress: 0,
          total: 200
        }
      ])
    );
    
    setBackfillJobs(jobs);
  };
  
  // Subscribe to progress updates
  useEffect(() => {
    const channel = supabase
      .channel('backfill-progress')
      .on('broadcast', { event: 'backfill-update' }, (payload) => {
        const { repositoryId, progress, total, status, message } = payload;
        
        setBackfillJobs(prev => ({
          ...prev,
          [repositoryId]: {
            ...prev[repositoryId],
            progress,
            total,
            status,
            message
          }
        }));
      })
      .subscribe();
      
    return () => { channel.unsubscribe(); };
  }, []);
  
  return (
    <>
      {/* Existing UI... */}
      
      {/* Backfill Progress Section */}
      {Object.keys(backfillJobs).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Backfill Progress</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://app.inngest.com/env/production/runs', '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View All Runs
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(backfillJobs).map(([repoId, job]) => (
                <div key={repoId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {job.status === 'running' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      )}
                      {job.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {job.status === 'failed' && (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium text-sm">{job.repoName}</span>
                    </div>
                    
                    {job.runId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const url = `https://app.inngest.com/env/production/runs/${job.runId}`;
                          window.open(url, '_blank');
                        }}
                        className="gap-1 text-xs"
                      >
                        View Run
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Progress 
                      value={(job.progress / job.total) * 100} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{job.message || `${job.progress}/${job.total} PRs`}</span>
                      <span>{Math.round((job.progress / job.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Summary Stats */}
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Repos</p>
                  <p className="font-medium">{Object.keys(backfillJobs).length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-medium text-green-600">
                    {Object.values(backfillJobs).filter(j => j.status === 'completed').length}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">In Progress</p>
                  <p className="font-medium text-blue-600">
                    {Object.values(backfillJobs).filter(j => j.status === 'running').length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
```

### Real-time Notifications

```typescript
// src/components/features/debug/backfill-toast.tsx
export function BackfillToast({ job }: { job: BackfillJob }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className="font-medium">{job.repoName}</p>
        <p className="text-sm text-muted-foreground">
          {job.message || `Backfilling ${job.progress}/${job.total} PRs`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const url = job.runId 
            ? `https://app.inngest.com/env/production/runs/${job.runId}`
            : 'https://app.inngest.com/env/production/functions/backfill-repository-initial';
          window.open(url, '_blank');
        }}
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Show toast on status changes
useEffect(() => {
  Object.entries(backfillJobs).forEach(([id, job]) => {
    if (job.status === 'completed' && prevJobs[id]?.status === 'running') {
      toast({
        title: "Backfill Complete",
        description: <BackfillToast job={job} />,
        variant: "success"
      });
    }
  });
}, [backfillJobs]);
```

## Summary

### 1. Smart Fetching Strategy:
- **30-day window**: Only fetches PRs created in the last 30 days
- **No existing data**: Fetch most recent 200 PRs (within 30 days)
- **Has existing data**: Fetch oldest PRs we don't have (within 30 days)
- **Skip duplicates**: Only store PRs not already in database
- **Automatic cutoff**: Stops when reaching PRs older than 30 days
- **Let organic capture handle recent**: The app's existing system handles new PRs

### 2. Enhanced UI Feedback:
- **Progress bars** for each repository
- **Direct links** to Inngest run details
- **Real-time status updates** via Supabase subscriptions
- **Toast notifications** on completion
- **Bulk view link** to all Inngest runs
- **Summary statistics** showing overall progress

This ensures efficient backfilling without duplicates while providing clear visibility into the process.