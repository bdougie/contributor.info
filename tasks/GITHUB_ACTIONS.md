# GitHub Actions Implementation Plan

## Executive Summary

This document outlines the implementation of a GitHub Actions-based progressive data capture system to replace the current Inngest-based approach. Following the pattern established by the hearts/jobs repository, this solution uses GitHub Actions workflows as the job execution engine, providing a serverless, cost-effective approach to data processing.

## Background & Current State

### Current Implementation (Inngest-based)
The application currently uses Inngest for queue management:

```
Frontend Trigger → Inngest Queue → Inngest Workers → GitHub API → Database
```

**Current Problems:**
1. **External Service Dependency**: Relies on Inngest availability
2. **Limited Visibility**: Debugging requires Inngest dashboard access
3. **Cost Scaling**: Inngest pricing increases with usage
4. **Rate Limiting**: Less control over GitHub API rate limit handling
5. **Complex Local Development**: Requires Inngest dev server

### Why GitHub Actions?

GitHub Actions offers unique advantages:
1. **Native GitHub Integration**: Direct access to GitHub's infrastructure
2. **Free Tier**: 2,000 minutes/month for public repos, 3,000 for Pro
3. **Built-in Secrets Management**: Secure credential handling
4. **Excellent Observability**: Native UI for job monitoring
5. **Proven Pattern**: Successfully used in hearts/jobs repository

## Architecture Overview

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │     │  GitHub Actions  │     │                 │
│   Trigger       │────▶│  Workflow        │────▶│    Supabase     │
│                 │     │  Dispatch API    │     │    Database     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  GitHub Actions  │
                        │  Runner          │
                        │  - Node.js       │
                        │  - CLI Scripts   │
                        └──────────────────┘
```

### Workflow Execution Flow

1. **User triggers capture** in frontend
2. **Frontend calls GitHub API** to dispatch workflow
3. **GitHub Actions runs workflow** with specified inputs
4. **Workflow executes CLI script** to fetch data
5. **Script stores results** in Supabase
6. **Frontend polls** for completion status

## Implementation Plan

### Phase 1: Repository and Script Setup

#### 1.1 Create Jobs Repository
Create new repository: `contributor-info/progressive-capture-jobs`

```
/progressive-capture-jobs/
├── .github/
│   └── workflows/
│       ├── capture-pr-details.yml
│       ├── capture-pr-reviews.yml
│       ├── capture-pr-comments.yml
│       ├── capture-repository-sync.yml
│       ├── capture-commit-analysis.yml
│       └── bulk-capture.yml
├── README.md
└── .gitignore
```

#### 1.2 Create CLI Scripts in Main Repository
Add scripts to the main contributor.info repository:

```
/scripts/progressive-capture/
├── capture-pr-details.js
├── capture-pr-reviews.js
├── capture-pr-comments.js
├── capture-repository-sync.js
├── capture-commit-analysis.js
├── lib/
│   ├── github-client.js
│   ├── rate-limiter.js
│   ├── supabase-client.js
│   └── progress-tracker.js
└── package.json
```

### Phase 2: GitHub Actions Workflows

#### 2.1 PR Details Capture Workflow
```yaml
# .github/workflows/capture-pr-details.yml
name: Capture PR Details

on:
  workflow_dispatch:
    inputs:
      repository_id:
        description: 'Supabase repository ID'
        required: true
        type: string
      repository_name:
        description: 'Repository name (owner/repo)'
        required: true
        type: string
      pr_numbers:
        description: 'Comma-separated PR numbers to capture'
        required: true
        type: string
      time_range:
        description: 'Time range in days (for sync mode)'
        required: false
        type: string
        default: '30'

