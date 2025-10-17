# Testing the GitHub App Webhook

## Important: Webhook Service Migration

**GitHub webhooks are now handled by a dedicated Fly.io service**, not Netlify Functions.

- **Production Webhook URL**: `https://contributor-info-webhooks.fly.dev/webhook`
- **Health Check**: `https://contributor-info-webhooks.fly.dev/health`
- **Metrics**: `https://contributor-info-webhooks.fly.dev/metrics`

## 1. Test the Webhook Service Health

Visit these URLs in your browser:

### Health Check
```
https://contributor-info-webhooks.fly.dev/health
```

You should see:
```json
{
  "status": "healthy",
  "uptime": "1234s",
  "environment": "production",
  "timestamp": "2025-01-12T..."
}
```

### Service Info
```
https://contributor-info-webhooks.fly.dev/
```

You should see:
```json
{
  "service": "GitHub Webhook Handler",
  "status": "operational",
  "endpoints": {
    "health": "/health",
    "metrics": "/metrics",
    "webhook": "/webhook"
  },
  "version": "1.0.0"
}
```

### Metrics
```
https://contributor-info-webhooks.fly.dev/metrics
```

Shows webhook processing statistics.

## 2. Test GitHub Ping

1. Go to your GitHub App settings: https://github.com/settings/apps/contributor-info
2. Verify the webhook URL is set to: `https://contributor-info-webhooks.fly.dev/webhook`
3. Click on "Advanced" in the left sidebar
4. Look for "Recent Deliveries"
5. Find a "ping" event (or trigger one by clicking "Ping" button)
6. Check the response - it should show status 200

## 3. Test with a Real PR

1. Install the app on a test repository
2. Create a new PR or issue
3. Check the "Recent Deliveries" in GitHub App settings
4. Monitor the Fly.io logs:
   ```bash
   fly logs -a contributor-info-webhooks
   ```

## 4. Local Development Testing

For local webhook testing:

1. Run the webhook service locally:
   ```bash
   cd webhooks-server
   npm run dev
   ```

2. Use ngrok to expose your local server:
   ```bash
   ngrok http 8080
   ```

3. Update GitHub App webhook URL to ngrok URL:
   ```
   https://abc123.ngrok.io/webhook
   ```

## Monitoring and Debugging

### View Live Logs
```bash
fly logs -a contributor-info-webhooks --follow
```

### SSH into Container
```bash
fly ssh console -a contributor-info-webhooks
```

### Check Webhook Deliveries
1. Go to GitHub App settings
2. Click "Advanced" → "Recent Deliveries"
3. Check response codes and payloads

## Troubleshooting

### Webhook Returns 401
- Webhook secret mismatch
- Verify `GITHUB_APP_WEBHOOK_SECRET` in Fly.io matches GitHub App settings:
  ```bash
  fly secrets list -a contributor-info-webhooks
  ```

### Webhook Returns 500
- Check logs for errors:
  ```bash
  fly logs -a contributor-info-webhooks | grep ERROR
  ```
- Verify all required secrets are set

### No Webhook Delivery
- Verify webhook URL in GitHub App settings
- Check if service is running:
  ```bash
  fly status -a contributor-info-webhooks
  ```

### Database Connection Issues
- Verify Supabase credentials are set correctly
- Check Supabase service status

## Migration Notes

The webhook handling has been migrated from Netlify Functions to Fly.io for:
- Better reliability (no 10-second timeout)
- Persistent connections
- Better observability with metrics
- Lower latency (<200ms response time)

For more details, see the [migration documentation](../../docs/migration/github-webhooks-fly-migration.md).