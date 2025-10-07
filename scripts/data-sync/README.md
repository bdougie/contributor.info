# Data Sync Scripts

Scripts for fetching, syncing, and backfilling GitHub repository data. These tools ensure comprehensive data capture from the GitHub API.

## 📊 Overview

The data sync scripts handle:
- Initial repository data capture
- Historical data backfilling
- Progressive data updates
- Large repository handling (100k+ PRs)

## 🚀 Scripts

### Core Sync Operations

| Script | Purpose | Usage |
|--------|---------|-------|
| `sync-historical-prs.js` | Sync all PRs for a repository | Initial repository setup |
| `sync-historical-comments.js` | Sync PR comments | Complete comment history |
| `sync-historical-reviews.js` | Sync PR reviews | Review data capture |
| `sync-contributor-stats.js` | Update contributor statistics | Contributor metrics |
| `sync-bulk-file-changes.js` | Sync file change data | Code change tracking |

### Backfill Operations

| Script | Purpose | Usage |
|--------|---------|-------|
| `backfill-pr-stats.js` | Fill missing PR statistics | Data recovery |
| `backfill-reviews-comments.mjs` | Backfill reviews and comments | Complete missing data |
| `backfill-discussion-summaries.mjs` | Generate AI summaries for existing discussions | Backfill summaries on old data |
| `initialize-pytorch-backfill.js` | Initialize large repo backfill | Start pytorch/pytorch sync |
| `get-pytorch-stats.js` | Get accurate repo statistics | Verify GitHub data |
| `pytorch-7day-backfill.js` | Run 7-day backfill with timeouts | Fetch recent PyTorch PRs |

### Refresh & Triggers

| Script | Purpose | Usage |
|--------|---------|-------|
| `refresh-stale-repos.js` | Update outdated repositories | Regular maintenance |
| `refresh-self-selection-data.ts` | Refresh contributor data | Update contributor info |
| `trigger-refresh.js` | Manually trigger data refresh | Force updates |
| `trigger-pr-activity-updates.js` | Update PR activity | Activity tracking |
| `manual-trigger.mjs` | Target specific repos | Selective updates |

## 💡 Usage Examples

### Initial Repository Setup
```bash
# Sync all historical data for a new repository
node scripts/data-sync/sync-historical-prs.js --owner facebook --repo react
node scripts/data-sync/sync-historical-reviews.js --owner facebook --repo react
node scripts/data-sync/sync-historical-comments.js --owner facebook --repo react
```

### Large Repository Handling
```bash
# Get accurate statistics first
node scripts/data-sync/get-pytorch-stats.js

# Initialize progressive backfill
node scripts/data-sync/initialize-pytorch-backfill.js

# Run 7-day backfill with 2-minute timeouts
node scripts/data-sync/pytorch-7day-backfill.js
```

### Regular Maintenance
```bash
# Refresh stale repositories (>7 days old)
node scripts/data-sync/refresh-stale-repos.js

# Force refresh specific repository
node scripts/data-sync/manual-trigger.mjs --owner pytorch --repo pytorch
```

### Data Recovery
```bash
# Backfill missing PR statistics
node scripts/data-sync/backfill-pr-stats.js --days 30

# Backfill reviews and comments
node scripts/data-sync/backfill-reviews-comments.mjs --repository-id <uuid>

# Backfill AI summaries for existing discussions (without summaries)
node scripts/data-sync/backfill-discussion-summaries.mjs --repository-id=<uuid>
# Or generate for all discussions
node scripts/data-sync/backfill-discussion-summaries.mjs --all
```

### Discussion Sync (Inngest Background Job)
```bash
# For new discussion syncs, use the Inngest background job instead:
# See: docs/data-fetching/discussion-background-sync.md

# Trigger via code:
await inngest.send({
  name: 'capture/repository.discussions',
  data: { repositoryId: 'uuid', maxItems: 100 }
});
```

## ⚙️ Configuration

### Environment Variables
```bash
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_TOKEN=your-service-role-key
VITE_GITHUB_TOKEN=your-github-token
```

### Rate Limiting
- Scripts respect GitHub API rate limits (5000/hour)
- Automatic throttling for large operations
- Progressive backfill for repositories >1000 PRs

## 🏗️ Architecture

### Progressive Backfill System
For large repositories (>1000 PRs):
1. Creates backfill state entry
2. Processes in chunks of 25-50 PRs
3. Tracks progress and handles failures
4. Runs via GitHub Actions every 30 minutes

### Data Flow
```
GitHub API → Sync Scripts → Supabase Database
                ↓
         Progressive Capture
                ↓
         Backfill System
```

## 🔍 Monitoring

Check sync status:
```sql
-- View backfill progress
SELECT * FROM backfill_progress_summary;

-- Check sync logs
SELECT * FROM sync_logs ORDER BY started_at DESC;
```

## ⚠️ Important Notes

1. **Large Repositories**: Use progressive backfill for repos >1000 PRs
2. **Rate Limits**: Monitor GitHub API usage during bulk operations
3. **Data Consistency**: Always sync PRs before reviews/comments
4. **Storage**: Large repos use ~400MB/year of storage

## 🆘 Troubleshooting

### Common Issues

**"Repository was synced X hours ago"**
- This is rate limiting protection
- Use `--force` flag or wait 12 hours

**"Rate limit exceeded"**
- Wait for rate limit reset
- Use progressive backfill for large repos

**"Missing data after sync"**
- Run appropriate backfill script
- Check sync_logs for errors