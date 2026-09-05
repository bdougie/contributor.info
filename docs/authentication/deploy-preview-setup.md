# Deploy Preview Authentication Setup

This document describes how authentication works across different deployment contexts (local, deploy previews, branch deploys, and production) and how to configure Supabase to support them.

## Overview

The application now dynamically detects the deployment context and generates appropriate OAuth redirect URLs for Supabase authentication. This allows authentication to work seamlessly in:

- Local development
- Netlify deploy previews  
- Netlify branch deploys
- Production environment

## Implementation

### 1. Auth Utility (`src/lib/auth/auth-utils.ts`)

The auth utility provides functions to:
- Detect the current deployment context
- Generate appropriate redirect URLs based on context
- Validate redirect URLs for security

Key functions:
- `getSiteURL()` - Returns the appropriate site URL for the current context
- `getAuthRedirectURL()` - Generates the OAuth redirect URL
- `getDeploymentContext()` - Determines if we're in local/preview/production

### 2. Environment Configuration (`src/lib/env.ts`)

Added support for Netlify deployment environment variables:
- `DEPLOY_PRIME_URL` - Primary URL for deploy previews and branch deploys
- `DEPLOY_URL` - Unique URL for each deploy
- `URL` - Main site URL
- `CONTEXT` - Deployment context (production, deploy-preview, branch-deploy)

### 3. Authentication Hook (`src/hooks/use-github-auth.ts`)

Updated to use dynamic redirect URLs instead of hardcoded `window.location.href`. The hook now:
1. Calls `getAuthRedirectURL()` to get the appropriate redirect URL
2. Passes this URL to Supabase's `signInWithOAuth` method
3. Preserves the current path for better UX

### 4. Netlify Configuration (`netlify.toml`)

Added environment variable mappings for different deploy contexts:

```toml
[context.deploy-preview.environment]
  VITE_CONTEXT = "deploy-preview"
  VITE_DEPLOY_PRIME_URL = "$DEPLOY_PRIME_URL"
  VITE_DEPLOY_URL = "$DEPLOY_URL"
  VITE_URL = "$URL"

[context.branch-deploy.environment]
  VITE_CONTEXT = "branch-deploy"
  VITE_DEPLOY_PRIME_URL = "$DEPLOY_PRIME_URL"
  VITE_DEPLOY_URL = "$DEPLOY_URL"
  VITE_URL = "$URL"
```

## Supabase Configuration

### GitHub API Authorization Uses the Existing Sign-In

Workspace features do not have a separate "Connect GitHub" step. The normal
GitHub OAuth sign-in supplies `session.provider_token` through Supabase. See
`mintlify-docs/features/authentication.mdx` for the user-facing login contract and
`docs/product-requirements/prd-private-repo-opt-in.md` for the distinction between
public-scoped login OAuth and private-repository GitHub App installations.

The shared client has `detectSessionInUrl: true` and `flowType: 'implicit'`.
Let `getSession()` await Supabase initialization so the SDK consumes the complete
OAuth callback, including provider credentials. Do not manually rebuild that
callback with `setSession({ access_token, refresh_token })`: those two fields
are Supabase credentials, and rebuilding loses the GitHub provider fields.
After `getSession()` settles, `use-github-auth.ts` replaces the URL with the path
and query only. The SDK clears the fragment solely on success and by assigning
`location.hash`, which leaves a history entry, so this cleanup keeps tokens out
of the address bar and history when the callback fails as well.

Supabase's auth refresh response can omit the provider fields. The storage
adapter in `src/lib/auth/github-session-storage.ts` retains them in the existing
Supabase auth record only when both the user ID and JWT `session_id` match.
It does not create a separate token store, copy tokens between browser profiles,
or expand OAuth scopes. New provider credentials take precedence, explicit null
clears them, and sign-out removes the record. Credentials must never be carried
to another user, provider, or login session.

