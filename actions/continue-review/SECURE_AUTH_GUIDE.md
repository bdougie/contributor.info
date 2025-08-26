# Secure GitHub App Authentication Guide

## Overview

The Continue Review action supports multiple authentication methods. We **strongly recommend** using the secure GitHub App authentication pattern with `actions/create-github-app-token` for enhanced security and better token management.

## Recommended: Secure GitHub App Authentication

### Prerequisites

1. Create a GitHub App for your organization:
   - Go to Settings → Developer Settings → GitHub Apps
   - Create a new GitHub App with these permissions:
     - **Repository permissions:**
       - Contents: Read
       - Issues: Write
       - Pull requests: Write
     - **Subscribe to events:**
       - Pull request
       - Issue comment

2. Generate and store the private key:
   - In your GitHub App settings, generate a private key
   - Store it as a repository/organization secret: `CONTINUE_APP_PRIVATE_KEY`

3. Store the App ID:
   - Find your App ID in the GitHub App settings
   - Store it as a repository/organization variable: `CONTINUE_APP_ID`

4. Install the App on your repositories:
   - In the GitHub App settings, click "Install App"
   - Select the repositories where you want to use Continue Review

### Implementation

```yaml
name: Continue Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Generate a GitHub App installation token
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.CONTINUE_APP_ID }}
          private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}

      # Use Continue Review with the App token
      - name: Continue Review
        uses: bdougie/contributor.info/actions/continue-review@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'your-org'
          continue-config: 'your-org/review-assistant'
          app-token-generated: 'true'  # Indicates using pre-generated token
          disable-embedded-auth: 'true'  # Disable legacy authentication

```

## Security Benefits

### 🔐 Enhanced Security
- Private keys stored securely in GitHub Secrets (encrypted at rest)
- No credentials embedded in action code
- Tokens generated fresh for each workflow run
- Industry-standard authentication pattern

### 🔄 Easy Key Rotation
- Update secrets without modifying code
- Rotate keys instantly across all workflows
- No action rebuilds required

### 📊 Better Audit Trail
- Complete GitHub audit logs for App activities
- Track token usage and permissions
- Monitor App installations and access

### ⚡ Performance Benefits
- Faster authentication (no embedded decryption)
- Reduced action size and complexity
- Better caching and reusability

## Migration from Legacy Authentication

If you're currently using the Continue Review action without explicit App configuration, follow these steps:

### Step 1: Create GitHub App
Follow the prerequisites above to create and configure your GitHub App.

### Step 2: Update Workflow
Modify your workflow to use the secure authentication pattern:

**Before (Legacy):**
```yaml
- name: Continue Review
  uses: bdougie/contributor.info/actions/continue-review@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: 'your-org'
    continue-config: 'your-org/review-assistant'
```

**After (Secure):**
```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.CONTINUE_APP_ID }}
    private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}

- name: Continue Review
  uses: bdougie/contributor.info/actions/continue-review@main
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: 'your-org'
    continue-config: 'your-org/review-assistant'
    app-token-generated: 'true'
    disable-embedded-auth: 'true'
```

### Step 3: Test and Verify
1. Create a test pull request
2. Verify that comments appear from your GitHub App
3. Check workflow logs for security warnings (should be none)

## Advanced Configuration

### Token Permissions Scoping
You can limit the token permissions for specific operations:

```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.CONTINUE_APP_ID }}
    private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
    permissions: |
      contents: read
      pull-requests: write
      issues: write
```

### Multi-Repository Support
For organizations with many repositories:

```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.CONTINUE_APP_ID }}
    private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
    repositories: |
      repo1
      repo2
      repo3
```

## Troubleshooting

### App Not Installed Error
If you see "GitHub App is not installed" errors:
1. Verify the App is installed on the repository
2. Check App installation settings in GitHub
3. Ensure the App has required permissions

### Authentication Failures
If authentication fails:
1. Verify the App ID is correct
2. Check that the private key secret is properly formatted
3. Ensure the private key hasn't expired

### Token Permission Issues
If the action lacks permissions:
1. Review the App's permission configuration
2. Check if permissions are limited in the workflow
3. Verify repository settings allow App access

## Security Considerations

### ✅ DO
- Store private keys in GitHub Secrets
- Rotate keys regularly (every 90 days recommended)
- Use repository/organization variables for App IDs
- Enable audit logging for security monitoring
- Limit App permissions to minimum required

### ❌ DON'T
- Commit private keys to repositories
- Share App credentials across organizations
- Use personal access tokens when Apps are available
- Disable security warnings in workflows
- Use the legacy embedded authentication

## Support

For issues or questions:
- Open an issue: [contributor.info/issues](https://github.com/bdougie/contributor.info/issues)
- Security concerns: Report privately via GitHub Security tab
- Documentation: [Continue Review README](README.md)

## Deprecation Timeline

- **Current**: Both authentication methods supported
- **March 2025**: Deprecation warnings for embedded auth
- **June 2025**: Embedded authentication removed

Please migrate to the secure authentication pattern as soon as possible.