# Dub.co Environment Configuration

## Overview

The social sharing feature uses [Dub.co](https://dub.co) to create short links (oss.fyi) for sharing charts and repository metrics. This requires the `VITE_DUB_CO_KEY` environment variable to be configured in Netlify.

## Required Environment Variable

- **Variable Name**: `VITE_DUB_CO_KEY`
- **Purpose**: API key for Dub.co URL shortening service
- **Domain**: Uses `oss.fyi` in production, `dub.sh` in development

## Configuration Steps

### 1. Netlify Dashboard Configuration

To enable oss.fyi link shortening in all deployment contexts:

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Navigate to: **Site settings → Environment variables**
3. Click **Add a variable**
4. Add the following:
   - **Key**: `VITE_DUB_CO_KEY`
   - **Value**: Your Dub.co API key
   - **Scopes**: Select all deployment contexts:
     - ✅ Production
     - ✅ Deploy previews
     - ✅ Branch deploys

### 2. Obtain Dub.co API Key

1. Log in to [Dub.co Dashboard](https://app.dub.co)
2. Navigate to **Settings → API Keys**
3. Create a new API key with appropriate permissions
4. Copy the key (it will only be shown once)

## Fallback Behavior

When `VITE_DUB_CO_KEY` is not configured:

- **Development mode**: Returns original URL with mock data
- **Production/Preview without key**: Returns original URL as fallback
- Share buttons will display the full contributor.info URL instead of oss.fyi short link

See `src/lib/dub.ts:148-164` for fallback implementation.

## Testing

### Local Development

Test the integration locally at `/dev/dub-test`:

```bash
npm run dev
# Navigate to http://localhost:5174/dev/dub-test
```

The test page shows:
- Environment configuration (dev/production)
- Domain being used (dub.sh/oss.fyi)
- API key status (configured/missing)
- Test button to create short URLs

### Production/Preview Testing

1. Deploy to Netlify
2. Navigate to any repository page
3. Click the share icon on a chart
4. Verify the copied URL is an `oss.fyi` link (not a deploy preview URL)

## Troubleshooting

### Share buttons return deploy preview URLs

**Symptom**: Clicking copy or share buttons returns URLs like `https://deploy-preview-123--contributor-info.netlify.app/...`

**Cause**: `VITE_DUB_CO_KEY` is not configured for deploy preview context

**Fix**: Add the environment variable to deploy previews in Netlify Dashboard (see Configuration Steps above)

### Links use dub.sh instead of oss.fyi

**Symptom**: Short links use `dub.co` domain instead of `oss.fyi`

**Cause**: Running in development mode

**Expected behavior**: Development mode intentionally uses `dub.sh`. Production deployments use `oss.fyi`.

## Related Files

- `src/lib/dub.ts` - Core Dub.co integration with retry logic
- `src/services/dub-analytics.service.ts` - Analytics syncing service
- `src/components/features/debug/dub-test.tsx` - QA test page
- `netlify.toml:41-50` - Deploy preview environment configuration
- `src/lib/__tests__/dub.integration.test.ts` - Integration tests

## Security Notes

- **NEVER** commit the API key to version control
- The key is sensitive and should only be stored in Netlify's secure environment variables
- Netlify automatically encrypts environment variables at rest
- Each deployment context can have different keys if needed

## Analytics Integration

Short URLs created through Dub.co are automatically tracked in our Supabase `short_urls` table for internal analytics:

- Click counts
- Geographic data
- Device/browser information
- Referrer tracking

See `src/services/dub-analytics.service.ts` for analytics implementation.
