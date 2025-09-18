# PostHog Session Recording Documentation

## Overview

PostHog session recording is configured to capture user interactions when they encounter untracked repositories in the application. This helps us understand user behavior and improve the repository tracking experience.

## Configuration

### Environment Variables

```bash
VITE_POSTHOG_KEY=phc_xxx...  # PostHog API key
VITE_POSTHOG_HOST=https://us.i.posthog.com  # PostHog host URL
```

### Privacy Settings

Session recordings are configured with privacy-first defaults:

- **Input Masking**: All input fields are automatically masked to protect sensitive data
- **Sensitive Text**: Elements with class `.sensitive` have their text content masked
- **Blocked Elements**: Elements with class `.no-record` are completely excluded from recordings
- **Network Activity**: Request/response headers and bodies are NOT recorded
- **Canvas Elements**: Not recorded for performance reasons

## Repository Tracking Events

The following events are tracked when users interact with untracked repositories:

### 1. `viewed_track_repository_prompt`
Fired when the "Track This Repository" card is displayed.

**Properties:**
- `repository`: Full repository path (e.g., "apache/spark")
- `owner`: Repository owner
- `repo`: Repository name
- `isLoggedIn`: User authentication status
- `timestamp`: ISO timestamp
- `page_url`: Full URL
- `page_path`: URL path

### 2. `clicked_login_to_track_repository`
Fired when user clicks the login button on the tracking card.

**Properties:**
- `repository`: Full repository path
- `owner`: Repository owner
- `repo`: Repository name
- `timestamp`: ISO timestamp

### 3. `clicked_track_repository`
Fired when user clicks the "Track This Repository" button.

**Properties:**
- `repository`: Full repository path
- `owner`: Repository owner
- `repo`: Repository name
- `timestamp`: ISO timestamp

### 4. `repository_tracking_initiated`
Fired when repository tracking successfully starts.

**Properties:**
- `repository`: Full repository path
- `owner`: Repository owner
- `repo`: Repository name
- `eventId`: Tracking event ID
- `timestamp`: ISO timestamp

### 5. `repository_tracking_failed`
Fired when repository tracking fails.

**Properties:**
- `repository`: Full repository path
- `owner`: Repository owner
- `repo`: Repository name
- `error`: Error message
- `timestamp`: ISO timestamp

### 6. `repository_data_ready`
Fired when repository data becomes available after tracking.

**Properties:**
- `repository`: Full repository path
- `owner`: Repository owner
- `repo`: Repository name
- `pollAttempts`: Number of polling attempts before data was ready
- `timestamp`: ISO timestamp

## Implementation Details

### File Locations

- **Configuration**: `src/lib/posthog-lazy.ts`
- **Event Tracking**: `src/components/features/repository/repository-tracking-card.tsx`

### Key Features

1. **Lazy Loading**: PostHog is loaded on-demand to minimize bundle size
2. **Rate Limiting**: Events are rate-limited to prevent spam (60/minute, 1000/hour)
3. **User Filtering**: Internal users (bdougie account) are automatically filtered
4. **Development Mode**: Disabled by default in development, can be enabled for testing

## Development Testing

### Enable in Development

PostHog is disabled by default in development. To enable for testing:

```javascript
// In browser console
localStorage.setItem('enablePostHogDev', 'true');
location.reload();
```

### Disable in Development

```javascript
// In browser console
localStorage.removeItem('enablePostHogDev');
location.reload();
```

### Verify Session Recording

1. Enable PostHog in development (see above)
2. Visit an untracked repository (e.g., `/apache/spark`)
3. Check browser console for event tracking
4. Visit PostHog dashboard to view recordings

## PostHog Dashboard

### Viewing Session Recordings

1. Go to [PostHog Dashboard](https://us.i.posthog.com)
2. Navigate to "Session Recordings"
3. Filter by event: `viewed_track_repository_prompt`
4. Click on a recording to watch the session

### Filtering Options

You can filter recordings by:
- **Event Name**: Use `viewed_track_repository_prompt` to find repository tracking sessions
- **Date Range**: Focus on specific time periods
- **User Properties**: Filter by login status, etc.
- **Page URL**: Find recordings for specific repositories

### Analytics Insights

Use the Events tab to analyze:
- How many users encounter untracked repositories
- Conversion rate from viewing to tracking
- Which repositories users want to track most
- Drop-off points in the tracking flow

## Security Considerations

1. **No Secrets in Console**: All debug logging is removed in production
2. **API Key Validation**: PostHog API keys are validated before use
3. **User Privacy**: Personal data is masked in recordings
4. **Opt-Out Support**: Users can opt out via `localStorage.setItem('posthog_opt_out', 'true')`

## Troubleshooting

### Session Recording Not Working

1. **Check API Key**: Ensure `VITE_POSTHOG_KEY` is set correctly
2. **Verify Host**: Confirm `VITE_POSTHOG_HOST` points to correct PostHog instance
3. **Browser Console**: Check for any PostHog-related errors
4. **Network Tab**: Verify requests to PostHog are succeeding

### Events Not Appearing

1. **Rate Limiting**: Check if rate limits are being hit
2. **User Filtering**: Ensure you're not logged in as an internal user
3. **Development Mode**: Verify PostHog is enabled if testing locally
4. **Network Issues**: Check browser network tab for failed requests

## Best Practices

1. **Sensitive Data**: Always use `.sensitive` class for elements containing PII
2. **Blocked Content**: Use `.no-record` class for elements that shouldn't be recorded
3. **Event Properties**: Keep event properties minimal and non-sensitive
4. **Testing**: Always test in development before deploying to production

## Related Documentation

- [PostHog Strategy](./posthog-strategy.md)
- [Analytics Overview](../analytics/README.md)
- [Manual Repository Tracking](../data-fetching/manual-repository-tracking.md)