# Dual Inngest Architecture

## Overview

The project uses a **dual-endpoint architecture** for Inngest functions to handle different runtime requirements:

1. **Supabase Edge Functions** (Deno) - Core functions without Node.js dependencies
2. **Netlify Functions** (Node.js) - Functions requiring Node.js-specific packages

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Inngest Cloud                         │
│                                                               │
│   Event Router: Directs events to correct endpoint          │
│   based on function registration                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ├─────────────────────────────────┐
                           │                                 │
                           ▼                                 ▼
                 ┌─────────────────┐              ┌──────────────────┐
                 │  /api/inngest   │              │ /api/inngest-    │
                 │  (Supabase)     │              │  embeddings      │
                 │                 │              │  (Netlify)       │
                 │  10 Functions   │              │  2 Functions     │
                 └─────────────────┘              └──────────────────┘
```

## Endpoints

### `/api/inngest` → Supabase Edge Functions

**Runtime:** Deno
**Location:** `supabase/functions/inngest-prod/index.ts`
**Functions:**
1. `capture-pr-details` - Capture PR metadata
2. `capture-pr-details-graphql` - PR capture via GraphQL
3. `capture-pr-reviews` - Capture PR reviews
4. `capture-pr-comments` - Capture PR comments
5. `capture-issue-comments` - Capture issue comments
6. `capture-repository-issues` - Capture repository issues
7. `capture-repository-sync` - Sync repository data
8. `update-pr-activity` - Update PR activity metrics
9. `discover-new-repository` - Discover and track new repositories
10. `classify-repository-size` - Classify repository sizes

**Why Supabase:**
- Native ES module support (no bundling issues)
- Longer timeout (150s vs 26s)
- Better isolation from main app

### `/api/inngest-embeddings` → Netlify Function

**Runtime:** Node.js
**Location:** `netlify/functions/inngest-embeddings.mts`
**Functions:**
1. `generate-embeddings` - Generate embeddings for issues/PRs
2. `batch-generate-embeddings` - Batch embedding generation (cron: every 6 hours)

**Why Netlify:**
- Requires `@xenova/transformers` (Node.js-only ML library)
- Uses `crypto` module for content hashing
- Heavy model loading requires Node.js runtime

## Configuration

### netlify.toml

```toml
# Main Inngest endpoint → Supabase
[[redirects]]
  from = "/api/inngest"
  to = "https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod"
  status = 200
  force = true
  headers = {X-Forwarded-Host = "contributor.info"}

# Embeddings endpoint → Netlify
[[redirects]]
  from = "/api/inngest-embeddings"
  to = "/.netlify/functions/inngest-embeddings"
  status = 200
  force = true

[functions.inngest-embeddings]
  node_bundler = "esbuild"
```

### Inngest Dashboard Configuration

Both endpoints must be registered with Inngest:

1. **Production Supabase Endpoint:**
   - URL: `https://contributor.info/api/inngest`
   - Functions: Core 10 functions

2. **Production Embeddings Endpoint:**
   - URL: `https://contributor.info/api/inngest-embeddings`
   - Functions: Embeddings functions

## Environment Variables

### Shared (Required for both endpoints)
- `INNGEST_EVENT_KEY` / `INNGEST_PRODUCTION_EVENT_KEY`
- `INNGEST_SIGNING_KEY` / `INNGEST_PRODUCTION_SIGNING_KEY`
- `GITHUB_TOKEN` / `VITE_GITHUB_TOKEN`

### Supabase-specific
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Netlify-specific (embeddings)
- None additional (uses shared Supabase client)

## How It Works

1. **Event Submission:**
   - App code sends events to Inngest Cloud
   - Example: `inngest.send({ name: 'embeddings.generate', data: {...} })`

2. **Event Routing:**
   - Inngest Cloud receives the event
   - Routes to appropriate endpoint based on function registration
   - `embeddings.generate` → `/api/inngest-embeddings`
   - `capture/pr.details` → `/api/inngest`

3. **Function Execution:**
   - Endpoint receives webhook from Inngest
   - Executes function with appropriate runtime
   - Returns result to Inngest Cloud

## Testing

### Local Development

**Supabase Functions:**
```bash
supabase functions serve inngest-prod --env-file .env.local
```

**Netlify Functions:**
```bash
netlify dev
# Function available at: http://localhost:8888/.netlify/functions/inngest-embeddings
```

**Inngest CLI (for both):**
```bash
npx inngest-cli@latest dev
```

### Verify Function Registration

**Supabase:**
```bash
curl http://localhost:54321/functions/v1/inngest-prod | jq '.functions'
```

**Netlify:**
```bash
curl http://localhost:8888/.netlify/functions/inngest-embeddings | jq '.functions'
```

## Monitoring

### Supabase Logs
```bash
supabase functions logs inngest-prod --project-ref egcxzonpmmcirmgqdrla
```

### Netlify Logs
- View in Netlify Dashboard → Functions
- Or: `netlify functions:log inngest-embeddings`

### Inngest Dashboard
- View all executions at: https://app.inngest.com
- Check function health and error rates
- Monitor both endpoints separately

## Migration Strategy

### Future: Move More Functions to Supabase

If additional functions need Node.js dependencies:
1. Assess dependency compatibility with Deno
2. If incompatible → Add to embeddings endpoint
3. If compatible → Port to Supabase edge function

### Future: External Embeddings Service

Long-term recommendation:
- Replace `@xenova/transformers` with OpenAI/Cohere API
- Move embeddings to Supabase Edge Functions
- Consolidate to single endpoint

## Troubleshooting

### Function Not Found
- **Check:** Is function registered in correct endpoint?
- **Verify:** Both endpoints are healthy in Inngest dashboard

### Embeddings Function Failing
- **Check:** Netlify function logs for model loading errors
- **Verify:** Function has sufficient memory/timeout
- **Note:** First execution may be slow (model download)

### 502 Errors
- **Supabase:** Check function logs for crashes
- **Netlify:** Check for bundling errors (import.meta issues)
- **Both:** Verify signing keys are correct

## Benefits of This Approach

✅ **Solved bundling issues** - Deno eliminates import.meta problems
✅ **Preserved Node.js functionality** - Embeddings still work
✅ **Better performance** - Right runtime for each function
✅ **Independent scaling** - Each endpoint scales independently
✅ **Easier debugging** - Clear separation of concerns

## Related Documentation

- [Inngest Supabase Migration](./inngest-supabase-migration.md)
- [Testing Inngest Supabase](./testing-inngest-supabase.md)
- GitHub Issue #903: Re-enable embeddings functionality

---

**Last Updated:** 2025-10-02
**Author:** Claude Code
**Status:** ✅ Implemented and Deployed
