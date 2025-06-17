# Storybook Supabase Mock Solution

## Problem
Storybook tests were failing in CI because they required `VITE_SUPABASE_URL` and other Supabase environment variables to be present. This created several issues:
1. CI environment needed access to live Supabase credentials
2. Security concerns about exposing credentials in CI
3. Tests depending on external services could be flaky

## Solution
Created a mock Supabase client specifically for Storybook that eliminates the need for real credentials.

### Changes Made

#### 1. Created Mock Supabase Client
**File**: `/.storybook/mocks/supabase.ts`

This mock provides:
- All necessary auth methods (`getSession`, `signInWithOAuth`, `signOut`, etc.)
- Database query methods (`from`, `select`, `insert`, etc.)
- Returns appropriate null/empty responses
- No external dependencies or API calls

#### 2. Updated Storybook Configuration
**File**: `/.storybook/main.ts`

Added Vite alias to redirect Supabase imports to the mock:
```typescript
resolve: {
  alias: {
    // Mock Supabase for Storybook to avoid needing real credentials
    '@/lib/supabase': new URL('./mocks/supabase.ts', import.meta.url).pathname,
  },
},
```

#### 3. Simplified GitHub Actions Workflow
**File**: `/.github/workflows/storybook-tests.yml`

Removed all Supabase environment variables:
- No longer needs `VITE_SUPABASE_URL`
- No longer needs `VITE_SUPABASE_ANON_KEY`
- No longer needs any secrets for Storybook tests

## Benefits

1. **No External Dependencies**: Storybook tests run in complete isolation
2. **Improved Security**: No credentials needed in CI environment
3. **Faster Tests**: No network calls to external services
4. **More Reliable**: Tests won't fail due to Supabase service issues
5. **Simpler Setup**: No secrets management required for Storybook

## How It Works

When Storybook builds or runs tests:
1. Any import of `@/lib/supabase` is redirected to the mock file
2. The mock provides all the same methods as the real Supabase client
3. Components render normally without knowing they're using a mock
4. Tests pass without needing real database connections

## Testing

To verify the mock is working:
```bash
npm run build-storybook  # Should build without VITE_SUPABASE_URL error
npm run test-storybook   # Should run without authentication errors
```

## Future Considerations

If you need to test specific Supabase behaviors in Storybook:
1. Enhance the mock to return specific test data
2. Add mock state management for auth scenarios
3. Create story-specific mock responses

The mock approach ensures Storybook remains a pure UI testing tool without external service dependencies.