# Trending Repositories

Discover repositories experiencing significant growth and activity.

## What Makes a Repository Trend?

**Viral Growth**: 100+ stars gained in 24 hours
**High Percentage**: 50%+ growth rate (great for smaller repos)
**Sustained Momentum**: Consistent growth over 7-30 days

## Filtering Options

- **Time Period**: Last 24 hours, 7 days, or 30 days
- **Language**: Filter by programming language
- **Sort By**: Trending score, star growth, PR activity, or new contributors

## Scoring Algorithm

Repositories are ranked by:
1. Absolute star gains (100+ daily = top priority)
2. Growth percentage (smaller repos can compete)
3. PR and contributor activity
4. Historical performance

## Data Updates

Metrics refresh when repositories sync. No trending data appears until repositories accumulate change history.

## API Access

```
GET /.netlify/functions/api-trending-repositories?period=7d&limit=50
```

Parameters:
- `period`: 24h, 7d, 30d
- `limit`: Max 100
- `language`: e.g., TypeScript, Python
- `sort`: trending_score, star_change, pr_change