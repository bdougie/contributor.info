# Pull2Press Usage Guide

## Current State vs Ideal State

### Current State (Requires secrets in each repo)
```yaml
# Each repo needs CONTINUE_APP_ID and CONTINUE_APP_PRIVATE_KEY secrets
- uses: bdougie/contributor.info/actions/continue-review@main
  with:
    app-id: ${{ secrets.CONTINUE_APP_ID }}
    app-private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
```

### Ideal State (Just install the App, no secrets needed)
```yaml
# Once action is published with embedded credentials
- uses: continuedev/continue-review@v1
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-config: 'bdougie/reviewer'
```

## How to Achieve Ideal State

### For Action Maintainer (one-time setup):
1. Create the Continue Review GitHub App
2. Build action with embedded credentials:
   ```bash
   export CONTINUE_REVIEW_APP_ID=123456
   export CONTINUE_REVIEW_APP_PRIVATE_KEY="$(cat private-key.pem)"
   ./publish-action.sh
   ```
3. Publish to GitHub Marketplace or as a release

### For Users (like pull2press):
1. Install the Continue Review App on their repo
2. Add workflow without any App credentials:
   ```yaml
   name: Continue Review
   on:
     pull_request:
   jobs:
     review:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: continuedev/continue-review@v1
           with:
             continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
             continue-config: 'your-org/your-assistant'
             github-token: ${{ secrets.GITHUB_TOKEN }}
   ```

## Why Current Implementation Requires Secrets

The GitHub App private key is needed to:
1. Authenticate as the App
2. Get the installation ID for the repository
3. Generate an installation access token
4. Use that token to comment as the App

Without the private key embedded in the action OR provided via secrets, the action can't authenticate as the App, even if the App is installed.

## Recommendation for Pull2Press

Until the action is published with embedded credentials, you have two options:

1. **Use secrets** (current implementation):
   - Add `CONTINUE_APP_ID` and `CONTINUE_APP_PRIVATE_KEY` to your repo secrets
   - Comments will appear from your App

2. **Skip App auth** (simpler):
   - Don't provide app-id or app-private-key
   - Comments will appear from github-actions[bot]
   - No App installation needed