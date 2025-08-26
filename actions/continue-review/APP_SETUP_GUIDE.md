# Continue Agent Setup Guide

This guide will help you set up your own GitHub App for automated AI code reviews using Continue Agent in your repository.

## What is Continue Agent?

Continue Agent is a GitHub Action that provides AI-powered code reviews on your pull requests. It can:
- Review code changes automatically when PRs are opened
- Respond to manual review requests via `@continue-agent` comments
- Provide actionable feedback to improve code quality

## Quick Start

### Step 1: Create Your GitHub App

1. **Navigate to GitHub App Creation**
   - Go to GitHub Settings → Developer settings → GitHub Apps
   - Or directly visit: https://github.com/settings/apps/new

2. **Configure Basic Information**
   - **GitHub App name**: Choose a unique name (e.g., "YourOrg Continue Agent")
   - **Homepage URL**: Your organization URL or `https://github.com/your-org`
   - **Description**: "AI-powered code review agent for pull requests"

3. **Configure Permissions**
   
   Under **Repository permissions**, set:
   - **Contents**: Read (to read code changes)
   - **Issues**: Write (to post review comments)
   - **Pull requests**: Write (to post PR reviews)
   - **Metadata**: Read (automatically selected)

4. **Configure Events** (Optional)
   
   Subscribe to these events if you want webhook notifications:
   - Pull request
   - Issue comment

5. **Where can this GitHub App be installed?**
   - Choose "Only on this account" for organization-specific use
   - Choose "Any account" if you want to share with others

6. **Create the App**
   - Click "Create GitHub App"
   - You'll be redirected to your new App's settings page

### Step 2: Generate and Store Credentials

1. **Note Your App ID**
   - Find the "App ID" on your App's settings page
   - Save this number - you'll need it for configuration

2. **Generate a Private Key**
   - Scroll down to "Private keys" section
   - Click "Generate a private key"
   - A `.pem` file will download - keep this secure!

3. **Install the App on Your Repository**
   - On your App's settings page, click "Install App" in the left sidebar
   - Select your account/organization
   - Choose "All repositories" or select specific repositories
   - Click "Install"

### Step 3: Configure Repository Secrets and Variables

1. **Go to your repository settings**
   - Navigate to Settings → Secrets and variables → Actions

2. **Add Variables** (Click "Variables" tab)
   - Click "New repository variable"
   - Name: `CONTINUE_APP_ID`
   - Value: Your App ID from Step 2.1
   - Click "Add variable"

3. **Add Secrets** (Click "Secrets" tab)
   - Click "New repository secret"
   
   Add these secrets:
   
   **CONTINUE_APP_PRIVATE_KEY**:
   - Open the `.pem` file you downloaded
   - Copy the ENTIRE contents (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
   - Paste as the secret value
   
   **CONTINUE_API_KEY**:
   - Get from your Continue dashboard at https://continue.dev
   - Sign up if you haven't already
   - Generate an API key from settings

### Step 4: Configure Your Continue Agent

1. **Visit Continue Hub** at https://hub.continue.dev
2. **Create or select a review agent** (e.g., `your-username/code-reviewer`)
3. **Note your configuration**:
   - Organization name (your Continue username)
   - Agent path (e.g., `your-username/agent-name`)
   - Or use the default: `continuedev/review-bot`

### Step 5: Add the GitHub Workflow

Create `.github/workflows/continue-review.yml` in your repository:

```yaml
name: Continue Agent Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       github.event.issue.pull_request && 
       contains(github.event.comment.body, '@continue-agent'))
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better context
      
      # Generate GitHub App token for authentication
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0
        with:
          app-id: ${{ vars.CONTINUE_APP_ID }}
          private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
      
      # Run Continue Review with App authentication
      - name: Run Continue Review
        uses: bdougie/contributor.info/actions/continue-review@main
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'your-continue-org'  # Replace with your Continue org
          continue-config: 'your-org/your-agent'  # Replace with your agent path
```

## Usage

Once configured, the Continue Agent will:

1. **Automatically review PRs** when they're opened or updated
2. **Respond to manual triggers** when someone comments `@continue-agent` on a PR
3. **Post review comments** as your GitHub App (not as github-actions[bot])

### Manual Triggers

You can trigger a review manually by commenting on any PR:
- `@continue-agent review` - Triggers a full review
- `@continue-agent check [specific concern]` - Ask about specific aspects

## Verification

To verify your setup:

1. **Create a test PR** with a small code change
2. **Check the Actions tab** to see if the workflow runs
3. **Look for review comments** from your GitHub App

The comments will appear from your App (e.g., "YourOrg Continue Agent[bot]") instead of "github-actions[bot]".

## Customization

### Creating Custom Review Rules

Add `.continue/rules/*.md` files to your repository with review guidelines:

```markdown
---
globs: "**/*.{ts,tsx}"
description: "TypeScript standards"
---

# TypeScript Review Rules

- Use strict type checking
- No implicit any
- Prefer interfaces over types for objects
```

### Advanced Token Permissions

You can limit token permissions in the workflow:

```yaml
- name: Generate App Token
  id: app-token
  uses: actions/create-github-app-token@5d869da34e18e7287c1daad50e0b8ea0f506ce69 # v2.0.0
  with:
    app-id: ${{ vars.CONTINUE_APP_ID }}
    private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
    permissions: |
      contents: read
      pull-requests: write
      issues: write
```

## Security Best Practices

1. **Private Key Security**: Never commit the private key to your repository
2. **Rotate Keys Regularly**: Generate new private keys every 90 days
3. **Limit App Installation**: Only install on repositories that need it
4. **Use Variables for App ID**: App IDs aren't secret but using variables makes updates easier
5. **Monitor App Activity**: Check your App's "Advanced" tab for activity logs

## Troubleshooting

### Common Issues

1. **"App not installed" error**
   - Verify the App is installed on your repository (Settings → Integrations → GitHub Apps)
   - Check that the App has the correct permissions

2. **"Authentication failed"**
   - Verify `CONTINUE_APP_ID` variable is set correctly
   - Check that `CONTINUE_APP_PRIVATE_KEY` secret includes the full PEM content
   - Ensure the private key hasn't expired

3. **"No review posted"**
   - Check the Actions tab for workflow run logs
   - Verify your Continue API key is valid
   - Ensure the Continue agent configuration exists

4. **Private key format issues**
   - Make sure to copy the ENTIRE `.pem` file contents
   - Include the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
   - Don't add any extra spaces or newlines

### Debugging Steps

1. **Check workflow logs**: Go to Actions tab → Select the workflow run → View logs
2. **Verify App installation**: Settings → Integrations → GitHub Apps
3. **Test token generation**: The workflow logs will show if token generation succeeded
4. **Validate Continue API**: Test your API key at https://continue.dev

## Support

- Continue Documentation: https://docs.continue.dev
- GitHub Apps Documentation: https://docs.github.com/apps
- Action Source: https://github.com/bdougie/contributor.info/tree/main/actions/continue-review
- Discussions: https://github.com/continuedev/continue/discussions

## Benefits of Using Your Own GitHub App

- **Custom Branding**: Reviews appear from your organization's App
- **Access Control**: You control which repositories have access
- **Security**: Private keys are managed by your organization
- **Audit Trail**: All App activity is logged in your GitHub audit log
- **Flexibility**: Customize permissions and access as needed

## License

The Continue Review Action is available under the MIT License.