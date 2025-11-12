# Slack List Channels Edge Function

Backend proxy for fetching Slack channels securely.

## Purpose

This function proxies Slack API calls to fetch the list of channels a bot has access to. It was created to:

1. **Security**: Keep bot tokens secure by never exposing them to the frontend
2. **CSP Compliance**: Frontend Content Security Policy blocks direct calls to slack.com
3. **Encryption**: Handle decryption of bot tokens on the backend where it's secure

## Deployment

```bash
supabase functions deploy slack-list-channels --no-verify-jwt
```

**Note**: The `--no-verify-jwt` flag is required because this function needs to be accessible to authenticated users without requiring a specific JWT format.

## Environment Variables

Required (automatically provided in Supabase Edge Functions):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SLACK_WEBHOOK_ENCRYPTION_KEY` - Same key used for OAuth callback

## API

**POST** `/functions/v1/slack-list-channels`

### Request Body
```json
{
  "integration_id": "uuid"
}
```

### Response
```json
{
  "channels": [
    {
      "id": "C1234567890",
      "name": "general",
      "is_private": false,
      "is_member": true
    }
  ]
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

## Flow

1. Frontend sends `integration_id` to this function
2. Function fetches the integration from database
3. Function decrypts the `bot_token_encrypted`
4. Function calls Slack API `conversations.list` with pagination support
5. Function returns channel list to frontend

## Security

- Bot tokens are never exposed to the frontend
- Tokens are decrypted only in the backend
- Uses service role key to bypass RLS for fetching integration
- CORS is enabled for frontend access
