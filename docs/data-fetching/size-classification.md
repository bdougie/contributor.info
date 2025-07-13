# Repository Size Classification System

## Overview

The repository size classification system automatically categorizes tracked repositories into size buckets (small, medium, large, xl) based on their activity metrics. This classification drives our smart data fetching strategy, ensuring efficient resource allocation and optimal performance.

## Classification Metrics

Repositories are evaluated based on five key metrics:

### 1. Stars Count
- **Small**: < 1,000 stars
- **Medium**: 1,000 - 10,000 stars
- **Large**: 10,000 - 50,000 stars
- **XL**: > 50,000 stars

### 2. Forks Count
- **Small**: < 100 forks
- **Medium**: 100 - 1,000 forks
- **Large**: 1,000 - 5,000 forks
- **XL**: > 5,000 forks

### 3. Monthly Pull Requests
- **Small**: < 100 PRs/month
- **Medium**: 100 - 500 PRs/month
- **Large**: 500 - 2,000 PRs/month
- **XL**: > 2,000 PRs/month

### 4. Monthly Commits
- **Small**: < 500 commits/month
- **Medium**: 500 - 2,000 commits/month
- **Large**: 2,000 - 10,000 commits/month
- **XL**: > 10,000 commits/month

### 5. Active Contributors
- **Small**: < 10 contributors
- **Medium**: 10 - 50 contributors
- **Large**: 50 - 200 contributors
- **XL**: > 200 contributors

## Classification Algorithm

The system uses a **majority scoring approach**:

1. Each metric is evaluated against the thresholds
2. The repository receives a "vote" for the size category it falls into for each metric
3. The final size is determined by the category with the most votes (minimum 2 votes required)
4. In case of ties, the system defaults to the smaller size category

## Edge Case Handling

### Special Repository Types

#### 1. Monorepos
- Often have higher commit activity than regular repos
- If classified as small/medium but has > 1,000 monthly commits → bumped to medium
- If classified as medium but has > 5,000 monthly commits → bumped to large

#### 2. Mirror Repositories
- May have inflated metrics due to syncing
- Size classification is automatically reduced by one level
- XL → Large, Large → Medium, etc.

#### 3. Enterprise Repositories
- May have fewer public contributors but high internal activity
- Activity score (monthly PRs + commits) > 3,000 with medium classification → bumped to large

#### 4. Documentation/Website Repositories
- Detected by primary language (HTML, CSS, Markdown)
- Lower commit activity expected
- If stars > 5,000 but classified as small → bumped to medium

### Extreme Edge Cases

#### Abandoned Popular Projects
- High stars (> 10,000) but low activity (< 10 PRs/month)
- Reduced from XL/Large to Medium

#### Active Internal Tools
- High activity (> 500 PRs/month) but low stars (< 100)
- Increased from Small to Medium

#### Bot-Driven Repositories
- Few contributors (< 5) but many PRs (> 100/month)
- Standardized as Medium

## Database Schema

```sql
-- Enum types
CREATE TYPE repository_size AS ENUM ('small', 'medium', 'large', 'xl');
CREATE TYPE repository_priority AS ENUM ('high', 'medium', 'low');

-- Columns added to tracked_repositories
ALTER TABLE tracked_repositories
ADD COLUMN size repository_size,
ADD COLUMN priority repository_priority DEFAULT 'low',
ADD COLUMN metrics JSONB,
ADD COLUMN size_calculated_at TIMESTAMPTZ;
```

### Metrics JSON Structure
```json
{
  "stars": 12500,
  "forks": 850,
  "monthlyPRs": 320,
  "monthlyCommits": 1580,
  "activeContributors": 45,
  "lastCalculated": "2024-01-13T10:30:00Z"
}
```

## Automatic Classification

### When Classification Occurs

1. **New Repository Tracking**
   - Triggered immediately when a repository is tracked
   - Runs asynchronously via Inngest background job

2. **Periodic Reclassification**
   - All repositories: Every 30 days
   - High-priority repositories: Every 7 days
   - Scheduled job runs every 6 hours to check for repositories needing classification

3. **Manual Triggers**
   - Can be triggered via the Inngest dashboard
   - Useful for testing or immediate updates

### Background Jobs

#### `classify-repository-size`
- Runs every 6 hours
- Processes unclassified repositories
- Reclassifies repositories older than 30 days
- Special handling for high-priority repos (7-day cycle)

#### `classify-single-repository`
- On-demand classification for individual repositories
- Triggered when repositories are tracked
- Used for immediate classification needs

## Integration Points

### 1. Auto-Track Hook (`use-auto-track-repository.ts`)
```typescript
// Trigger classification for new repos
inngest.send({
  name: 'classify/repository.single',
  data: {
    repositoryId: newRepo.id,
    owner,
    repo
  }
})
```

### 2. Repository Size Classifier Service
- Core classification logic
- GitHub API integration for metrics
- Edge case handling
- Database updates

### 3. Data Fetching Strategy (Future)
- Small repos: Fetch complete history
- Medium repos: Fetch last 6 months
- Large repos: Fetch last 3 months
- XL repos: Fetch last 1 month

## Performance Considerations

1. **API Rate Limiting**
   - Classifier respects GitHub API rate limits
   - Batch operations process up to 5 repositories concurrently
   - Failed classifications are retried up to 3 times

2. **Database Efficiency**
   - Indexed queries on size and priority columns
   - JSONB metrics allow flexible metric storage
   - Efficient batch updates for multiple repositories

## Monitoring and Debugging

### Key Queries

```sql
-- Get repository size distribution
SELECT size, COUNT(*) 
FROM tracked_repositories 
WHERE size IS NOT NULL 
GROUP BY size;

-- Find repositories needing classification
SELECT * FROM tracked_repositories 
WHERE size IS NULL 
  OR size_calculated_at < NOW() - INTERVAL '30 days';

-- Get high-priority repositories
SELECT * FROM tracked_repositories 
WHERE priority = 'high' 
  AND tracking_enabled = true;
```

### Logs and Telemetry
- Classification results logged to console
- Failed classifications tracked with error details
- Batch operation statistics (successful vs failed)

## Future Enhancements

1. **Machine Learning Classification**
   - Train models on repository patterns
   - Predict size without API calls
   - Improve edge case detection

2. **Dynamic Thresholds**
   - Adjust thresholds based on ecosystem
   - Language-specific classifications
   - Organization-specific patterns

3. **Classification Confidence**
   - Add confidence scores to classifications
   - Flag repositories for manual review
   - Improve edge case handling