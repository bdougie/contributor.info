# Slack List Channels Edge Function

Backend proxy for fetching Slack channels securely.

## Purpose

This function proxies Slack API calls to fetch the list of channels a bot has access to. It was
created to:

1. **Security**: Keep bot tokens secure by never exposing them to the frontend
2. **CSP Compliance**: Frontend Content Security Policy blocks direct calls to slack.com
3. **Encryption**: Handle decryption of bot tokens on the backend where it's secure

## Deployment

```bash
supabase functions deploy slack-list-channels
```

**Security**: This function requires JWT verification and validates workspace membership before
decrypting bot tokens. Users must be authenticated members of the workspace to access integration
data.

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

1. Frontend sends `integration_id` with user's JWT token
2. Function verifies JWT and authenticates the user
3. Function fetches the integration from database
4. Function validates user is a member of the workspace
5. Function decrypts the `bot_token_encrypted`
6. Function calls Slack API `conversations.list` with pagination support
7. Function returns channel list to frontend

## Security

- **Authentication**: Requires valid JWT token from authenticated user
- **Authorization**: Validates user is a workspace member before access
- **Encryption**: Bot tokens are never exposed to the frontend
- **Decryption**: Tokens are decrypted only in the backend after authorization
- **Service Role**: Uses service role key only for authorization checks (bypassing RLS safely)
- **CORS**: Enabled for frontend access with proper authentication
