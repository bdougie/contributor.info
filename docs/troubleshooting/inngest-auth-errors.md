# Troubleshooting Inngest Authorization Errors

## Problem

Inngest functions are failing with 401 authorization errors:
```
Error: No x-inngest-signature provided
```

## Root Cause

The `x-inngest-signature` header is missing from requests, which means:
1. Inngest Cloud hasn't properly synced the app, OR
2. The signing key in Supabase doesn't match the one in Inngest Dashboard

## Solution

### Step 1: Verify Keys Match

Run the verification script:
```bash
./scripts/verify-inngest-keys.sh
```

This will check that your local `.env` has properly formatted keys (production keys, not test keys).

### Step 2: Check Supabase Secrets

The Supabase Edge Function needs these secrets:
```bash
INNGEST_SIGNING_KEY=signkey-prod-... (or INNGEST_PRODUCTION_SIGNING_KEY)
INNGEST_EVENT_KEY=... (or INNGEST_PRODUCTION_EVENT_KEY)
```

To verify secrets are set:
```bash
supabase secrets list
```

To update secrets:
```bash
supabase secrets set INNGEST_SIGNING_KEY="signkey-prod-..."
supabase secrets set INNGEST_EVENT_KEY="..."
```

### Step 3: Sync App in Inngest Dashboard

1. Go to https://app.inngest.com
2. Navigate to your app: `contributor-info`
3. Click "Apps" in the sidebar
4. Find your app and click "Sync"
5. Verify the URL is correct: `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod`

### Step 4: Verify Keys Match in Inngest Dashboard

1. In Inngest Dashboard, go to Settings > Keys
2. Copy the **Signing Key** (starts with `signkey-prod-...`)
3. Compare with your Supabase secret:
   ```bash
   # This should output the same key
   supabase secrets list | grep INNGEST_SIGNING_KEY
   ```

If they don't match, update Supabase:
```bash
supabase secrets set INNGEST_SIGNING_KEY="<key-from-inngest-dashboard>"
```

### Step 5: Redeploy Function

After updating secrets:
```bash
supabase functions deploy inngest-prod
```

### Step 6: Test Authorization

Run the test script to verify:
```bash
./scripts/test-inngest-auth.sh
```

You should see:
- ✅ OPTIONS request returns 200
- ✅ GET request returns function list (11 functions)
- ⚠️ POST request fails with "No x-inngest-signature provided" (expected when not called by Inngest)

### Step 7: Verify in Production

Trigger a real Inngest event and check the logs:
```bash
# Watch logs in real-time
supabase functions logs inngest-prod --follow
```

Look for:
```
🚀 Inngest Edge Function Started with FULL implementations
Configuration: {
  appId: 'contributor-info',
  hasEventKey: true,
  hasSigningKey: true,
  eventKeyLength: 66,
  signingKeyLength: 77
}
```

## Common Issues

### Issue: Keys are empty (length: 0)

**Solution**: Keys aren't set in Supabase. Run:
```bash
supabase secrets set INNGEST_SIGNING_KEY="..."
supabase secrets set INNGEST_EVENT_KEY="..."
supabase functions deploy inngest-prod
```

### Issue: Using test keys in production

**Solution**: Make sure you're using production keys:
- Signing key should start with `signkey-prod-...` (not `signkey-test-...`)
- Event key should NOT start with `test_`

### Issue: App not synced in Inngest

**Solution**: Go to Inngest Dashboard > Apps > contributor-info > Sync

### Issue: URL mismatch

**Solution**: Verify the app URL in Inngest matches:
```
https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod
```

## Understanding the Error

The function logs show detailed information:

1. **Startup logs** show if keys are loaded:
   ```
   Configuration: {
     hasEventKey: true,
     hasSigningKey: true,
     eventKeyLength: 66,
     signingKeyLength: 77
   }
   ```

2. **Request logs** show what headers Inngest sends:
   ```
   Headers: {
     hasAuthorization: true,
     authType: 'Bearer',
     hasInngestSignature: false  // ❌ This should be true
   }
   ```

3. **Error logs** categorize the issue:
   ```
   {
     error: 'Authorization Error',
     message: 'No x-inngest-signature provided',
     hint: 'Check that INNGEST_SIGNING_KEY is correctly set'
   }
   ```

## Prevention

After fixing, verify:
1. Keys are stored in password manager
2. Supabase secrets are backed up
3. Inngest app is synced and healthy
4. Test script passes: `./scripts/test-inngest-auth.sh`
