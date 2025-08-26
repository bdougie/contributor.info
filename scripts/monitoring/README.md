# PR Data Corruption Monitoring

This directory contains scripts and queries for monitoring PR data corruption in the contributor.info database.

## Overview

The monitoring system detects when PR data becomes corrupted (all metrics showing as zero) and provides both SQL queries for manual inspection and an automated JavaScript monitor for continuous checking.

## Files

### `detect-pr-corruption.sql`
SQL queries for manual corruption detection:
- Daily corruption summary
- Real-time corruption detection (last hour)
- Repository health checks
- Corruption trend analysis
- Alert status query

### `corruption-monitor.js`
Automated monitoring script that can be run via cron job:
- Checks for recent corruption
- Monitors repository health
- Analyzes corruption trends
- Sends alerts via webhook (optional)

## Setup

### Manual Monitoring

Run the SQL queries in `detect-pr-corruption.sql` directly in your Supabase SQL editor or via psql:

```bash
# Using psql
psql $DATABASE_URL < detect-pr-corruption.sql

# Or copy individual queries to Supabase SQL editor
```

### Automated Monitoring

1. **Install dependencies** (if not already installed):
```bash
npm install @supabase/supabase-js dotenv
```

2. **Set environment variables**:
```bash
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
```

3. **Run the monitor**:
```bash
# Run all checks
node scripts/monitoring/corruption-monitor.js

# Only run critical alert checks (faster)
node scripts/monitoring/corruption-monitor.js --alert-only

# Send alerts to webhook (e.g., Slack, Discord)
node scripts/monitoring/corruption-monitor.js --webhook https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Cron Job Setup

To run the monitor automatically every hour, add this to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (adjust paths as needed)
0 * * * * cd /path/to/contributor.info && node scripts/monitoring/corruption-monitor.js --webhook https://your.webhook.url >> /var/log/corruption-monitor.log 2>&1
```

For GitHub Actions:
```yaml
name: PR Data Corruption Monitor

on:
  schedule:
    - cron: '0 * * * *'  # Run every hour
  workflow_dispatch:     # Allow manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run corruption monitor
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: node scripts/monitoring/corruption-monitor.js --alert-only
        
      - name: Alert on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              "text": "⚠️ PR Data Corruption Detected!",
              "attachments": [{
                "color": "danger",
                "text": "Corruption monitor detected issues. Check logs for details."
              }]
            }
```

## Alert Thresholds

The monitor uses these thresholds (configurable in `corruption-monitor.js`):

- **CRITICAL**: More than 20 corrupted PRs in the last hour
- **WARNING**: More than 50% corruption rate for any repository
- **ALERT**: More than 10% overall corruption rate

## Exit Codes

The monitor script returns different exit codes for scripting:
- `0`: OK - No issues detected
- `1`: WARNING - Potential issues detected
- `2`: CRITICAL - Immediate action required
- `3`: ERROR - Monitor script failed

## Webhook Integration

The monitor can send alerts to any webhook-compatible service. The payload format:

```json
{
  "text": "PR Data Corruption Alert: WARNING",
  "timestamp": "2025-08-26T12:00:00Z",
  "severity": "WARNING",
  "checks": [
    {
      "name": "Recent Corruption",
      "status": "WARNING",
      "message": "Found 5 corrupted PRs in the last hour",
      "data": ["owner/repo#123", "owner/repo#124"]
    }
  ],
  "overallStatus": "WARNING"
}
```

## Recovery

If corruption is detected:

1. **Immediate action**: Run the recovery script
```bash
node scripts/fix-corrupted-pr-data.js
```

2. **Check specific PRs**: Use the targeted fix script
```bash
node scripts/fix-pr-7273.js
```

3. **Verify fix**: Re-run the monitor
```bash
node scripts/monitoring/corruption-monitor.js
```

## Best Practices

1. **Regular monitoring**: Run the monitor at least hourly
2. **Alert fatigue**: Adjust thresholds if too many false positives
3. **Log retention**: Keep monitor logs for trend analysis
4. **Database indexes**: Ensure corruption detection indexes are in place (see migration `20250826_add_pr_corruption_detection_index.sql`)
5. **Rate limiting**: Recovery scripts include retry logic and rate limit handling