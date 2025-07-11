# Inngest Setup Documentation

## Overview

This project uses Inngest for background job processing with different configurations for local development and production environments.

## Environment Configuration

### Local Development
- **App**: `default`
- **Event Key**: `[stored in INNGEST_EVENT_KEY]`
- **Signing Key**: `[stored in INNGEST_SIGNING_KEY]`
- **Function**: `inngest-local.mts`
- **URL**: `http://localhost:8888/.netlify/functions/inngest-local`

### Production/Deploy Previews
- **App**: `contributor-info`
- **Event Key**: `[stored in INNGEST_PRODUCTION_EVENT_KEY]`
- **Signing Key**: `[stored in INNGEST_PRODUCTION_SIGNING_KEY]`
- **Function**: `inngest-prod.mts`
- **URLs**: 
  - Deploy Preview: `https://deploy-preview-XXX--contributor-info.netlify.app/.netlify/functions/inngest-prod`
  - Production: `https://contributor-info.info/.netlify/functions/inngest-prod`

## Functions Overview

### Current Functions

| Function | Purpose | Environment | Status |
|----------|---------|-------------|--------|
| `inngest-local.mts` | Local development testing | Local only | ✅ Working |
| `inngest-prod.mts` | Production and deploy previews | Netlify | ✅ Working |
| `inngest-simple.mts` | Basic test function | Any | ✅ Working |
| `inngest.mts` | Legacy function (has import issues) | Any | ❌ Deprecated |

### Recommended Usage
- **Local development**: Use `inngest-local`
- **Production/Previews**: Use `inngest-prod`

## Local Development Setup

1. **Start the development server:**
   ```bash
   netlify dev --port 8888
   ```

2. **Start Inngest dev mode (in another terminal):**
   ```bash
   npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local
   ```

3. **Test the endpoint:**
   Visit: `http://localhost:8888/.netlify/functions/inngest-local`

## Production Setup

### Netlify Environment Variables

Add these to your Netlify site settings → Environment variables:

```
INNGEST_PRODUCTION_EVENT_KEY=your-contributor-info-app-event-key
INNGEST_PRODUCTION_SIGNING_KEY=your-signing-key
```

**Note**: Get the actual keys from your Inngest dashboard. The event key should be for the `contributor-info` app.

**Important**: Set scope to "All" so they work in production, deploy previews, and branch deploys.

### Inngest Dashboard Registration

Register these URLs in the Inngest dashboard:

- **Deploy Preview**: `https://deploy-preview-XXX--contributor-info.netlify.app/.netlify/functions/inngest-prod`
- **Production**: `https://contributor-info.info/.netlify/functions/inngest-prod`

## Available Events

### Test Events

```json
{
  "name": "test/prod.hello",
  "data": {
    "message": "Hello from production!"
  }
}
```

### Production Events

```json
{
  "name": "capture/pr.details",
  "data": {
    "repositoryId": "123",
    "prNumber": "456"
  }
}
```

```json
{
  "name": "capture/repository.sync",
  "data": {
    "repositoryId": "123",
    "days": 30
  }
}
```

## Troubleshooting

### Common Issues

1. **"SDK response was not signed" error**
   - Solution: Functions now force `isDev: false` to enable proper signing

2. **"The URL is unreachable" error**
   - Check that Netlify environment variables are set
   - Verify the function is deployed and loaded

3. **No events showing in Inngest dashboard**
   - Verify you're using the correct event key for your environment
   - Check that the URL is registered in the Inngest dashboard

### Environment Detection

The `inngest-prod.mts` function automatically detects the environment:

```typescript
// Deploy previews and production both use production mode
const isProduction = () => {
  return process.env.CONTEXT === 'production' || 
         process.env.CONTEXT === 'deploy-preview' || 
         process.env.NODE_ENV === 'production' ||
         process.env.NETLIFY === 'true';
};
```

### Key Selection Logic

```typescript
// Uses production keys for Netlify environments, falls back to dev keys
const getProductionEnvVar = (key: string, fallbackKey?: string): string => {
  if (isProduction()) {
    return process.env[`INNGEST_PRODUCTION_${key}`] || 
           process.env[key] || 
           process.env[fallbackKey] || '';
  }
  return process.env[key] || process.env[fallbackKey] || '';
};
```

## Why Two Different Apps?

- **`default` app**: Used for local development and testing
- **`contributor-info` app**: Used for production to match the project name

This separation helps avoid conflicts between local development and production events.

## Migration Notes

If you need to update keys or migrate between environments:

1. Update the appropriate environment variables
2. Redeploy the functions
3. Update the registered URLs in the Inngest dashboard
4. Test with a simple event to verify connectivity

## Security Notes

- Event keys and signing keys are kept in environment variables
- Keys are never exposed to the browser
- Local and production keys are separated for security
- Functions validate environment context before using keys