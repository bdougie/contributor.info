# Discovery architecture

## Overview

Repository discovery provides automatic setup for new repositories with zero user friction. The system prioritizes immediate cached data display and background processing for new repositories.

## Architecture

```
User visits /owner/repo
       ↓
useRepositoryDiscovery hook
       ↓
Check database for repository
       ↓
   Found? → Show cached data (ready state)
       ↓
   Not found? → Trigger discovery API
       ↓
/api/discover-repository endpoint
       ↓
Send discover/repository.new event
       ↓
Inngest discover-new-repository function
       ↓
1. Fetch from GitHub API
2. Create repository record  
3. Trigger sync events
4. Update database
       ↓
User polling detects completion
       ↓
Show success notification
```

## Components

### Frontend hook
```typescript
// src/hooks/use-repository-discovery.ts
export function useRepositoryDiscovery({
  owner,
  repo,
  enabled = true,
  onDiscoveryComplete
}: DiscoveryOptions): DiscoveryState
```

**Responsibilities:**
- Check if repository exists in database
- Initiate discovery for new repositories  
- Poll for completion status
- Manage UI state transitions
- Show user notifications

### API endpoint
```typescript
// netlify/functions/api-discover-repository.mts
export default async (req: Request, context: Context)
```

**Responsibilities:**
- Validate repository format
- Send Inngest event for background processing
- Return immediately for responsive UI
- Handle rate limiting and errors

### Background processor
```typescript
// src/lib/inngest/functions/discover-new-repository.ts
export const discoverNewRepository = inngest.createFunction(...)
```

**Responsibilities:**
- Fetch repository data from GitHub API
- Create repository record in database
- Add to tracked repositories
- Trigger comprehensive data sync
- Handle GitHub API errors and retries

## State management

### Discovery states
```typescript
type DiscoveryStatus = 
  | 'checking'     // Initial database check
  | 'ready'        // Repository exists, show data
  | 'discovering'  // Background setup in progress  
  | 'error'        // Setup failed
```

### State transitions
```
checking → ready (repository found)
checking → discovering (repository not found)
discovering → ready (setup complete)
discovering → error (setup failed)
error → discovering (retry)
```

## Database schema

### repositories table
```sql
CREATE TABLE repositories (
  id UUID PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  github_id BIGINT UNIQUE,
  -- metadata fields
  UNIQUE(owner, name)
);
```

### tracked_repositories table  
```sql
CREATE TABLE tracked_repositories (
  id UUID PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id),
  organization_name TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  size TEXT DEFAULT 'medium',
  priority TEXT DEFAULT 'low'
);
```

## Error handling

### Repository validation
```typescript
const validFormat = /^[a-zA-Z0-9-_.]+$/.test(owner) && 
                   /^[a-zA-Z0-9-_.]+$/.test(repo);
```

### GitHub API errors
- **404 Not Found**: Repository doesn't exist or is private
- **403 Forbidden**: API rate limit exceeded
- **500 Server Error**: GitHub API temporarily unavailable

### Database errors
- **PGRST116**: No rows found (expected for new repositories)
- **23505**: Duplicate key (repository already exists)
- **Connection errors**: Supabase temporarily unavailable

## Performance considerations

### Rate limiting
- **GitHub API**: 5000 requests/hour for authenticated users
- **Discovery endpoint**: One request per repository per session
- **Polling**: 2-second intervals, max 2 minutes

### Caching strategy
- Repository existence cached indefinitely
- Setup status cached during discovery process
- Data refreshed automatically in background

### Optimization techniques
- Single database query for existence check
- Immediate API response before background processing
- Exponential backoff for failed requests
- Connection pooling for database operations

## Monitoring and alerts

### Key metrics
- Discovery success rate (target: >95%)
- Average setup time (target: <90 seconds)
- API error rate (target: <1%)
- User abandonment during setup (target: <5%)

### Alert conditions
- Setup success rate drops below 90%
- Average setup time exceeds 5 minutes  
- API error rate exceeds 5%
- GitHub API rate limit approaching

## Testing strategy

### Unit tests
- Hook state transitions
- API endpoint validation
- Background processor logic
- Error handling scenarios

### Integration tests  
- End-to-end discovery flow
- Database transaction handling
- GitHub API integration
- User notification timing

### Performance tests
- Concurrent discovery requests
- Large repository handling
- Database connection limits
- Memory usage under load