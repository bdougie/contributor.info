# Sentry MCP Server Setup Guide

## Overview
The Sentry MCP (Model Context Protocol) server provides AI-powered access to your Sentry data, enabling you to search events, issues, and manage your Sentry projects directly through Claude.

## Setup Instructions

### 1. Get Your Sentry User Auth Token

1. Go to your Sentry account settings: https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. Give it a descriptive name (e.g., "MCP Server Access")
4. Select the following scopes:
   - `org:read` - Read organization details
   - `project:read` - Read project details
   - `project:write` - Modify projects
   - `team:read` - Read team details
   - `team:write` - Modify teams
   - `event:write` - Create events (for testing)
5. Copy the generated token

### 2. Update MCP Configuration

Replace `YOUR_SENTRY_USER_AUTH_TOKEN` in `.mcp.json` with your actual token:

```json
"sentry": {
  "command": "npx",
  "args": [
    "-y",
    "@sentry/mcp-server@latest",
    "--access-token",
    "sntryu_YOUR_ACTUAL_TOKEN_HERE"
  ]
}
```

### 3. Optional: Enable AI-Powered Search

If you want to use natural language queries with Sentry (e.g., "show me all errors from last week"), you'll need an OpenAI API key:

1. Get an API key from https://platform.openai.com/api-keys
2. Add to your environment:
   ```bash
   export OPENAI_API_KEY=sk-...
   ```

### 4. Restart Claude Desktop

After updating `.mcp.json`, you need to restart Claude Desktop for the changes to take effect.

## Available Tools

Once configured, the Sentry MCP server provides these tools:

- **search_issues** - Search for issues using natural language or Sentry query syntax
- **search_events** - Search for events with AI-powered query translation
- **get_issue** - Get detailed information about a specific issue
- **update_issue** - Update issue status, assignment, etc.
- **create_issue** - Create new issues programmatically
- **get_project** - Get project configuration and stats
- **list_projects** - List all projects in your organization

## Example Usage

After setup, you can ask Claude things like:
- "Show me all unresolved errors from the last 24 hours"
- "What's the most frequent error in production?"
- "Mark issue #12345 as resolved"
- "Show me errors related to authentication"

## Security Notes

- Never commit your Sentry auth token to version control
- The token in `.mcp.json` is only accessible locally to Claude Desktop
- Consider using environment variables for tokens in shared environments

## Troubleshooting

If the MCP server fails to connect:
1. Verify your token has the correct permissions
2. Check that your Sentry organization allows API access
3. For self-hosted Sentry, add `--host=your-sentry-domain.com` to the args

## Current Configuration Status

⚠️ **Action Required**: Replace `YOUR_SENTRY_USER_AUTH_TOKEN` in `.mcp.json` with your actual Sentry token to enable the MCP server.