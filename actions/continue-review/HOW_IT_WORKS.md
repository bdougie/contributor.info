# How Continue Review GitHub App Authentication Works

## Architecture

The Continue Review action uses a **centralized App authentication** approach:

1. **App Credentials**: Stored as secrets in `contributor.info` repository
   - `CONTINUE_APP_ID`: The GitHub App ID
   - `CONTINUE_APP_PRIVATE_KEY`: The App's private key (.pem file)

2. **Token Generation**: Happens in the workflow, not in the action
   - The workflow generates an App installation token
   - Passes it to the action as `github-token`

3. **Cross-Repository Usage**: Works on any repo where the App is installed
   - No credentials needed in target repositories
   - Just reference the action from contributor.info

## Setup Process

### In contributor.info (this repo):

1. Create the Continue Review GitHub App
2. Add secrets to the repository:
   ```
   CONTINUE_APP_ID=123456
   CONTINUE_APP_PRIVATE_KEY=<contents of .pem file>
   CONTINUE_API_KEY=<your Continue API key>
   ```

3. The workflow automatically generates App tokens when available

### In pull2press (or any other repo):

1. Install the Continue Review App on the repository
2. Use the action in workflow:
   ```yaml
   - uses: bdougie/contributor.info/actions/continue-review@main
     with:
       continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
       github-token: ${{ secrets.GITHUB_TOKEN }}
       continue-config: 'your-org/your-bot'
       continue-org: 'your-org'
   ```

## How Authentication Flows

### When used from contributor.info:
1. Workflow checks for `CONTINUE_APP_ID` and `CONTINUE_APP_PRIVATE_KEY` secrets
2. If present, generates an App installation token
3. Passes App token to the action
4. Comments appear from the Continue Review App

### When used from other repos (like pull2press):
1. They pass `GITHUB_TOKEN` to the action
2. Action uses that token for API calls
3. Comments appear from github-actions[bot]
4. (Unless they also set up their own App credentials)

## Benefits

- **Centralized Management**: App credentials only in contributor.info
- **Easy Adoption**: Other repos just install the App and use the action
- **Flexible**: Can work with or without App authentication
- **Secure**: Private keys never leave the source repository

## Testing

To verify it's working:
1. Check PR comments - they should show as from your App (not github-actions[bot])
2. Look for "Using App token" in workflow logs
3. Verify the App has proper permissions on target repositories