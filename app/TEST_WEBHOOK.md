# Testing the GitHub App Webhook

## 1. Test the Webhook Endpoint

Visit this URL in your browser:
```
https://contributor.info/api/github/webhook-test
```

You should see a JSON response like:
```json
{
  "message": "GitHub App webhook test endpoint",
  "method": "GET",
  "environment": {
    "hasAppId": true,
    "hasPrivateKey": true,
    "hasWebhookSecret": true,
    "hasClientId": true,
    "hasClientSecret": true
  }
}
```

## 2. Test GitHub Ping

1. Go to your GitHub App settings: https://github.com/settings/apps/contributor-info
2. Click on "Advanced" in the left sidebar
3. Look for "Recent Deliveries"
4. Find a "ping" event (or trigger one by updating the webhook URL)
5. Click "Redeliver"

The response should be:
```json
{
  "message": "Pong!",
  "app_configured": true
}
```

## 3. Test with a Real PR

1. Install the app on a test repository
2. Create a new PR
3. Check the "Recent Deliveries" to see if the webhook was called
4. Look for any errors in the response

## Troubleshooting

If you see HTML instead of JSON:
- The redirect might not be working
- Check that the function deployed successfully
- Try accessing the function directly: `/.netlify/functions/github-webhook-simple`

If you get a 404:
- The function may not have deployed
- Check the Netlify deploy logs for errors

If you get a 401:
- The webhook secret might not match
- Verify `GITHUB_APP_WEBHOOK_SECRET` is set correctly in both GitHub and Netlify