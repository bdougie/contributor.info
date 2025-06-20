# Phase 1 Setup Guide: GitHub Events Classification Foundation

## Overview
This guide walks through setting up the foundation for the GitHub Events Classification system.

## Prerequisites
- Supabase project with admin access
- GitHub personal access token
- GitHub webhook secret

## Step 1: Apply Database Migrations

1. Navigate to your Supabase Dashboard
2. Go to SQL Editor
3. Run the following migrations in order:

### Migration 1: Core Tables
```sql
-- Copy contents of supabase/migrations/20250120_github_events_classification.sql
```

### Migration 2: pg_cron Setup
```sql
-- Copy contents of supabase/migrations/20250120_setup_pg_cron.sql
```

Note: If pg_cron is not enabled, you may need to enable it in the Database settings first.

## Step 2: Deploy Edge Functions

### Deploy Webhook Handler
```bash
supabase functions deploy github-webhook
```

### Deploy Sync Function
```bash
supabase functions deploy github-sync
```

## Step 3: Configure Secrets

Set the required secrets for your Edge Functions:

```bash
# Set GitHub token for API access
supabase secrets set GITHUB_TOKEN=your_github_personal_access_token

# Set webhook secret for signature verification
supabase secrets set GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 4: Configure GitHub Webhooks

1. Go to your GitHub repository settings
2. Navigate to Webhooks
3. Add a new webhook:
   - **Payload URL**: `https://your-project.supabase.co/functions/v1/github-webhook`
   - **Content type**: `application/json`
   - **Secret**: Use the same secret you set in Step 3
   - **Events**: Select individual events:
     - Pull requests
     - Pushes
     - Issues
     - Releases
     - Pull request reviews

## Step 5: Test the Setup

### Test Webhook
Create a test PR or push to trigger the webhook. Check the logs:

```bash
supabase functions logs github-webhook
```

### Test Manual Sync
Trigger a manual sync for a specific repository:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/github-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"owner": "your-org", "repository": "your-repo"}'
```

## Step 6: Verify Data

Check that data is being collected:

```sql
-- Check events
SELECT * FROM github_events_cache ORDER BY created_at DESC LIMIT 10;

-- Check detected roles
SELECT * FROM contributor_roles ORDER BY confidence_score DESC;

-- Check sync status
SELECT * FROM github_sync_status;

-- Check cron jobs
SELECT * FROM cron_job_status;
```

## Troubleshooting

### pg_cron not available
If pg_cron extension is not available:
1. Contact Supabase support to enable it
2. Alternatively, use external cron service to call the sync endpoint

### Webhook not receiving events
1. Check webhook configuration in GitHub
2. Verify the secret matches
3. Check Edge Function logs for errors

### Sync failing
1. Verify GitHub token has necessary permissions
2. Check rate limit status
3. Review Edge Function logs

## Next Steps
Once Phase 1 is complete and verified:
- Proceed to Phase 2: Core Processing implementation
- Monitor the system for 24 hours to ensure stability
- Review collected events and initial role detections