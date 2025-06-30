# Fixing OG image generation for contributor.info

The "image not found" error on contributor.info when sharing to X/Twitter and Slack is most likely caused by **authentication requirements, missing headers, or timeout issues** in the Supabase Edge Function. Based on analysis of common Supabase OG image patterns and platform requirements, here are the critical fixes needed.

## Root causes and immediate fixes

### 1. Authentication blocking public access

Supabase Edge Functions require JWT authentication by default, which blocks social media crawlers. This is the **most common cause** of "image not found" errors.

**Solution**: Deploy your OG image function with the `--no-verify-jwt` flag to allow public access:

```bash
supabase functions deploy og-image --no-verify-jwt
```

### 2. Missing or incorrect response headers

Social platforms require specific headers to properly identify and cache images. Without these, crawlers may reject or fail to load images.

**Required headers implementation**:
```typescript
return new Response(imageBuffer, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Content-Type-Options': 'nosniff'
  }
});
```

### 3. Function timeout issues

X/Twitter enforces a **2-3 second timeout** for image loading, and complex image generation often exceeds this limit.

**Performance optimization approach**:
```typescript
import { ImageResponse } from 'https://deno.land/x/og_edge@0.0.4/mod.ts';

// Use Satori-based generation (5x faster than Puppeteer)
export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  
  // Simple caching check
  const cacheKey = generateCacheKey(searchParams);
  const cached = await checkCache(cacheKey);
  if (cached) return cached;
  
  // Generate image with Satori (fastest option)
  const image = new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 60,
      background: 'white'
    }}>
      {searchParams.get('title') || 'Contributor Info'}
    </div>,
    { width: 1200, height: 630 }
  );
  
  return image;
}
```

## Platform-specific requirements

### X (Twitter) optimization

X requires images to load within **2-3 seconds** and be under **5MB**. The platform also caches images for 7 days.

**Implementation checklist**:
- Image dimensions: **1200x630 pixels** (recommended)
- File size: Under 1MB for optimal performance
- Meta tags must include `twitter:card` with value `summary_large_image`
- Ensure Twitterbot user agent isn't blocked in robots.txt

### Slack's 32KB HTML limit

Slack only reads the **first 32KB** of your HTML response when fetching OG metadata. Meta tags must appear early in the document.

**Frontend optimization**:
```html
<!DOCTYPE html>
<html>
<head>
  <!-- Place OG tags FIRST in head, before any CSS or scripts -->
  <meta property="og:image" content="https://your-project.supabase.co/functions/v1/og-image">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <!-- Other meta tags and resources follow -->
</head>
```

## Debugging your current implementation

### Step 1: Test the function directly

```bash
# Test your OG image URL directly
curl -I https://your-project.supabase.co/functions/v1/og-image?title=test

# Check response headers - should see:
# Content-Type: image/png
# Cache-Control: public, max-age=31536000
```

### Step 2: Check Supabase function logs

Navigate to Supabase Dashboard → Functions → Logs and look for:
- **BOOT_ERROR**: Function failed to start
- **WORKER_ERROR**: Runtime errors during execution
- **WORKER_LIMIT**: Memory/timeout exceeded

### Step 3: Validate with platform tools

1. **X/Twitter**: Use a third-party validator since official tool access is restricted
2. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
3. **OpenGraph.xyz**: Test across multiple platforms simultaneously

## Recommended implementation upgrade

Replace your current implementation with this optimized approach using Satori for **5x faster generation**:

```typescript
import React from 'https://esm.sh/react@18.2.0';
import { ImageResponse } from 'https://deno.land/x/og_edge@0.0.4/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const title = url.searchParams.get('title') || 'Contributor Info';
    const username = url.searchParams.get('username') || '';
    
    // Generate image using Satori (fastest method)
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 60,
            color: 'black',
            background: 'linear-gradient(to bottom right, #f0f0f0, #e0e0e0)',
            width: '100%',
            height: '100%',
            padding: '50px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <h1 style={{ fontSize: 72, marginBottom: 20 }}>{title}</h1>
          {username && <p style={{ fontSize: 36 }}>@{username}</p>}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, immutable, max-age=31536000',
          'CDN-Cache-Control': 'max-age=31536000',
        },
      }
    );
  } catch (error) {
    console.error('OG generation error:', error);
    
    // Return fallback image
    return new Response('Image generation failed', {
      status: 500,
      headers: corsHeaders,
    });
  }
}
```

## Deployment checklist

1. **Deploy with public access**: `supabase functions deploy og-image --no-verify-jwt`
2. **Set proper headers**: Include Content-Type, Cache-Control, and CORS headers
3. **Optimize performance**: Use Satori instead of Puppeteer or Canvas
4. **Test thoroughly**: Verify with curl, browser, and social platform debuggers
5. **Monitor logs**: Check Supabase dashboard for errors
6. **Implement caching**: Add Redis or Supabase Storage caching for repeated requests

## Alternative solutions if issues persist

If Supabase Edge Functions continue to have issues, consider these proven alternatives:

1. **Vercel OG (@vercel/og)**: Deploy to Vercel Edge Functions for better performance
2. **Cloudinary**: Use their transformation API for reliable image generation
3. **Static fallbacks**: Pre-generate common OG images at build time
4. **OpenGraph.xyz**: Use as a temporary solution while debugging

The key to fixing your "image not found" error is ensuring **public accessibility, proper headers, and fast response times**. Start with the authentication fix and header implementation, then optimize performance if timeout issues persist.