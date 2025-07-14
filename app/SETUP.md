# GitHub App Setup Guide

## Step 1: Create the GitHub App

1. Go to https://github.com/settings/apps/new (for personal account) or https://github.com/organizations/{org}/settings/apps/new (for organization)

2. Fill in the following details:

### Basic Information
- **GitHub App name**: `contributor.info`
- **Homepage URL**: `https://contributor.info`
- **Description**: 
  ```
  Get intelligent PR insights with contributor profiles, reviewer suggestions, and related issues. 
  Automatically comments on pull requests with valuable context to speed up code reviews.
  ```

### Webhook
- **Webhook URL**: `https://contributor.info/api/github/webhook`
  - For local testing: Use ngrok URL like `https://abc123.ngrok.io/api/github/webhook`
- **Webhook secret**: Generate a secure random string (save this!)

### Permissions

#### Repository permissions:
- **Actions**: Read
- **Contents**: Read
- **Issues**: Read
- **Metadata**: Read (mandatory)
- **Pull requests**: Read & Write

#### Organization permissions:
- **Members**: Read

#### Account permissions:
- **Email addresses**: Read

### Subscribe to events:
- [x] Installation target
- [x] Issue comment
- [x] Issues
- [x] Pull request
- [x] Pull request review
- [x] Pull request review comment
- [x] Push
- [x] Repository
- [x] Star

### Where can this GitHub App be installed?
- [x] Any account

3. Click "Create GitHub App"

4. After creation, you'll need to:
   - Note the **App ID** (shown at the top)
   - Generate a **Private Key** (scroll down and click "Generate a private key")
   - Note the **Client ID** and generate a **Client Secret** (for OAuth flow)

## Step 2: Environment Variables

Add these to your `.env.local` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret_here
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your_client_secret_here

# App URLs (update for production)
GITHUB_APP_WEBHOOK_URL=https://contributor.info/api/github/webhook
GITHUB_APP_CALLBACK_URL=https://contributor.info/api/github/callback
```

For easier handling, you can base64 encode the private key:
```bash
# Encode the private key
base64 -i private-key.pem -o private-key-base64.txt

# Then use in .env.local
GITHUB_APP_PRIVATE_KEY=base64_encoded_string_here
```

## Step 3: Local Development Setup

### Using ngrok for webhooks

1. Install ngrok: https://ngrok.com/download

2. Start your local server:
   ```bash
   npm run dev
   ```

3. In another terminal, start ngrok:
   ```bash
   ngrok http 8888
   ```

4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

5. Update your GitHub App's webhook URL:
   - Go to https://github.com/settings/apps/contributor-info
   - Update Webhook URL to: `https://abc123.ngrok.io/api/github/webhook`

### Testing the webhook

1. Install the app on a test repository:
   - Go to https://github.com/apps/contributor-info
   - Click "Install"
   - Select repositories

2. Create a test PR in the repository

3. Check your local console for webhook events

4. Verify the comment appears on the PR

## Step 4: Production Deployment

### Netlify Functions Setup

The webhook handler is already configured as a Netlify Function at:
`netlify/functions/github-webhook.mts`

### Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add the following variables (click "Add a variable" for each):

   **Required Variables:**
   ```
   GITHUB_APP_ID = your_app_id_here
   GITHUB_APP_PRIVATE_KEY = your_base64_encoded_private_key
   GITHUB_APP_WEBHOOK_SECRET = your_webhook_secret_here
   ```

   **Optional Variables (for future OAuth flow):**
   ```
   GITHUB_APP_CLIENT_ID = your_client_id_here
   GITHUB_APP_CLIENT_SECRET = your_client_secret_here
   ```

4. For the private key:
   - Copy your base64-encoded key: `base64 -i private-key.pem | tr -d '\n' | pbcopy`
   - Paste the single-line result as the value

5. Deploy your site:
   ```bash
   git add .
   git commit -m "Add GitHub App webhook handler"
   git push
   ```

6. Verify deployment:
   - Visit: `https://your-site.netlify.app/api/github/webhook-test`
   - You should see a JSON response with environment check

### Update GitHub App URLs

After deployment, update your GitHub App settings:

1. Go to: https://github.com/settings/apps/contributor-info
2. Update these URLs:
   - **Webhook URL**: `https://contributor-info.netlify.app/api/github/webhook`
   - **Homepage URL**: `https://contributor.info`
   - **Callback URL**: `https://contributor-info.netlify.app/api/github/callback`

3. Save changes

### Testing Production Webhook

1. Test endpoint: Visit `https://contributor-info.netlify.app/api/github/webhook-test`
2. Install the app on a test repository
3. Create a PR to trigger the webhook
4. Check Netlify Function logs:
   ```bash
   netlify functions:log github-webhook --tail
   ```

## Step 5: Monitoring

### Webhook Deliveries
- Check recent deliveries: https://github.com/settings/apps/contributor-info/advanced
- Look for any failed deliveries and debug

### Logs
- Netlify Functions logs: `netlify functions:log github-webhook`
- Application logs in Supabase: Check `app_metrics` table

### Rate Limits
- Monitor GitHub API rate limits in responses
- App installations get 5,000 requests/hour per installation
- Implement caching to minimize API calls

## Troubleshooting

### Webhook not receiving events
1. Check ngrok is running and URL is correct
2. Verify webhook secret matches
3. Check GitHub App permissions
4. Look at webhook delivery history

### Comments not appearing
1. Check PR is not a draft
2. Verify app has write permissions on pull requests
3. Check logs for errors
4. Ensure repository is accessible to the app

### Authentication errors
1. Verify private key is correctly formatted
2. Check App ID is correct
3. Ensure private key hasn't expired
4. Verify installation ID is valid