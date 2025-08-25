# GitHub App Authentication for Continue Review Action

This action now supports GitHub App authentication, allowing it to comment as your App instead of as "github-actions[bot]".

## How It Works

The action can authenticate in three ways (in order of preference):

1. **As a GitHub App** (if configured) - Comments appear from your App
2. **With provided App credentials** - Use your own App
3. **With GitHub Token** (fallback) - Comments appear from github-actions[bot]

## Setup Options

### Option 1: Use the Built-in Continue Review App (Recommended)

If the Continue Review team has created a GitHub App, the credentials can be embedded during the action's build process:

```bash
# During CI/CD build
CONTINUE_REVIEW_APP_ID=123456 \
CONTINUE_REVIEW_APP_PRIVATE_KEY="$(cat private-key.pem)" \
node build-config.js
```

Then users just need to:
1. Install the Continue Review App on their repository
2. Use the action normally - it will automatically use App authentication

### Option 2: Provide Your Own App Credentials

Users can provide their own GitHub App credentials:

```yaml
- name: Continue Review
  uses: continuedev/continue-review@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-config: 'myorg/myassistant'
    continue-org: 'myorg'
    app-id: ${{ secrets.MY_APP_ID }}
    app-private-key: ${{ secrets.MY_APP_PRIVATE_KEY }}
```

### Option 3: Use Token Authentication (Simplest)

No App setup needed, but comments will come from github-actions[bot]:

```yaml
- name: Continue Review
  uses: continuedev/continue-review@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-config: 'myorg/myassistant'
    continue-org: 'myorg'
    prefer-app-auth: 'false'  # Explicitly disable App auth
```

## Creating Your Own GitHub App

To create a GitHub App for this action:

1. Go to GitHub Settings → Developer settings → GitHub Apps → New GitHub App
2. Configure:
   - **Name**: Continue Review Bot (or your choice)
   - **Homepage URL**: Your repository URL
   - **Webhook**: Disabled
   - **Permissions**:
     - Pull requests: Write
     - Issues: Write
     - Contents: Read
     - Metadata: Read
3. Create the App and note the App ID
4. Generate a private key and save it securely
5. Install the App on your repositories

## Security Considerations

- **Never commit App private keys** to your repository
- Use GitHub Secrets for storing credentials
- The build-config.js script helps embed credentials securely during CI/CD
- Consider using environment-specific Apps (dev/staging/prod)

## Testing

To test with App authentication locally:

```bash
# Set environment variables
export CONTINUE_APP_ID=your-app-id
export CONTINUE_APP_PRIVATE_KEY="$(cat your-private-key.pem)"

# Run the action
npm install
npx tsx index.ts
```

## Troubleshooting

- **"GitHub App is not installed"**: Install the App on your repository
- **"Failed to authenticate as GitHub App"**: Check App ID and private key
- **Comments still from github-actions[bot]**: Ensure App auth is enabled and configured
- **Rate limiting**: App authentication provides higher rate limits

## How Comments Appear

- **With App Auth**: `YourAppName[bot] commented`
- **Without App Auth**: `github-actions[bot] commented`

This allows users to recognize official Continue Review comments vs other automation.