jobs:
  capture-pr-details:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      # Create GitHub App token for API access
      - name: Generate token
        id: generate_token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.CONTRIBUTOR_APP_ID }}
          private-key: ${{ secrets.CONTRIBUTOR_APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}
          
      # Checkout main repository with scripts
      - name: Checkout contributor.info
        uses: actions/checkout@v4
        with:
          repository: contributor-info/contributor.info
          ref: main
          token: ${{ steps.generate_token.outputs.token }}
          
      # Setup Node.js environment
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: scripts/progressive-capture/package-lock.json
          
      # Install dependencies
      - name: Install dependencies
        run: |
          cd scripts/progressive-capture
          npm ci
          
      # Run capture script
      - name: Capture PR Details
        run: |
          cd scripts/progressive-capture
          node capture-pr-details.js
        env:
          GITHUB_TOKEN: ${{ steps.generate_token.outputs.token }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          REPOSITORY_ID: ${{ inputs.repository_id }}
          REPOSITORY_NAME: ${{ inputs.repository_name }}
          PR_NUMBERS: ${{ inputs.pr_numbers }}
          TIME_RANGE: ${{ inputs.time_range }}
          JOB_ID: ${{ github.run_id }}-${{ github.run_number }}
          
      # Upload logs as artifact for debugging
      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: capture-logs-${{ github.run_id }}
          path: scripts/progressive-capture/logs/
          retention-days: 7
```

#### 2.2 Bulk Capture Workflow (Orchestrator)
```yaml
# .github/workflows/bulk-capture.yml
name: Bulk Progressive Capture

on:
  workflow_dispatch:
    inputs:
      repository_id:
        description: 'Supabase repository ID'
        required: true
        type: string
      repository_name:
        description: 'Repository name (owner/repo)'
        required: true
        type: string
      capture_types:
        description: 'Types to capture (comma-separated: pr-details,reviews,comments,commits)'
        required: false
        type: string
        default: 'pr-details,reviews,comments'
      max_items:
        description: 'Maximum items to process'
        required: false
        type: string
        default: '100'

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      pr_numbers: ${{ steps.get_prs.outputs.pr_numbers }}
      capture_matrix: ${{ steps.build_matrix.outputs.matrix }}
    
    steps:
      - name: Generate token
        id: generate_token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.CONTRIBUTOR_APP_ID }}
          private-key: ${{ secrets.CONTRIBUTOR_APP_PRIVATE_KEY }}
          
      - name: Get PRs to process
        id: get_prs
        run: |
          # Query Supabase for PRs needing data
          # This would be a script that queries the database
          echo "pr_numbers=123,456,789" >> $GITHUB_OUTPUT
          
      - name: Build capture matrix
        id: build_matrix
        run: |
          # Build matrix for parallel processing
          echo 'matrix={"include":[{"type":"pr-details"},{"type":"reviews"},{"type":"comments"}]}' >> $GITHUB_OUTPUT

  capture:
    needs: prepare
    strategy:
      matrix: ${{ fromJson(needs.prepare.outputs.capture_matrix) }}
      max-parallel: 3
    
    uses: ./.github/workflows/capture-${{ matrix.type }}.yml
    with:
      repository_id: ${{ inputs.repository_id }}
      repository_name: ${{ inputs.repository_name }}
      pr_numbers: ${{ needs.prepare.outputs.pr_numbers }}
    secrets: inherit
```

### Phase 3: CLI Scripts Implementation

#### 3.1 Base Script Structure
```javascript
// scripts/progressive-capture/lib/base-capture.js
import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { RateLimiter } from './rate-limiter.js';
import { ProgressTracker } from './progress-tracker.js';

export class BaseCaptureScript {
  constructor(options) {
    this.repositoryId = options.repositoryId;
    this.repositoryName = options.repositoryName;
    this.jobId = options.jobId;
    
    // Initialize clients
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.rateLimiter = new RateLimiter(this.octokit);
    this.progressTracker = new ProgressTracker(this.supabase, this.jobId);
  }

  async run() {
    try {
      await this.progressTracker.start(this.getTotalItems());
      
      const items = await this.getItemsToProcess();
      console.log(`Processing ${items.length} items...`);
      
      for (const item of items) {
        try {
          await this.rateLimiter.checkAndWait();
          await this.processItem(item);
          await this.progressTracker.increment();
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          await this.progressTracker.recordError(item.id, error);
        }
      }
      
      await this.progressTracker.complete();
      
    } catch (error) {
      await this.progressTracker.fail(error);
      throw error;
    }
  }

  // Override in subclasses
  async getItemsToProcess() {
    throw new Error('getItemsToProcess must be implemented');
  }

