# GitHub App Troubleshooting Guide

## Environment Variables Exceed 4KB Limit

### Problem
Netlify has a 4KB limit on environment variables per function. The GitHub App private key is typically 1.7KB as PEM and ~2.3KB when base64 encoded, which can exceed the limit when combined with other environment variables.

### Solution

#### Option 1: Use Newline-Encoded Private Key (Recommended)
Store the private key with encoded newlines to reduce size:

1. **Encode your private key**:
   ```bash
   node scripts/encode-private-key.mjs path/to/your.private-key.pem
   ```

2. **Copy the encoded output** (will be ~1.7KB instead of 2.3KB)

3. **In Netlify**, set:
   - `GITHUB_APP_PRIVATE_KEY_ENCODED` = the encoded string
   - Remove the old `GITHUB_APP_PRIVATE_KEY` variable

4. **Clear other large variables**:
   - Check if you have duplicate or unused environment variables
   - Remove any test/development variables

#### Option 2: Split the Private Key
If you must use function-level env vars, split the private key:

```bash
# Split the base64 key into two parts
echo $GITHUB_APP_PRIVATE_KEY | cut -c1-1000 > key_part1.txt
echo $GITHUB_APP_PRIVATE_KEY | cut -c1001- > key_part2.txt
```

Then in Netlify:
- `GITHUB_APP_PRIVATE_KEY_1` = first part
- `GITHUB_APP_PRIVATE_KEY_2` = second part

In your code, concatenate them:
```javascript
const privateKey = Buffer.from(
  (process.env.GITHUB_APP_PRIVATE_KEY_1 || '') + 
  (process.env.GITHUB_APP_PRIVATE_KEY_2 || ''),
  'base64'
).toString();
```

#### Option 3: Use Netlify Secrets (Future)
Consider using Netlify's encrypted environment variables feature when available.

### Verification Steps

1. **Check total environment size**:
   ```bash
   # List all env vars and their sizes
   printenv | wc -c
   ```

2. **Verify key encoding**:
   ```bash
   # Check base64 encoded key size
   echo -n "$GITHUB_APP_PRIVATE_KEY" | wc -c
   ```

3. **Test locally with Netlify CLI**:
   ```bash
   netlify dev
   netlify functions:serve
   ```

## Webhook Not Receiving Events

### Checklist
1. ✓ Webhook URL is correct: `https://your-site.netlify.app/api/github/webhook`
2. ✓ Webhook secret matches in both GitHub and Netlify
3. ✓ GitHub App has required permissions
4. ✓ App is installed on the repository

### Debug Steps

1. **Check webhook deliveries**:
   - Go to: https://github.com/settings/apps/contributor-info/advanced
   - Look for failed deliveries
   - Click on a delivery to see request/response details

2. **Test the endpoint**:
   ```bash
   curl https://your-site.netlify.app/api/github/webhook-test
   ```

3. **Check Netlify function logs**:
   ```bash
   netlify functions:log github-webhook --tail
   ```

## Signature Verification Failing

### Common Causes
1. Webhook secret mismatch
2. Incorrect signature algorithm
3. Body parsing issues

### Solutions

1. **Regenerate webhook secret**:
   - In GitHub App settings, generate new secret
   - Update in Netlify environment variables
   - Ensure no extra spaces or newlines

2. **Verify raw body**:
   - Netlify Functions provide raw body in `event.body`
   - Don't parse it before signature verification

## PR Comments Not Appearing

### Checklist
1. ✓ App has write permission on pull requests
2. ✓ PR is not a draft
3. ✓ Repository is accessible to the app
4. ✓ No rate limiting in effect

### Debug Steps

1. **Check function execution**:
   - Look for errors in Netlify function logs
   - Verify webhook is being received

2. **Test permissions**:
   - Try creating a comment manually via API
   - Check installation permissions

3. **Verify PR state**:
   - Draft PRs are skipped by design
   - Check if PR author is excluded

## Installation Issues

### App Not Listed
If the app doesn't appear at https://github.com/apps/contributor-info:
1. Ensure app is set to "Public"
2. Check app is not suspended
3. Verify you're logged into correct account

### Can't Install on Organization
1. Check organization's third-party app policy
2. May need admin approval
3. Verify app permissions are acceptable

## Development Tips

### Local Testing with ngrok
```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 8888

# Update GitHub App webhook URL with ngrok URL
```

### Mock Webhook Events
```bash
# Send test webhook
curl -X POST https://your-ngrok-url/api/github/webhook \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: sha256=test" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"zen": "Testing webhook"}'
```

### Environment Variable Template
```bash
# .env.local for development
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64_encoded_key_here
GITHUB_APP_WEBHOOK_SECRET=your_secret_here
GITHUB_APP_CLIENT_ID=Iv1.abc123
GITHUB_APP_CLIENT_SECRET=client_secret_here
```