`src/lib/auth/github-session.ts` provides the shared reader for the GitHub API
hook, the workspace work list, and the issues sync. It uses a 10-second
timeout-protected Supabase session read (an expired JWT refreshes over the
network first), and re-reads the auth record if an immediate refresh response
lacks the retained provider token. A missing session reports an expired sign-in
rather than a changed one. The Supabase JWT must never be sent to GitHub as a
substitute.

This retains a supplied provider token; it cannot recover one already discarded
before this fix or renew one revoked by GitHub. Such sessions report a sign-in
error and use the normal account sign-in flow, not a second integration setup.
See [Supabase provider-token documentation](https://supabase.com/docs/guides/auth/social-login#provider-tokens).

Regression tests in `src/lib/auth/__tests__/github-session-storage.integration.test.ts`
exercise callback parsing, auth refresh, reload, sign-out, and account/session
isolation, including the actual Supabase SDK with mocked HTTP responses.
Validation on September 5, 2026: the full CI Vitest configuration passed 1,759
tests (26 skipped); changed-file ESLint, typecheck, and production build passed.
The user's current browser session has not been inspected or repaired by these
tests; they cannot recover credentials that were previously discarded.

### Required Redirect URLs

Add these redirect URL patterns to your Supabase project's authentication settings:

1. **Go to Supabase Dashboard** → Your Project → Authentication → URL Configuration

2. **Add the following to "Redirect URLs"**:

```
# Local development
http://localhost:3000/**
http://localhost:5173/**
http://localhost:5174/**
http://127.0.0.1:3000/**
http://127.0.0.1:5173/**
http://127.0.0.1:5174/**

# Netlify deploy previews
https://deploy-preview-*--contributor-info.netlify.app/**

# Netlify branch deploys
https://*--contributor-info.netlify.app/**

# Production (use exact URL for security)
https://contributor.info/**
```

### Wildcard Pattern Syntax

Supabase uses glob patterns for matching redirect URLs:

- `*` - Matches any sequence of non-separator characters
- `**` - Matches any sequence of characters (including `/`)
- `?` - Matches a single non-separator character
- Separators are `.` and `/`

### Security Considerations

1. **Production URLs should be exact** - Don't use wildcards in production
2. **Wildcards are for development/preview only** - Minimize wildcard usage
3. **Validate redirect URLs** - The `isValidRedirectURL()` function provides additional validation

## Testing

### Local Development
1. Run `npm run dev`
2. Navigate to `http://localhost:5174`
3. Click "Sign in with GitHub"
4. Verify redirect back to localhost after auth

### Deploy Preview
1. Create a pull request
2. Wait for Netlify to create deploy preview
3. Visit the deploy preview URL (e.g., `https://deploy-preview-123--contributor-info.netlify.app`)
4. Test authentication flow
5. Verify redirect back to the preview URL

### Branch Deploy
1. Push to a feature branch
2. Visit the branch deploy URL (e.g., `https://feature-branch--contributor-info.netlify.app`)
3. Test authentication
4. Verify redirect back to branch URL

### Production
1. Merge to main branch
2. Visit `https://contributor.info`
3. Test authentication
4. Verify redirect back to production URL

## Troubleshooting

### Auth redirects to wrong URL
- Check that Netlify environment variables are being passed correctly
- Verify Supabase redirect URLs include the pattern for your deploy type
- Check browser console for the actual redirect URL being used

### "Redirect URL not allowed" error
- Ensure the redirect URL pattern is added to Supabase
- Check for typos in the URL patterns
- Verify wildcards are correctly formatted

### Environment variables undefined
- Check `netlify.toml` for proper variable mapping
- Ensure build is using the correct context
- Check Netlify build logs for environment variable values

## References

- [Supabase Redirect URLs Documentation](https://supabase.com/docs/guides/auth/redirect-urls)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [Netlify Deploy Previews](https://docs.netlify.com/site-deploys/deploy-previews/)
