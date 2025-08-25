# How Continue Review GitHub App Authentication Works

## Architecture

The Continue Review action uses **embedded App authentication**:

1. **App Credentials**: Encrypted and embedded in the action code
   - Credentials are encrypted using AES-256 for obfuscation
   - Built into `app-config-encrypted.ts` during build process

2. **Token Generation**: Happens automatically in the action
   - Action checks if Continue Agent App is installed on the repo
   - Generates installation token if App is found
   - Falls back to provided GitHub token if not

3. **Cross-Repository Usage**: Works on any repo where the App is installed
   - No credentials needed in target repositories
   - Comments appear from Continue Agent App automatically

## Setup Process

### In contributor.info (this repo):

1. Create the Continue Agent GitHub App
2. Build the embedded credentials into the action:
   ```bash
   CONTINUE_APP_ID=123456 \
   CONTINUE_APP_PRIVATE_KEY="$(cat private-key.pem)" \
   npx tsx build-embedded-auth.ts
   ```
3. Commit the updated `app-config-encrypted.ts` file
4. Add `CONTINUE_API_KEY` secret to the repository

### In pull2press (or any other repo):

1. Install the Continue Agent App on the repository
2. Use the action in workflow (no changes needed):
   ```yaml
   - uses: bdougie/contributor.info/actions/continue-review@main
     with:
       continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
       github-token: ${{ secrets.GITHUB_TOKEN }}
       continue-config: 'your-org/your-bot'
       continue-org: 'your-org'
   ```
3. Comments automatically appear from Continue Agent App!

## How Authentication Flows

### When used from any repository:
1. Action checks if Continue Agent App is installed on the repo
2. If installed, uses embedded credentials to generate App token
3. Comments appear from Continue Agent App
4. If not installed, falls back to provided GitHub token
5. Fallback comments appear from github-actions[bot]

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