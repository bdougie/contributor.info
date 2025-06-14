# Supabase Storage Estimation

## Data Size Calculations

### Per Record Estimates:
- **Contributor**: ~500 bytes (username, avatar, bio, etc.)
- **Pull Request**: ~1KB (title, description, stats)
- **Review**: ~200 bytes
- **Comment**: ~500 bytes (with content)

### Example Repository Scenarios:

#### Small Repo (100 contributors, 1K PRs/year)
- Contributors: 100 × 500B = 50KB
- Pull Requests: 1,000 × 1KB = 1MB
- Reviews: ~2,000 × 200B = 400KB
- Comments: ~5,000 × 500B = 2.5MB
- **Total**: ~4MB/year

#### Medium Repo (1K contributors, 10K PRs/year)
- Contributors: 1,000 × 500B = 500KB
- Pull Requests: 10,000 × 1KB = 10MB
- Reviews: ~20,000 × 200B = 4MB
- Comments: ~50,000 × 500B = 25MB
- **Total**: ~40MB/year

#### Large Repo (10K contributors, 100K PRs/year)
- Contributors: 10,000 × 500B = 5MB
- Pull Requests: 100,000 × 1KB = 100MB
- Reviews: ~200,000 × 200B = 40MB
- Comments: ~500,000 × 500B = 250MB
- **Total**: ~400MB/year

## Supabase Free Tier Limits:
- **Database**: 500MB
- **Could handle**: 
  - 100+ small repos for 1 year
  - 10+ medium repos for 1 year
  - 1 large repo for 1 year

## Storage Optimization Strategies:

### 1. **Data Retention Policies**
```sql
-- Delete PR data older than 2 years
DELETE FROM pull_requests WHERE created_at < NOW() - INTERVAL '2 years';

-- Archive old data to cold storage
INSERT INTO archived_pull_requests SELECT * FROM pull_requests 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### 2. **Selective Storage**
```sql
-- Only store PRs from active contributors
-- Only store merged PRs
-- Skip bot accounts
-- Aggregate old data into summary tables
```

### 3. **Data Compression**
```sql
-- Use JSONB for variable fields
-- Store only essential fields
-- Use foreign keys efficiently
-- Regular VACUUM to reclaim space
```

### 4. **Progressive Data Loading**
```javascript
// Start with recent data
await syncPullRequests({ since: '6 months ago' });

// Load historical data on-demand
await syncHistoricalData({ year: 2023 });
```

## Monitoring Storage:

```sql
-- Check current database size
SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Set up alerts
CREATE OR REPLACE FUNCTION check_storage_usage()
RETURNS void AS $$
BEGIN
  IF pg_database_size(current_database()) > 400 * 1024 * 1024 THEN
    -- Send alert or trigger cleanup
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## Recommendations:

1. **Start Conservative**: 
   - Begin with 6 months of data
   - Monitor storage growth
   - Adjust retention as needed

2. **Use Summary Tables**:
   - Keep raw data for 6-12 months
   - Aggregate older data into monthly summaries
   - Much smaller storage footprint

3. **Implement Cleanup Jobs**:
   - Weekly: Remove orphaned records
   - Monthly: Archive old detailed data
   - Quarterly: Optimize tables (VACUUM)

4. **Consider Paid Tier When Needed**:
   - Pro tier: 8GB ($25/month)
   - Easily handles 20+ large repos
   - Includes point-in-time recovery

## Bottom Line:
You're unlikely to hit storage limits with normal usage. Even tracking 10-20 active repositories would take years to fill the free tier, and you can implement smart retention policies to manage growth.