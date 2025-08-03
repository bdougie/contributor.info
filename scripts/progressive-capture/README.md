# Progressive Capture Scripts

Intelligent data capture system that efficiently processes GitHub repository data using both Inngest and GitHub Actions.

## Overview

Progressive capture automatically chooses the best processing method for each data type:
- **Recent data**: Processed by Inngest for immediate results
- **Historical data**: Processed by GitHub Actions for cost efficiency
- **Bulk operations**: Routed to the most appropriate processor

## Core Scripts

### Data Capture Scripts

#### `capture-pr-details.js`
**Purpose**: Capture detailed pull request information.

**When to use**:
- Adding new repositories to tracking
- Backfilling missing PR data
- Refreshing outdated PR information

**Usage**:
```bash
# Capture specific PRs
REPOSITORY_ID=123 PR_NUMBERS="45,67,89" node scripts/progressive-capture/capture-pr-details.js

# Capture recent PRs (last 30 days)
REPOSITORY_ID=123 TIME_RANGE=30 node scripts/progressive-capture/capture-pr-details.js
```

#### `capture-pr-details-graphql.js`
**Purpose**: High-performance PR capture using GitHub's GraphQL API.

**When to use**:
- Large-scale data capture
- When REST API hits rate limits
- Bulk repository processing

#### `capture-pr-comments.js`
**Purpose**: Capture PR comments and discussions.

**When to use**:
- Complete conversation history needed
- Community engagement analysis
- Missing comment data

#### `capture-pr-reviews.js`
**Purpose**: Capture PR reviews and approvals.

**When to use**:
- Review process analysis
- Contributor collaboration insights
- Code quality tracking

### Historical Sync Scripts

#### `historical-pr-sync.js`
**Purpose**: Sync complete historical PR data for a repository.

**When to use**:
- First-time repository setup
- Complete data recovery
- Historical analysis requirements

**Usage**:
```bash
REPOSITORY_ID=123 REPOSITORY_NAME="owner/repo" node scripts/progressive-capture/historical-pr-sync.js
```

#### `historical-pr-sync-graphql.js`
**Purpose**: High-performance historical sync using GraphQL.

**When to use**:
- Large repositories (>1000 PRs)
- Faster historical data collection
- When REST API is too slow

### Monitoring & Maintenance

#### `fix-stuck-jobs.js`
**Purpose**: Identify and fix jobs that are stuck or failing.

**When to use**:
- Jobs not completing
- Error recovery
- System maintenance

#### `monitor-stuck-jobs.js`
**Purpose**: Continuous monitoring for stuck jobs.

**When to use**:
- Ongoing system health monitoring
- Automated maintenance
- Early problem detection

#### `test-job-completion.js`
**Purpose**: Test job completion and verification.

**When to use**:
- Validating system functionality
- Troubleshooting job issues
- System health checks

## Support Library (`/lib/`)

### `base-capture.js`
Common functionality for all capture scripts including error handling, rate limiting, and progress tracking.

### `graphql-client.js`
Optimized GitHub GraphQL client with rate limit management and automatic retries.

### `hybrid-github-client.js`
Intelligent client that chooses between REST and GraphQL APIs based on the operation.

### `progress-tracker.js`
Real-time progress tracking for long-running capture operations.

### `rate-limit-monitor.js`
GitHub API rate limit monitoring and intelligent backoff strategies.

### `rate-limiter.js`
Advanced rate limiting with dynamic adjustment based on API response headers.

## Workflow Examples

### Adding a New Repository
```bash
# 1. Capture recent data first (fast)
REPOSITORY_ID=123 TIME_RANGE=7 node scripts/progressive-capture/capture-pr-details.js

# 2. Start historical sync (background)
REPOSITORY_ID=123 REPOSITORY_NAME="owner/repo" node scripts/progressive-capture/historical-pr-sync-graphql.js

# 3. Monitor progress
node scripts/progressive-capture/monitor-stuck-jobs.js
```

### Data Recovery
```bash
# 1. Fix any stuck jobs
node scripts/progressive-capture/fix-stuck-jobs.js

# 2. Identify gaps
REPOSITORY_ID=123 node scripts/validation/data-gap-validator.js

# 3. Fill missing data
REPOSITORY_ID=123 START_DATE="2024-01-01" node scripts/progressive-capture/capture-pr-details.js
```

### Performance Optimization
```bash
# 1. Monitor current performance
node scripts/progressive-capture/monitor-stuck-jobs.js

# 2. Run optimization
node scripts/optimization/inngest-optimizer.js
node scripts/optimization/github-actions-optimizer.js

# 3. Test improvements
node scripts/progressive-capture/test-job-completion.js
```

## Environment Variables

```bash
# Required
REPOSITORY_ID=123                    # Target repository ID
REPOSITORY_NAME="owner/repo"         # Repository name for display
VITE_GITHUB_TOKEN=your-token        # GitHub API access
SUPABASE_TOKEN=your-supabase-token  # Database access

# Optional
JOB_ID=unique-job-id                # For job tracking
TIME_RANGE=30                       # Days to process (default: 30)
PR_NUMBERS="1,2,3"                  # Specific PRs to process
BATCH_SIZE=50                       # Processing batch size
MAX_RETRIES=3                       # Maximum retry attempts
```

## Smart Processing

The system automatically:
- **Routes jobs** to the optimal processor (Inngest vs GitHub Actions)
- **Manages rate limits** across both processing systems
- **Handles retries** with intelligent backoff
- **Tracks progress** for long-running operations
- **Prevents data gaps** between different processors

## Performance Targets

- **Recent data**: < 2 minutes processing time
- **Historical data**: 10-120 minutes depending on repository size
- **Error rate**: < 5% across all operations
- **API efficiency**: Stay within GitHub rate limits
- **Cost savings**: 60-85% compared to single-processor approach

## Integration

Progressive capture integrates with:
- **Rollout system**: Gradual deployment of new repositories
- **Monitoring**: Real-time health and performance tracking
- **Validation**: Automatic data consistency checks
- **User interface**: Immediate feedback for user interactions

Use these scripts to efficiently capture and process GitHub repository data while maintaining optimal performance and cost efficiency.