# Continue Agent Troubleshooting Guide

## Overview
The @continue-agent bot performs automated code reviews on pull requests when mentioned in comments. This guide helps diagnose and fix issues when the bot doesn't respond.

## Quick Checks

### 1. Verify GitHub App Configuration
- **App ID**: Check that `CONTINUE_APP_ID` is set as a repository variable
- **Private Key**: Ensure `CONTINUE_APP_PRIVATE_KEY` is set as a repository secret
- **Continue API Key**: Verify `CONTINUE_API_KEY` is set as a repository secret

```bash
# Check in repository settings:
# Settings → Secrets and variables → Actions
```

### 2. Check Workflow Runs
1. Go to the Actions tab in your repository
2. Look for "Continue Agent Code Review" workflow runs
3. Check if the workflow was triggered when you mentioned @continue-agent

### 3. Verify Bot Mention Format
The bot responds to mentions in this format:
```
@continue-agent
@continue-agent review this
@continue-agent focus on security
```

**Important**: The mention must be in a comment on a pull request, not on a regular issue.

## Common Issues and Solutions

### Issue: Workflow Doesn't Trigger

**Symptoms:**
- No workflow run appears when mentioning @continue-agent
- Workflow shows as "skipped"

**Solutions:**
1. Verify the comment is on a PR, not an issue
2. Check workflow permissions in repository settings
3. Ensure the workflow file exists in the default branch

### Issue: Bot Doesn't React with 👀

**Symptoms:**
- Workflow runs but no reaction appears on the comment

**Solutions:**
1. Check GitHub App token generation in workflow logs
2. Verify the App has write permissions for pull requests
3. Check for rate limiting issues

### Issue: Continue CLI Not Found

**Error Message:**
```
Continue CLI not found. Make sure @continuedev/cli is installed.
```

**Solutions:**
1. The action should auto-install the CLI
2. Check the action.yml file includes the installation step
3. Verify npm/node setup in the workflow

### Issue: Continue CLI Times Out

**Error Message:**
```
Continue CLI execution timed out after 7 minutes
```

**Solutions:**
1. Large PRs may take longer to review
2. Consider breaking PR into smaller chunks
3. Check Continue API service status

### Issue: No Review Posted

**Symptoms:**
- Workflow completes but no review comment appears

**Solutions:**
1. Check workflow logs for posting errors
2. Verify GitHub token has write permissions
3. Look for rate limiting on the repository

## Debugging Steps

### 1. Enable Debug Logging
The workflow now includes detailed debug logging. Check the workflow run logs for:
- Event trigger information
- Token generation status
- Continue CLI execution details
- Error messages and stack traces

### 2. Check Workflow Logs
```bash
# In the workflow run, expand these steps:
1. "Debug Workflow Trigger" - Shows event details
2. "Verify Token Generation" - Confirms App token creation
3. "Run Continue Review" - Main execution logs
```

### 3. Manual Testing
You can manually trigger the workflow:
1. Go to Actions → Continue Agent Code Review
2. Click "Run workflow"
3. Select the branch with your PR
4. Check the logs for any errors

### 4. Verify Secrets and Variables
```bash
# Required repository secrets:
CONTINUE_APP_PRIVATE_KEY  # GitHub App private key
CONTINUE_API_KEY          # Continue service API key

# Required repository variables:
CONTINUE_APP_ID           # GitHub App ID
```

## Error Messages Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `Required input missing: github-token` | Token not generated | Check App credentials |
| `Continue CLI not found` | CLI installation failed | Check action.yml setup |
| `Invalid webhook signature` | Wrong webhook secret | Verify webhook configuration |
| `Not a pull request comment` | Comment on issue, not PR | Use on PR comments only |
| `Comment does not mention @continue-agent` | Bot not mentioned | Include @continue-agent in comment |

## Testing the Fix

After making changes:

1. **Test on a PR comment:**
   ```
   @continue-agent please review this code
   ```

2. **Check for bot reaction:**
   - Should see 👀 reaction within seconds
   - Review should appear within 1-3 minutes

3. **Monitor workflow:**
   - Go to Actions tab
   - Watch the workflow run in real-time
   - Check logs if issues occur

## Getting Help

If issues persist after following this guide:

1. Check the [GitHub App setup documentation](./setup.md)
2. Review the [action implementation](../../actions/continue-review/index.ts)
3. Open an issue with:
   - Workflow run URL
   - Error messages from logs
   - Repository configuration details

## Related Documentation

- [GitHub App Setup](./setup.md)
- [Testing Webhooks](./test-webhook.md)
- [Continue Review Action](../../actions/continue-review/README.md)