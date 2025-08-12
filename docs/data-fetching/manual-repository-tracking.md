# Manual Repository Tracking System

## Overview

As of January 2025, Contributor.info uses a **manual, user-initiated repository tracking system** instead of automatic discovery. This provides users with explicit control over which repositories are tracked and improves transparency about data collection.

## User Flow

### 1. Untracked Repository Visit
When a user visits a repository page that isn't tracked:
- The system checks if the repository exists in the database
- If not found, displays a **Repository Tracking Card** with options to track

### 2. Repository Tracking Card
The card displays different states based on authentication:

#### Authenticated Users
- See a **"Track This Repository"** button
- Clicking triggers the discovery and sync process
- Repository data starts populating immediately

#### Unauthenticated Users  
- See a **"Login to Track Repository"** button
- OAuth flow keeps them on the current page after login
- Can then track the repository post-authentication

### 3. Discovery Process
When a user clicks "Track This Repository":
1. Frontend sends request to `/api/track-repository` endpoint
2. Endpoint validates authentication and repository details
3. Sends `discover/repository.new` event to Inngest
4. Inngest function:
   - Fetches repository metadata from GitHub
   - Creates repository record in database
   - Adds to tracked repositories
   - Triggers initial data sync
   - Triggers size classification

## Technical Implementation

### Key Components

#### Frontend
- **`RepositoryTrackingCard`** (`src/components/features/repository/repository-tracking-card.tsx`)
  - Displays tracking UI for untracked repositories
  - Handles authentication flow
  - Shows loading/error states

- **`useRepositoryTracking`** hook (`src/hooks/use-repository-tracking.ts`)
  - Manages repository tracking state
  - Handles API calls for tracking
  - Provides tracking status updates

#### Backend
- **Tracking API Endpoint** (`netlify/functions/api-track-repository.mts`)
  - ES module format for compatibility with `"type": "module"` in package.json
  - Authenticates user requests
  - Validates repository parameters
  - Sends discovery events to Inngest
  - Automatically detects local vs production environment

- **Discovery Function** (`src/lib/inngest/functions/discover-new-repository.ts`)
  - Fetches GitHub repository data
  - Creates database records
  - Triggers follow-up processes

### Database Schema

```sql
-- Repositories table stores basic repository information
repositories (
  id, github_id, owner, name, description, ...
)

-- Tracked repositories stores tracking metadata
tracked_repositories (
  repository_id, organization_name, repository_name, 
  tracking_enabled, priority, added_by_user_id, ...
)
```

## Error Handling

The system handles various error scenarios:

1. **Repository Not Found on GitHub**: Shows error message to user
2. **Already Tracked**: Triggers sync for existing repository
3. **Authentication Failed**: Redirects to login flow
4. **Rate Limits**: Queues for later processing
5. **Network Errors**: Shows retry option to user

## Benefits of Manual Tracking

1. **User Control**: Users explicitly choose which repositories to track
2. **Transparency**: Clear indication of tracking status
3. **Performance**: Reduces unnecessary API calls and database operations
4. **Privacy**: Respects user intent and data minimization principles
5. **Debugging**: Easier to trace issues with explicit user actions

## Migration from Auto-Tracking

The previous auto-tracking system has been completely removed:
- Removed `useAutoTrackRepository` hook
- Removed `auto-track-on-404.ts` 
- Removed automatic discovery triggers
- All tracking now requires explicit user action

## Configuration

### Environment Variables
The system uses existing environment variables:
- `VITE_SUPABASE_URL`: Database connection
- `VITE_SUPABASE_ANON_KEY`: Public database key
- `GITHUB_TOKEN`: For fetching repository data
- `INNGEST_EVENT_KEY`: For sending background job events

### Local Development
For local development, the system automatically detects and routes to local Inngest:
- Set `INNGEST_EVENT_KEY=local_development_only` in `.env`
- Events will be sent to `http://localhost:8288` instead of production
- No production events will be triggered during local testing

## Testing

To test the tracking flow locally:

```bash
# Start the development environment (includes Inngest)
npm start

# This starts:
# - Vite dev server on port 5174
# - Netlify dev server on port 8888
# - Inngest dev server on port 8288

# Visit an untracked repository
# Example: http://localhost:8888/some-org/some-repo

# Monitor Inngest events at:
# http://localhost:8288/events
```

## Monitoring

Track success rates through:
- Inngest dashboard for discovery function execution
- Supabase logs for database operations
- Browser console for frontend tracking events
- Netlify function logs for API endpoint calls

## Future Improvements

Potential enhancements:
- Bulk repository tracking
- Organization-level tracking
- Tracking quotas per user
- Tracking history and audit logs
- Webhook-based automatic updates for tracked repos