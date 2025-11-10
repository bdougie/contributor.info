# Slack Integration: Issue Assignee Reports

Send automated issue assignee distribution reports to Slack channels on a scheduled basis.

## Overview

The Slack integration allows workspace owners and admins to configure automated reports that show:
- Top assignees by issue count
- Number of open issues per assignee
- Number of repositories each assignee works across
- Total open issues in the workspace

Reports are sent on a configurable schedule (daily or weekly) to specified Slack channels.

## Setup Guide

### 1. Create a Slack Incoming Webhook

1. Go to your Slack workspace
2. Navigate to **Apps** > **Manage** > **Custom Integrations**
3. Click on **Incoming Webhooks**
4. Click **Add to Slack**
5. Select the channel where you want reports sent
6. Click **Add Incoming WebHooks Integration**
7. Copy the **Webhook URL** (looks like `https://hooks.slack.com/services/...`)

**Alternative Method** (Slack Apps):
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** > **From scratch**
3. Name your app and select your workspace
4. Under **Incoming Webhooks**, toggle **Activate Incoming Webhooks** to **On**
5. Click **Add New Webhook to Workspace**
6. Select the channel and authorize
7. Copy the generated webhook URL

### 2. Configure in Contributor.info

1. Navigate to your workspace settings
2. Scroll to the **Slack Integration** section
3. Click **Add Slack Integration**
4. Fill in the form:
   - **Channel Name**: A display name for this integration (e.g., "engineering-updates")
   - **Slack Webhook URL**: Paste the webhook URL from step 1
   - **Schedule**: Choose daily or weekly
   - **Exclude bots**: Toggle to filter out bot assignees
   - **Maximum Assignees**: Set the number of top assignees to show (default: 10)
5. Click **Create Integration**

### 3. Test the Integration

1. After creating the integration, click **Test Connection**
2. Check your Slack channel for a test message
3. If successful, your integration is ready to go!

## Configuration Options

### Schedule
- **Daily**: Reports sent every day at 9:00 AM UTC
- **Weekly**: Reports sent every Monday at 9:00 AM UTC

### Filters
- **Exclude bots**: Filter out assignees that match bot patterns (e.g., `dependabot`, `renovate`)
- **Max assignees**: Limit the number of assignees shown in the report (1-50)
- **Repository filter**: (Coming soon) Select specific repositories to include

### Multiple Integrations
You can create multiple integrations for different Slack channels with different configurations:
- Engineering team: Daily reports, exclude bots, top 10 assignees
- Leadership: Weekly reports, include all, top 5 assignees
- Specific project: Daily reports for specific repositories only

## Report Format

Reports are sent as rich Slack messages with the following structure:

```
📊 Issue Assignee Report - [Workspace Name]
Total Open Issues: 45
Active Assignees: 8

1. alice
   📝 15 issues · 📦 3 repos

2. bob
   📝 12 issues · 📦 2 repos

[...more assignees...]

Generated on [timestamp] | View Workspace
```

## Troubleshooting

### No reports being sent

**Check the integration status:**
1. Go to workspace settings > Slack Integration
2. Verify the integration is **Enabled**
3. Check the **Next scheduled** time
4. Look for any failure badges

**Common issues:**
- Webhook URL is incorrect or expired
- Slack app was uninstalled or permissions revoked
- No open issues or assignees in the workspace

### Test connection fails

**Verify webhook URL:**
1. Make sure the URL starts with `https://hooks.slack.com/services/`
2. Check that there are no extra spaces or characters
3. Test the webhook manually using curl:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test message"}' \
     YOUR_WEBHOOK_URL
   ```

**Check Slack app status:**
1. Verify the Slack app is still installed
2. Confirm the app has permission to post to the channel
3. Try creating a new webhook URL

### Integration shows failures

**View logs:**
1. Check the integration card for the failure count badge
2. Contact support if failures persist after fixing configuration

**Common causes:**
- Slack channel was deleted or archived
- Webhook URL was rotated/changed in Slack
- Temporary Slack API issues

## Security Considerations

### Webhook URL Encryption
- Webhook URLs are encrypted before being stored in the database
- Encryption uses AES-GCM with a 256-bit key
- Only the application can decrypt webhook URLs
- Never share your webhook URL publicly

### Access Control
- Only workspace owners and admins can configure integrations
- All workspace members can view integration status
- Integration activity is logged for audit purposes

### Data Sharing
- Reports only include public repository data
- Assignee usernames and issue counts are shared
- No issue titles, descriptions, or sensitive content is included
- GDPR compliance logging tracks all data sharing events

## Environment Variables

Required for Slack integration to work:

```bash
# Encryption key for webhook URLs (32+ characters recommended)
# Generate with: openssl rand -base64 32
VITE_SLACK_WEBHOOK_ENCRYPTION_KEY=your-encryption-key-here
```

**Important**:
- Generate a secure random key in production
- Never commit this key to version control
- Rotate the key periodically for security
- If you rotate the key, existing integrations will need to be reconfigured

## API Reference

### Database Tables

**`slack_integrations`**
- Stores Slack integration configurations per workspace
- Includes encrypted webhook URLs and schedule settings
- Tracks last send time and next scheduled time

**`integration_logs`**
- Audit trail of all Slack message sends
- Records success/failure status and error details
- Stores metadata about each report sent

### RPC Function

The integration uses the existing `calculate_assignee_distribution` RPC function:

```sql
SELECT * FROM calculate_assignee_distribution(
  p_repository_ids := ARRAY['repo-uuid-1', 'repo-uuid-2'],
  p_exclude_bots := true,
  p_limit := 10
);
```

Returns:
- `login`: Assignee username
- `avatar_url`: Profile picture URL
- `issue_count`: Number of open issues assigned
- `repository_count`: Number of repositories worked across

### Inngest Function

**`send-slack-assignee-report-cron`**
- Runs daily at 9:00 AM UTC
- Finds all enabled integrations due for sending
- Fetches assignee data and formats Slack messages
- Logs all send attempts and updates next scheduled time

## Best Practices

### Scheduling
- **Daily reports**: Best for active teams making frequent changes
- **Weekly reports**: Better for high-level overview and less noise
- Align schedule with team meetings (e.g., weekly report on Monday morning)

### Channel Selection
- Use dedicated channels for reports (e.g., `#workspace-reports`)
- Avoid noisy channels where reports might get missed
- Consider separate channels for different report types

### Configuration
- Start with daily reports, adjust based on feedback
- Use exclude bots to focus on human contributors
- Adjust max assignees based on team size (5-15 typically works well)

### Monitoring
- Check integration status weekly
- Review failure logs if problems occur
- Test connection after making Slack workspace changes

## Future Enhancements

Potential improvements being considered:
- Repository filtering by selection
- Custom time ranges (7d, 30d, 90d)
- Additional metrics (PR count, review activity)
- Custom message templates
- Microsoft Teams support
- Discord integration
- Manual trigger button for on-demand reports

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review integration logs in workspace settings
3. Create an issue on GitHub with relevant log details
4. Contact support with your workspace ID for assistance