  async processItem(item) {
    throw new Error('processItem must be implemented');
  }

  getTotalItems() {
    return 0;
  }
}
```

#### 3.2 PR Details Capture Script
```javascript
// scripts/progressive-capture/capture-pr-details.js
import { BaseCaptureScript } from './lib/base-capture.js';

class PRDetailsCaptureScript extends BaseCaptureScript {
  constructor() {
    super({
      repositoryId: process.env.REPOSITORY_ID,
      repositoryName: process.env.REPOSITORY_NAME,
      jobId: process.env.JOB_ID
    });
    
    this.prNumbers = process.env.PR_NUMBERS?.split(',').map(n => parseInt(n)) || [];
    this.timeRange = parseInt(process.env.TIME_RANGE || '30');
  }

  async getItemsToProcess() {
    if (this.prNumbers.length > 0) {
      // Specific PRs requested
      return this.prNumbers.map(number => ({ number }));
    }
    
    // Get recent PRs from database that need details
    const since = new Date();
    since.setDate(since.getDate() - this.timeRange);
    
    const { data: prs } = await this.supabase
      .from('pull_requests')
      .select('number')
      .eq('repository_id', this.repositoryId)
      .gt('created_at', since.toISOString())
      .is('additions', null) // Missing file change data
      .order('created_at', { ascending: false })
      .limit(100);
    
    return prs || [];
  }

  async processItem(pr) {
    const [owner, repo] = this.repositoryName.split('/');
    
    // Fetch PR details from GitHub
    const { data: prData } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pr.number
    });
    
    // Fetch file changes
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100
    });
    
    // Update database
    await this.supabase
      .from('pull_requests')
      .upsert({
        repository_id: this.repositoryId,
        number: prData.number,
        title: prData.title,
        state: prData.state,
        additions: prData.additions,
        deletions: prData.deletions,
        changed_files: prData.changed_files,
        commits: prData.commits,
        author_id: prData.user.id,
        created_at: prData.created_at,
        updated_at: prData.updated_at,
        merged_at: prData.merged_at,
        file_changes: files.map(f => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          status: f.status
        }))
      })
      .eq('number', pr.number)
      .eq('repository_id', this.repositoryId);
    
    console.log(`✓ Captured details for PR #${pr.number}`);
  }

  getTotalItems() {
    return this.prNumbers.length || 100; // Estimate for progress tracking
  }
}

// Run the script
const script = new PRDetailsCaptureScript();
script.run().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
```

### Phase 4: Frontend Integration

#### 4.1 GitHub Actions Client
```typescript
// src/lib/progressive-capture/github-actions-client.ts
import { Octokit } from '@octokit/rest';

export interface WorkflowDispatchOptions {
  workflow: string;
  inputs: Record<string, string>;
}

export class GitHubActionsClient {
  private octokit: Octokit;
  private owner = 'contributor-info';
  private repo = 'progressive-capture-jobs';

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.VITE_GITHUB_TOKEN
    });
  }

  async dispatchWorkflow(options: WorkflowDispatchOptions) {
    try {
      const response = await this.octokit.actions.createWorkflowDispatch({
        owner: this.owner,
        repo: this.repo,
        workflow_id: options.workflow,
        ref: 'main',
        inputs: options.inputs
      });

      return {
        success: true,
        message: 'Workflow dispatched successfully'
      };
    } catch (error) {
      console.error('Failed to dispatch workflow:', error);
      throw error;
    }
  }

  async getWorkflowRuns(repositoryId: string) {
    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({
      owner: this.owner,
      repo: this.repo,
      per_page: 10
    });

    // Filter runs for this repository
    return data.workflow_runs.filter(run => 
      run.name?.includes(repositoryId)
    );
  }

  async getWorkflowStatus(runId: number) {
    const { data } = await this.octokit.actions.getWorkflowRun({
      owner: this.owner,
      repo: this.repo,
      run_id: runId
    });

    return {
      status: data.status,
      conclusion: data.conclusion,
      url: data.html_url,
      startedAt: data.created_at,
      completedAt: data.updated_at
    };
  }
}
```

#### 4.2 Queue Manager Replacement
```typescript
// src/lib/progressive-capture/actions-queue-manager.ts
import { GitHubActionsClient } from './github-actions-client';
import { supabase } from '../supabase';

