# Netlify Functions

This directory contains all Netlify serverless functions for the contributor.info application.

## Directory Structure

```
netlify/functions/
├── __tests__/              # Test files for functions
├── _shared/                # Shared utilities and helpers
├── lib/                    # Function-specific libraries
├── backfill-*.ts          # Manual backfill endpoints
├── api-*.mts              # API endpoints
├── health-*.mts           # Health check endpoints
├── inngest-*.mts          # Inngest integration endpoints
└── workspace-*.ts         # Workspace-related endpoints
```

## Manual Backfill Functions

The manual backfill service consists of several endpoints:

- `backfill-trigger.ts` - Trigger a new backfill job
- `backfill-status.ts` - Check job status
- `backfill-cancel.ts` - Cancel a running job
- `backfill-events.ts` - List backfill jobs

### Configuration

These functions require environment variables to be set:
- `GH_DATPIPE_KEY` - API key for the data pipeline service
- `GH_DATPIPE_API_URL` - Base URL for the data pipeline API

See [Manual Backfill Setup](../../docs/data-fetching/manual-backfill-setup.md) for detailed configuration instructions.

## Important: File Path Convention

⚠️ **Files must be placed directly in `netlify/functions/` directory**

Netlify functions must follow this structure:
- ✅ `netlify/functions/function-name.ts`
- ❌ `netlify/functions/subfolder/function-name.ts` (won't be recognized as a function)
- ❌ `netlify/functions/netlify/functions/function-name.ts` (duplicate path - causes 404)

If you encounter 404 errors, check that:
1. Functions are in the correct directory
2. No duplicate `netlify/functions` paths exist
3. Function files are at the root level of `netlify/functions/`

## Lazy Initialization Pattern

The backfill functions use lazy initialization to handle missing environment variables gracefully:

```typescript
class ManualBackfillServerClient {
  private apiUrl: string | undefined;
  private apiKey: string | undefined;

  constructor() {
    // Don't throw here - allows function to load
    this.apiUrl = process.env.GH_DATPIPE_API_URL;
    this.apiKey = process.env.GH_DATPIPE_KEY;
  }

  async triggerBackfill(request: BackfillRequest) {
    // Validate here - allows proper error response
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('Service not configured');
    }
    // ... rest of implementation
  }
}
```

This pattern ensures:
- Functions can load even without environment variables
- Proper HTTP status codes (503) instead of 404 errors
- Clear error messages for debugging

## Testing

Run tests for all functions:
```bash
npm test netlify/functions/__tests__
```

Run integration tests:
```bash
npm test netlify/functions/__tests__/backfill-endpoints.integration.test.ts
```

## Deployment

Functions are automatically deployed with Netlify. Configuration is in `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/backfill/*"
  to = "/.netlify/functions/backfill-:splat"
  status = 200
```

## Debugging 404 Errors

If you encounter 404 errors:

1. **Check function logs** in Netlify dashboard
2. **Verify environment variables** are set in Netlify
3. **Test locally** with Netlify CLI:
   ```bash
   netlify dev
   ```
4. **Check file paths** - ensure no duplicate directories
5. **Verify redirects** in `netlify.toml` match your endpoints

## Common Issues and Solutions

### Issue: 404 Not Found on function endpoints
**Solution**: Check that environment variables are set and functions are in the correct directory

### Issue: 503 Service Unavailable
**Solution**: This is expected when `GH_DATPIPE_KEY` is not configured. Add the required environment variables.

### Issue: Function doesn't load
**Solution**: Ensure the function uses lazy initialization and doesn't throw errors in the constructor

### Issue: CORS errors
**Solution**: Add proper CORS headers in function responses