# Repository Tracking Alerts Configuration

This document describes how to configure alerts for repository tracking in Sentry and PostHog.

## Overview

The tracking alerts system captures events that enable proactive monitoring of repository tracking operations. This allows us to catch issues before users report them.

**Events Captured:**
- `repository_tracking_attempt` - User initiates tracking
- `repository_tracking_completed` - Tracking succeeds
- `repository_tracking_failed` - Tracking fails
- `repository_tracking_timeout` - Polling times out
- `repository_tracking_api_error` - API returns error
- `repository_tracking_inngest_failure` - Inngest event fails

## Sentry Alerts

### 1. Critical: Tracking API 5xx Errors

Alert when tracking API returns server errors.

**Configuration:**
1. Go to Sentry > Alerts > Create Alert
2. Select "Issue Alert"
3. Configure:
   - **Filter:** `tags.type:tracking_api_error AND tags.is_server_error:true`
   - **Conditions:** When an event is first seen
   - **Actions:**
     - Send notification to Slack #alerts-critical
     - Send email to on-call
   - **Rate limit:** 1 alert per 5 minutes

**Alert Rule Query:**
```
event.type:error tags.alert_category:repository_tracking tags.is_server_error:true
```

### 2. Warning: Inngest Event Failures > 5 in 1 Hour

Alert when Inngest events fail repeatedly.

**Configuration:**
1. Go to Sentry > Alerts > Create Alert
2. Select "Metric Alert"
3. Configure:
   - **Metric:** Count of events
   - **Filter:** `tags.type:inngest_event_failure`
   - **Threshold:** > 5 events in 1 hour
   - **Actions:**
     - Send notification to Slack #alerts-warning
   - **Critical threshold:** > 15 events in 1 hour

**Alert Rule Query:**
```
event.type:error tags.alert_type:inngest_failure
```

### 3. Warning: Polling Timeout Rate > 10%

Alert when too many tracking attempts time out.

**Configuration:**
1. Go to Sentry > Alerts > Create Alert
2. Select "Metric Alert"
3. Configure:
   - **Metric:** Count of events with `tags.alert_type:polling_timeout`
   - **Time window:** 24 hours
   - **Threshold:** Alert when count exceeds 10% of total tracking attempts
   - **Actions:**
     - Send notification to Slack #alerts-warning

**Note:** This requires comparing timeout events against total tracking attempts.
Consider using a custom metric or comparing against PostHog data.

## PostHog Alerts

### 1. Warning: Success Rate Below 80%

Alert when tracking success rate drops.

**Configuration:**
1. Go to PostHog > Insights > Create Insight
2. Create a Funnel or Trend:
   - **Events:**
     - `repository_tracking_attempt` (A)
     - `repository_tracking_completed` (B)
   - **Formula:** `B / A * 100` (success rate)
3. Create Alert:
   - **Threshold:** < 80%
   - **Time window:** Last 24 hours
   - **Minimum events:** 10 (to avoid false positives)

**Alternative: Custom Insight**
```sql
SELECT
  countIf(event = 'repository_tracking_completed') /
  countIf(event = 'repository_tracking_attempt') * 100 as success_rate
FROM events
WHERE
  timestamp > now() - INTERVAL 24 HOUR
  AND event IN ('repository_tracking_attempt', 'repository_tracking_completed')
```

### 2. Info: Daily Digest of Top 10 Tracked Repos

Get visibility into what repositories users are trying to track.

**Configuration:**
1. Go to PostHog > Insights > Create Insight
2. Create a Breakdown:
   - **Event:** `repository_tracking_attempt`
   - **Breakdown by:** `repository` property
   - **Time range:** Last 24 hours
   - **Limit:** Top 10
3. Schedule Report:
   - **Frequency:** Daily
   - **Recipients:** team@contributor.info
   - **Time:** 9:00 AM

**HogQL Query:**
```sql
SELECT
  properties.repository as repository,
  count() as attempts,
  countIf(event = 'repository_tracking_completed') as successes
FROM events
WHERE
  timestamp > now() - INTERVAL 24 HOUR
  AND event IN ('repository_tracking_attempt', 'repository_tracking_completed')
GROUP BY properties.repository
ORDER BY attempts DESC
LIMIT 10
```

## Event Schema Reference

### repository_tracking_attempt
```json
{
  "event": "repository_tracking_attempt",
  "properties": {
    "repository": "owner/repo",
    "owner": "owner",
    "repo": "repo",
    "timestamp": "2025-01-15T00:00:00Z"
  }
}
```

### repository_tracking_completed
```json
{
  "event": "repository_tracking_completed",
  "properties": {
    "repository": "owner/repo",
    "owner": "owner",
    "repo": "repo",
    "repository_id": "uuid",
    "duration_ms": 5000,
    "source": "user_initiated",
    "success": true,
    "timestamp": "2025-01-15T00:00:00Z"
  }
}
```

### repository_tracking_failed
```json
{
  "event": "repository_tracking_failed",
  "properties": {
    "repository": "owner/repo",
    "owner": "owner",
    "repo": "repo",
    "error_type": "api_error|timeout|inngest_failure|validation_error|unknown",
    "error_message": "Error description",
    "duration_ms": 5000,
    "success": false,
    "timestamp": "2025-01-15T00:00:00Z"
  }
}
```

### repository_tracking_timeout
```json
{
  "event": "repository_tracking_timeout",
  "properties": {
    "repository": "owner/repo",
    "owner": "owner",
    "repo": "repo",
    "poll_count": 60,
    "max_polls": 60,
    "poll_duration_ms": 120000,
    "timeout_occurred": true,
    "timestamp": "2025-01-15T00:00:00Z"
  }
}
```

## Sentry Tags Reference

| Tag | Description | Values |
|-----|-------------|--------|
| `alert_category` | Category for grouping | `repository_tracking` |
| `alert_type` | Specific alert type | `polling_timeout`, `inngest_failure` |
| `type` | Error type | `tracking_api_error`, `tracking_polling_timeout`, etc. |
| `is_server_error` | Is 5xx error | `true`, `false` |
| `error_type` | Classification | `api_error`, `timeout`, `inngest_failure`, etc. |

## Success Metrics

1. **Notification within 5 minutes of failures** - Achieved via Sentry real-time alerts
2. **Tracking completion rate >95%** - Monitored via PostHog success rate insight
3. **Mean time from alert to fix <4 hours** - Track in incident management system

## Maintenance

- Review alert thresholds monthly
- Update documentation when new events are added
- Archive alerts that become noise (tune thresholds)
- Monitor alert fatigue - too many alerts reduces effectiveness