export class ActionsQueueManager {
  private client: GitHubActionsClient;

  constructor() {
    this.client = new GitHubActionsClient();
  }

  async queueJob(jobType: string, data: any): Promise<void> {
    // Record job in database
    const { data: job } = await supabase
      .from('progressive_capture_jobs')
      .insert({
        job_type: jobType,
        repository_id: data.repositoryId,
        status: 'dispatching',
        metadata: data
      })
      .select()
      .single();

    // Map job type to workflow
    const workflowMap: Record<string, string> = {
      'capture-pr-details': 'capture-pr-details.yml',
      'capture-pr-reviews': 'capture-pr-reviews.yml',
      'capture-pr-comments': 'capture-pr-comments.yml',
      'capture-repository-sync': 'capture-repository-sync.yml'
    };

    // Dispatch workflow
    try {
      await this.client.dispatchWorkflow({
        workflow: workflowMap[jobType],
        inputs: {
          repository_id: data.repositoryId,
          repository_name: data.repositoryName,
          pr_numbers: data.prNumbers?.join(',') || '',
          time_range: data.timeRange?.toString() || '30',
          job_id: job.id
        }
      });

      // Update job status
      await supabase
        .from('progressive_capture_jobs')
        .update({ status: 'dispatched' })
        .eq('id', job.id);

    } catch (error) {
      // Mark job as failed
      await supabase
        .from('progressive_capture_jobs')
        .update({ 
          status: 'failed',
          error: error.message 
        })
        .eq('id', job.id);
      
      throw error;
    }
  }

  async queueRecentPRs(repositoryId: string): Promise<void> {
    const { data: repo } = await supabase
      .from('repositories')
      .select('owner, name')
      .eq('id', repositoryId)
      .single();

    await this.queueJob('capture-repository-sync', {
      repositoryId,
      repositoryName: `${repo.owner}/${repo.name}`,
      timeRange: 7
    });
  }

  async queueMissingFileChanges(repositoryId: string, limit: number): Promise<number> {
    // Get PRs missing file changes
    const { data: prs } = await supabase
      .from('pull_requests')
      .select('number')
      .eq('repository_id', repositoryId)
      .is('additions', null)
      .limit(limit);

    if (!prs || prs.length === 0) return 0;

    const { data: repo } = await supabase
      .from('repositories')
      .select('owner, name')
      .eq('id', repositoryId)
      .single();

    await this.queueJob('capture-pr-details', {
      repositoryId,
      repositoryName: `${repo.owner}/${repo.name}`,
      prNumbers: prs.map(pr => pr.number)
    });

    return prs.length;
  }

  async getQueueStats(): Promise<QueueStats> {
    const { data: jobs } = await supabase
      .from('progressive_capture_jobs')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: jobs?.length || 0
    };

    jobs?.forEach(job => {
      switch (job.status) {
        case 'dispatching':
        case 'dispatched':
          stats.pending++;
          break;
        case 'running':
          stats.processing++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    });

    return stats;
  }
}

// Export as singleton
export const actionsQueueManager = new ActionsQueueManager();
```

### Phase 5: Database Schema

```sql
-- Table to track GitHub Actions jobs
CREATE TABLE progressive_capture_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,
  repository_id UUID REFERENCES repositories(id),
  status VARCHAR(20) DEFAULT 'pending',
  workflow_run_id BIGINT,
  metadata JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Index for querying job status
CREATE INDEX idx_capture_jobs_status ON progressive_capture_jobs(status, created_at);
CREATE INDEX idx_capture_jobs_repository ON progressive_capture_jobs(repository_id, created_at);

-- Progress tracking table
CREATE TABLE progressive_capture_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES progressive_capture_jobs(id),
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  current_item TEXT,
  errors JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 6: Migration Strategy

#### 6.1 Migration Steps

