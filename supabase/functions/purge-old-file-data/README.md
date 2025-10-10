# Purge Old File Data Function

This Edge Function automatically purges file index data older than 30 days to comply with our data
retention policy.

## What it does

1. Deletes `file_contributors` records where `last_commit_at` is older than 30 days
2. Deletes `file_embeddings` records where `last_indexed_at` is older than 30 days
3. Cleans up old `pr_insights` records as well

## Deployment

```bash
supabase functions deploy purge-old-file-data
```

## Schedule Setup

To run this function daily, set up a cron job using pg_cron or an external scheduler:

### Using pg_cron (recommended)

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the purge function to run daily at 2 AM UTC
SELECT cron.schedule(
  'purge-old-file-data', -- job name
  '0 2 * * *', -- cron expression (daily at 2 AM)
  $$
  SELECT
    net.http_post(
      url := 'https://your-project-id.supabase.co/functions/v1/purge-old-file-data',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### Using GitHub Actions

Alternatively, you can trigger this function using GitHub Actions:

```yaml
name: Purge Old File Data
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC

jobs:
  purge:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Purge Function
        run: |
          curl -X POST https://your-project-id.supabase.co/functions/v1/purge-old-file-data \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

## Manual Execution

To manually trigger the purge:

```bash
curl -X POST https://your-project-id.supabase.co/functions/v1/purge-old-file-data \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Response

The function returns a JSON response with the count of purged records:

```json
{
  "purged": {
    "file_contributors": 150,
    "file_embeddings": 200
  }
}
```

## Privacy Compliance

This function ensures compliance with our privacy policy by:

- Automatically removing file index data after 30 days
- Not storing file content permanently
- Maintaining only aggregated contributor statistics
