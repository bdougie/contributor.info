# On-Demand Ranking System

## Overview

The contributor ranking system has been redesigned to calculate rankings on-demand when viewed, replacing the previous scheduled GitHub Actions workflow approach. This ensures always-fresh data while eliminating workflow failures and reducing unnecessary computations.

## Architecture

### Components

1. **Supabase Edge Function** (`calculate-monthly-rankings`)
   - Location: `supabase/functions/calculate-monthly-rankings/index.ts`
   - Calculates rankings in real-time from existing database tables
   - Caches results for 1 hour to balance freshness with performance

2. **Frontend Hook** (`useMonthlyContributorRankings`)
   - Location: `src/hooks/use-monthly-contributor-rankings.ts`
   - Calls Edge Function with automatic fallback to database query
   - Provides loading states for better UX

3. **Analytics Tracking**
   - PostHog events track usage patterns
   - Helps validate feature value and optimize performance

## How It Works

### Calculation Flow

1. User navigates to a repository page
2. `useMonthlyContributorRankings` hook is triggered
3. Hook retrieves user session (if authenticated) and calls the Edge Function
4. Edge Function validates authentication and checks for cached data (< 1 hour old)
5. If no cache, calculates fresh rankings from:
   - `pull_requests` table (PRs created)
   - `reviews` table (PR reviews) - continues on error
   - `pr_comments` table (PR comments) - continues on error
6. Applies weighted scoring formula: `(PRs × 10) + (Reviews × 3) + (Comments × 1)`
7. Returns top contributors with their stats (limit: 1-100, default: 10)
8. Results are cached in `monthly_rankings` table with error handling

### Fallback Strategy

If the Edge Function is unavailable or returns an error:
1. State is properly reset (`isCalculating` set to false)
2. Hook falls back to direct database query
3. Checks `monthly_rankings` table for existing data
4. If current month has no data, finds most recent month with data
5. Displays fallback indicator to user

## Analytics Events

The system tracks three key events with the `repo_leaderboard` prefix:

### `repo_leaderboard_viewed`
Fired when the leaderboard component is rendered.

**Properties:**
- `repository_owner`: Repository owner username
- `repository_name`: Repository name
- `month`: Display month
- `year`: Display year
- `is_winner_phase`: Boolean (true for days 1-7 of month)
- `total_contributors`: Number of contributors shown
- `has_winner`: Boolean

### `repo_leaderboard_card_hover`
Fired when a user hovers over a contributor card (limited to once per contributor per session).

**Properties:**
- `repository_owner`: Repository owner username
- `repository_name`: Repository name
- `contributor_username`: Contributor's GitHub username
- `contributor_rank`: Numerical rank
- `month`: Display month
- `year`: Display year
- `is_winner`: Boolean
- `pull_requests_count`: Number of PRs
- `reviews_count`: Number of reviews
- `comments_count`: Number of comments
- `total_score`: Weighted score

### `repo_leaderboard_card_clicked`
Fired when a user clicks on a contributor card.

**Properties:** Same as hover event

## Benefits

### Reliability
- No dependency on scheduled workflows
- No failures from GitHub API rate limits
- Automatic fallback mechanisms
- Graceful error handling for partial data failures
- Query limits prevent performance issues

### Performance
- On-demand calculation reduces unnecessary processing
- 1-hour cache balances freshness with efficiency
- Only calculates for viewed repositories
- UTC-based date calculations avoid timezone boundary issues
- Query result limits (max 100) prevent heavy database loads

### Insights
- PostHog tracking validates feature usage
- Data helps optimize which repositories to prioritize
- Identifies engagement patterns

## Migration from Scheduled Workflow

The previous system used:
- GitHub Actions workflow: `.github/workflows/sync-contributor-stats.yml`
- Node.js sync script: `scripts/data-sync/sync-contributor-stats.js`
- Ran daily at 2:30 AM UTC
- Failed frequently due to API limits and timeout issues

These components have been removed in favor of the on-demand system.

## Deployment

### Edge Function Deployment

```bash
# Deploy the Edge Function
supabase functions deploy calculate-monthly-rankings
```

### Environment Variables

The Edge Function requires:
- `SUPABASE_URL`: Automatically provided
- `SUPABASE_ANON_KEY`: Automatically provided
- Authentication: Requires valid user session token passed in Authorization header

### Database Requirements

Required tables:
- `repositories`: Repository metadata
- `pull_requests`: PR data
- `reviews`: PR review data
- `pr_comments`: PR comment data
- `contributors`: Contributor profiles
- `monthly_rankings`: Cached ranking results

## Monitoring

### Health Checks
1. Check Edge Function logs: `supabase functions logs calculate-monthly-rankings`
2. Monitor PostHog for event tracking
3. Review `monthly_rankings` table for cache hits

### Common Issues

**Authentication errors:**
- Ensure user is logged in for write operations
- Verify session token is being passed correctly
- Check Edge Function authentication configuration

**Edge Function not responding:**
- Check deployment status
- Verify CORS configuration
- Review function logs for errors
- Confirm authentication headers are present

**Stale data showing:**
- Check `calculated_at` timestamp in response
- Verify cache invalidation logic
- Ensure database tables are being updated
- Confirm UTC date calculations are correct

**Missing contributors:**
- Verify `pull_requests` table has recent data
- Check contributor linking in database
- Review date range filters in function
- Note: Reviews/comments errors are non-fatal

## Future Enhancements

1. **Configurable Cache Duration**: Allow per-repository cache settings
2. **Preemptive Calculation**: Calculate for trending repositories before viewing
3. **Historical Trends**: Track ranking changes over time
4. **Team Rankings**: Aggregate rankings by organization
5. **Custom Metrics**: Allow repositories to define their own scoring weights