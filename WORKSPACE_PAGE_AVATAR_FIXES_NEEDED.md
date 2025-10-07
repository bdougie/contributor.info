# Workspace Page Avatar Fixes Needed

## Overview
The `src/pages/workspace-page.tsx` file still has 15 instances of direct GitHub avatar URL construction that need to be fixed.

## Pattern to Fix

### Current Pattern (INCORRECT):
```typescript
author: {
  username: pr.author_login || 'Unknown',
  avatar_url: pr.author_login
    ? `https://avatars.githubusercontent.com/${pr.author_login}`
    : '',
}
```

### Corrected Pattern (CORRECT):
```typescript
author: {
  username: pr.author_login || 'Unknown',
  avatar_url: pr.author_avatar_url || '',
}
```

## Required Changes

### 1. Extract avatar_url from contributors data (Lines ~2675-2690)
When formatting PR data, also extract the avatar_url:
```typescript
const formattedPRs = prData.map((pr) => ({
  ...pr,
  author_login: (() => {
    const contrib = pr.contributors as
      | { username?: string; avatar_url?: string }
      | { username?: string; avatar_url?: string }[]
      | undefined;
    if (Array.isArray(contrib)) {
      return contrib[0]?.username || 'Unknown';
    }
    return contrib?.username || 'Unknown';
  })(),
  // ADD THIS:
  author_avatar_url: (() => {
    const contrib = pr.contributors as
      | { username?: string; avatar_url?: string }
      | { username?: string; avatar_url?: string }[]
      | undefined;
    if (Array.isArray(contrib)) {
      return contrib[0]?.avatar_url || '';
    }
    return contrib?.avatar_url || '';
  })(),
  repository_name: transformedRepos.find((r) => r.id === pr.repository_id)?.full_name,
}));
```

Do the same for:
- Issues (extract `author_avatar_url` from issue contributors)
- Reviews (extract `reviewer_avatar_url` from reviewer contributors)
- Comments (extract `commenter_avatar_url` from commenter contributors)

### 2. Fix avatar_url assignments in activity mappings

Replace all instances of:
```typescript
avatar_url: pr.author_login ? `https://avatars.githubusercontent.com/${pr.author_login}` : '',
```

With:
```typescript
avatar_url: pr.author_avatar_url || '',
```

Locations:
- Line ~1977: PR activities
- Line ~2005: Issue activities  
- Line ~2027: Review activities
- Line ~2046: Comment activities
- Line ~2382: PR event activities
- Line ~2409: Issue event activities
- Line ~2429: Review event activities
- Line ~2449: Comment event activities

### 3. Fix repository avatar URLs

Line ~658, ~2629, ~3315: Repository avatars
```typescript
// CURRENT (WRONG):
avatar_url: issue.repositories?.owner
  ? `https://avatars.githubusercontent.com/${issue.repositories.owner}`
  : getFallbackAvatar(),

// SHOULD BE:
avatar_url: issue.repositories?.avatar_url || '',
```

Ensure the database query fetches `avatar_url` from repositories table.

### 4. Fix owner organization avatars

Lines ~1264, ~1370: Owner organization images
```typescript
// CURRENT (WRONG):
<img
  src={`https://avatars.githubusercontent.com/${owner}?size=40`}
  alt={`${owner} organization`}
/>

// SHOULD BE:
{ownerAvatarUrl && (
  <img
    src={ownerAvatarUrl}
    alt={`${owner} organization`}
  />
)}
```

Need to fetch and pass owner avatar URLs from repositories table.

### 5. Fix event actor avatars

Lines ~3021, ~3039: Event actor avatars
```typescript
// CURRENT (WRONG):
actor_avatar:
  payload?.actor?.avatar_url ||
  (event.actor_login
    ? `https://avatars.githubusercontent.com/${event.actor_login}`
    : getFallbackAvatar()),

// SHOULD BE:
actor_avatar: payload?.actor?.avatar_url || event.actor_avatar_url || '',
```

Ensure actor_avatar_url is fetched from the events/contributors data.

## Database Queries to Update

Ensure all queries that fetch user/contributor data include `avatar_url`:

1. Pull requests query - should already have it via `contributors!pull_requests_contributor_id_fkey(username, avatar_url)`
2. Issues query - needs to include contributor avatar_url
3. Reviews query - needs to include reviewer avatar_url  
4. Comments query - needs to include commenter avatar_url
5. Repositories query - needs to include repository avatar_url
6. Events query - needs to include actor avatar_url

## Testing

After fixes:
1. Verify workspace page loads without errors
2. Check that avatars display from Supabase cache
3. Confirm no direct calls to `avatars.githubusercontent.com`
4. Verify empty avatar slots show fallback UI gracefully

## Related Files

- This complements the fixes already made to:
  - `src/lib/utils/avatar.ts`
  - `src/hooks/use-monthly-contributor-rankings.ts`
  - `src/hooks/useWorkspace.ts`
  - `src/hooks/useWorkspacePRs.ts`
  - `src/hooks/use-hierarchical-distribution.ts`
  - Workspace table components
