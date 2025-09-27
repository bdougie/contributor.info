# Netlify Redirects Configuration

## Overview

This project uses Netlify's redirect system to route API requests to serverless functions and handle SPA (Single Page Application) routing. All redirect configuration is managed through `netlify.toml`.

## Critical Rules

### 1. Never Use `_redirects` File

**DO NOT** create or use a `public/_redirects` file. The `_redirects` file takes precedence over `netlify.toml` and can cause API routes to return HTML instead of JSON.

### 2. Configuration Order

All redirects must be configured in `netlify.toml` with the following order:
1. API redirects (with `force = true`)
2. Specific path redirects
3. SPA catch-all redirect (`/*` -> `/index.html`)

## Configuration Structure

### API Redirects

All API routes must have `force = true` to ensure they take precedence:

```toml
[[redirects]]
  from = "/api/repository-status"
  to = "/.netlify/functions/api-repository-status"
  status = 200
  force = true  # Critical for API routes
```

### SPA Catch-All

The SPA catch-all must come last and doesn't need conditions since API routes use `force = true`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Common Issues

### Issue: API Returns HTML Instead of JSON

**Symptom:** `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**Cause:** Usually caused by:
1. A `_redirects` file exists and overrides `netlify.toml`
2. API redirect missing `force = true`
3. API redirect placed after SPA catch-all

**Solution:**
1. Delete any `_redirects` file
2. Ensure all API routes have `force = true`
3. Run validation: `npm run validate:redirects`

## Validation

Run the redirect validation script to ensure configuration is correct:

```bash
npm run validate:redirects
```

This script checks:
- No `_redirects` file exists
- All API routes have `force = true`
- No duplicate redirects
- Proper redirect ordering

## Testing

### Local Testing

Test redirects locally using Netlify Dev:

```bash
npm run start  # Runs netlify dev
```

### Integration Tests

Run API redirect tests:

```bash
npm test tests/api-redirects.test.ts
```

### Production Testing

Test a specific API endpoint:

```bash
curl -I https://contributor.info/api/repository-status?owner=test&repo=test
```

Should return `Content-Type: application/json`, not `text/html`.

## Adding New API Endpoints

1. Create the function in `netlify/functions/`
2. Add redirect to `netlify.toml`:

```toml
[[redirects]]
  from = "/api/your-endpoint"
  to = "/.netlify/functions/your-function"
  status = 200
  force = true  # Always include this
```

3. Place the redirect BEFORE the SPA catch-all
4. Run validation: `npm run validate:redirects`
5. Update tests in `tests/api-redirects.test.ts`

## Debugging

If API requests return HTML:

1. Check for `_redirects` file: `ls public/_redirects`
2. Verify redirect order in `netlify.toml`
3. Check `force = true` on API routes
4. Clear browser cache and service worker
5. Run validation script
6. Check Netlify deploy logs

## References

- [Netlify Redirects Documentation](https://docs.netlify.com/routing/redirects/)
- [Redirect Precedence](https://docs.netlify.com/routing/redirects/#rule-processing-order)
- Issue #776 - Original API redirect bug