1. **Deploy Scripts**: Add capture scripts to main repository
2. **Create Jobs Repository**: Set up GitHub Actions workflows
3. **Create GitHub App**: For authentication
4. **Update Frontend**: Switch to Actions queue manager
5. **Run Parallel**: Run both systems temporarily
6. **Migrate Queue**: Transfer pending Inngest jobs
7. **Remove Inngest**: Clean up old code

#### 6.2 Migration Script
```javascript
// scripts/migrate-from-inngest.js
async function migrateFromInngest() {
  // This would be implemented based on Inngest's API
  // to fetch pending jobs and re-queue them
  
  console.log('Migration complete');
}
```

### Phase 7: Operational Considerations

#### 7.1 Monitoring

**GitHub Actions Dashboard**: Native monitoring UI
- View running workflows
- Check job history
- Download logs
- Re-run failed jobs

**Custom Monitoring Endpoints**:
```typescript
// API endpoint for job status
app.get('/api/progressive-capture/status', async (req, res) => {
  const stats = await actionsQueueManager.getQueueStats();
  const recentJobs = await getRecentJobs();
  
  res.json({
    stats,
    recentJobs,
    healthStatus: 'operational'
  });
});
```

#### 7.2 Cost Analysis

**GitHub Actions Pricing**:
- **Free**: 2,000 minutes/month (public repos)
- **Pro**: 3,000 minutes/month
- **Team**: 3,000 minutes/month
- **Additional**: $0.008 per minute

**Cost Calculation Example**:
```
Average job duration: 2 minutes
Jobs per day: 100
Monthly usage: 100 * 2 * 30 = 6,000 minutes
Cost: 3,000 free + (3,000 * $0.008) = $24/month
```

**Comparison with Inngest**:
- Inngest: $40-200/month based on volume
- GitHub Actions: $0-24/month for same volume
- **Savings**: 40-88% reduction in costs

#### 7.3 Performance Optimization

**Parallel Processing**:
```yaml
strategy:
  matrix:
    pr_batch: [0, 1, 2, 3, 4]
  max-parallel: 5
```

**Caching Dependencies**:
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
```

**Conditional Execution**:
```yaml
- name: Check if capture needed
  id: check
  run: |
    # Query database to see if data is fresh
    echo "needed=true" >> $GITHUB_OUTPUT
    
- name: Capture data
  if: steps.check.outputs.needed == 'true'
  run: node capture-script.js
```

## Advantages

1. **Cost Effective**: Leverages GitHub's free tier
2. **Native Integration**: Built into GitHub platform
3. **Excellent Visibility**: UI for monitoring all jobs
4. **Simple Debugging**: Direct access to logs
5. **Manual Triggers**: Easy re-runs via UI
6. **Scheduled Runs**: Cron support built-in
7. **Parallel Execution**: Matrix strategy support
8. **Secure**: GitHub's secret management

## Disadvantages

1. **Workflow Limits**: 6 hours max per job
2. **Concurrency Limits**: 20 concurrent jobs (free), 180 (paid)
3. **Storage Limits**: Log retention policies
4. **GitHub Dependency**: Requires GitHub availability
5. **Less Real-time**: Not webhook-driven

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| GitHub Actions outage | Implement manual fallback triggers |
| Rate limiting | Sophisticated retry logic in scripts |
| Long-running jobs | Break into smaller chunks |
| Secret exposure | Use GitHub's secret scanning |
| Cost overrun | Set up usage alerts |

## Success Metrics

1. **Reliability**: 99.5% job success rate
2. **Performance**: 90% of jobs complete within 5 minutes
3. **Cost**: Stay within free tier (2,000 minutes)
4. **User Experience**: No degradation from current
5. **Maintainability**: Reduce code complexity by 30%

## Timeline

- **Week 1**: Create scripts and basic workflows
- **Week 2**: Frontend integration and testing
- **Week 3**: Migration and parallel running
- **Week 4**: Monitoring and optimization
- **Total**: 4 weeks to full production

## Conclusion

The GitHub Actions approach provides a serverless, cost-effective solution for progressive data capture. By leveraging GitHub's infrastructure and following the proven hearts/jobs pattern, we can deliver a reliable system with excellent observability and minimal operational overhead. The significant cost savings and reduced complexity make this an attractive alternative to the current Inngest-based approach.