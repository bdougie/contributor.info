# How Continue Review GitHub App Authentication Works

## Architecture

The Continue Review action uses **GitHub App authentication** via the official `actions/create-github-app-token` action:

1. **App Credentials**: Stored securely in GitHub Secrets and Variables
   - App ID stored as a GitHub Variable (public information)
   - Private key stored as a GitHub Secret (encrypted at rest)
   - No credentials embedded in action code

2. **Token Generation**: Uses GitHub's recommended pattern
   - Workflow generates App token using `actions/create-github-app-token`
   - Token is passed to Continue Review action
   - Fresh token generated for each workflow run

3. **Cross-Repository Usage**: Works on any repo where the App is installed
   - Each repository manages its own App credentials
   - Comments appear from your GitHub App (not github-actions[bot])

## Setup Process

### For any repository using Continue Review:

1. **Create a GitHub App**
   - Go to Settings → Developer settings → GitHub Apps
   - Create new App with required permissions:
     - Contents: Read
     - Issues: Write
     - Pull requests: Write
   - Generate and download private key

2. **Configure repository secrets/variables**:
   ```
   Variables:
   - CONTINUE_APP_ID: Your App ID
   
   Secrets:
   - CONTINUE_APP_PRIVATE_KEY: Your App private key (entire .pem file)
   - CONTINUE_API_KEY: Your Continue API key
   ```

3. **Install the App** on your repository

4. **Use in workflow**:
   ```yaml
   - name: Generate App Token
     id: app-token
     uses: actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0
     with:
       app-id: ${{ vars.CONTINUE_APP_ID }}
       private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
   
   - uses: bdougie/contributor.info/actions/continue-review@main
     with:
       github-token: ${{ steps.app-token.outputs.token }}
       continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
       continue-org: 'your-org'
       continue-config: 'your-org/your-bot'
   ```

## How Authentication Flows

### When the workflow runs:
1. `actions/create-github-app-token` generates a fresh App installation token
2. Token is passed to Continue Review action
3. Continue Review uses the token for all GitHub API calls
4. Comments appear from your GitHub App

## Benefits

- **Security**: Private keys stored in GitHub Secrets, never in code
- **Industry Standard**: Uses GitHub's recommended authentication pattern
- **Easy Key Rotation**: Update secrets without changing code
- **Audit Trail**: Full GitHub audit logs for App activities
- **Fresh Tokens**: New token generated for each workflow run

## Testing

To verify it's working:
1. Check PR comments - they should show as from your App (not github-actions[bot])
2. Look for "Using provided GitHub token" in workflow logs
3. Verify the App has proper permissions on target repositories
4. Check Actions tab for successful token generation

## Troubleshooting

### Common Issues

1. **App not installed**: Verify the App is installed on your repository
2. **Invalid credentials**: Check App ID and private key are correctly set
3. **Permission errors**: Ensure App has required permissions
4. **Token generation fails**: Verify private key includes full PEM content