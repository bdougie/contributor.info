# CSP violation and Supabase PR validation errors blocking data sync

## Error Summary
Multiple critical errors are preventing data synchronization and PR validation:

1. **Supabase PR validation failure** - null value in required field
2. **Content Security Policy (CSP) violation** - Inngest connection blocked
3. **API endpoint 404** - Backfill trigger endpoint not found

## Error Details

### 1. Supabase PR Validation Error
```
supabase-pr-data-DCfcEpl-.js:2 Supabase PR validation failed: 
html_url: Expected string, received null
```

### 2. Content Security Policy Violation
```
client-P3hmrAPi.js:25 Refused to connect to 'https://inn.gs/e/browser-client' 
because it violates the following Content Security Policy directive: 
"connect-src 'self' https://contributor.info https://*.netlify.app 
https://avatars.githubusercontent.com https://github.com 
https://egcxzonpmmcirmgqdrla.supabase.co https://us.i.posthog.com 
https://api.github.com https://raw.githubusercontent.com 
https://contributor-info-webhooks.fly.dev 
https://contributor-info-social-cards.fly.dev https://vercel.live 
https://ingesteer.services-prod.nsvcs.net wss://egcxzonpmmcirmgqdrla.supabase.co".
```

### 3. Inngest Trigger Error
```
repo-view-BHYdjVWO.js:15 Inngest trigger error: 
TypeError: Failed to fetch. Refused to connect because it violates the document's Content Security Policy.
    at k.maxAttempts (client-P3hmrAPi.js:25:20818)
    at h (client-P3hmrAPi.js:24:8670)
    at T._send (client-P3hmrAPi.js:25:20780)
    at async Promise.all (/continuedev/index 1)
    at async E (repo-view-BHYdjVWO.js:15:68052)
```

### 4. API Endpoint Not Found
```
/api/backfill/trigger:1 Failed to load resource: 
the server responded with a status of 404 ()
```

### 5. Unified Sync Failure
```
repo-view-BHYdjVWO.js:15 Unified sync error: 
Error: Both sync methods failed
    at E (repo-view-BHYdjVWO.js:15:68089)
```

## Impact
- Data synchronization is completely blocked
- PR data cannot be validated due to null html_url values
- Inngest background jobs cannot connect due to CSP restrictions
- Backfill functionality is unavailable (404 endpoint)

## Potential Solutions
1. **CSP Fix**: Add `https://inn.gs` to the Content Security Policy connect-src directive
2. **PR Validation**: Handle null html_url values in PR data validation schema
3. **API Endpoint**: Implement or fix the `/api/backfill/trigger` endpoint
4. **Fallback Logic**: Improve error handling when both sync methods fail

## Environment
- Browser-based environment
- Production deployment (based on minified file names)
- CSP is enforced and blocking Inngest connections

## Priority
**High** - This is blocking core data synchronization functionality

## Labels
- bug
- high-priority