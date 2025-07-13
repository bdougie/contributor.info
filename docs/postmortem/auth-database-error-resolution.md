# Auth Database Error Resolution

**Date:** 2025-01-12  
**Issue:** "Database error saving new user" preventing new users from signing up  
**Resolution:** Removed problematic trigger on auth.users table

## Problem Summary

New users attempting to sign up via GitHub OAuth were encountering:
```
?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user
```

## Root Cause

The error was caused by a trigger on the `auth.users` table that was failing during the Supabase auth flow. Specifically, the `create_user_email_preferences_trigger` was attempting to insert records into the `user_email_preferences` table but failing due to permission issues.

According to Supabase documentation, this is a common issue when:
- Triggers on `auth.users` table don't have proper `SECURITY DEFINER` settings
- The auth admin role (`supabase_auth_admin`) doesn't have permissions to write to tables outside the auth schema
- Triggers fail for any reason during user creation

## Solution Applied

### 1. Identified the Problematic Trigger

```sql
-- Query used to find triggers on auth.users
SELECT 
    t.tgname AS trigger_name,
    t.tgrelid::regclass AS table_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid::regclass::text LIKE 'auth.%'
  AND t.tgname NOT LIKE 'RI_ConstraintTrigger%'
  AND t.tgisinternal = false;
```

Found: `create_user_email_preferences_trigger`

### 2. Removed the Trigger

Created migration: `20250712000006_disable_email_trigger.sql`
```sql
-- Temporarily disable the email preferences trigger to fix auth issues
-- We'll handle email preferences in the app instead

DROP TRIGGER IF EXISTS create_user_email_preferences_trigger ON auth.users;

-- Keep the function but don't use it as a trigger
-- This way we can call it manually if needed
```

### 3. Cleaned Up Previous Fix Attempts

Also removed other triggers that were created while debugging:
- `on_auth_user_created`
- `on_auth_user_login`
- Related functions: `handle_new_auth_user()`, `handle_auth_user_login()`

## Current Architecture

The simplified auth flow now works as follows:

1. **User signs in with GitHub**
   - Supabase creates `auth.users` record
   - No triggers interfere with this process
   - Auth completes successfully

2. **Frontend handles app_users creation**
   - `use-admin-auth.ts` and `auth-button.tsx` have fallback logic
   - If `app_users` record doesn't exist, it's created via RPC call
   - Uses `upsert_app_user` function with proper permissions

3. **Email preferences handled separately**
   - Can be set during user onboarding
   - No longer coupled to auth flow

## Lessons Learned

1. **Avoid triggers on auth.users table** - Supabase's auth system expects to have full control over this table
2. **Use SECURITY DEFINER carefully** - Even with proper settings, cross-schema operations can fail
3. **Decouple non-critical operations** - Email preferences don't need to block authentication
4. **Frontend fallbacks are more reliable** - Handle user record creation in application code where you have full control

## Related Files

- `/supabase/migrations/20250712000006_disable_email_trigger.sql` - Final fix
- `/src/hooks/use-admin-auth.ts` - Frontend fallback for app_users creation
- `/src/components/features/auth/auth-button.tsx` - Frontend fallback for app_users creation
- `/docs/github-auth-database-error-fix.md` - Previous post-mortem (solutions were never implemented)

## Monitoring

To prevent similar issues:
1. Never add triggers to `auth.users` table
2. Test auth flow with new accounts regularly
3. Monitor Supabase auth logs for errors
4. Keep auth flow as simple as possible

## Status

✅ **RESOLVED** - New users can now sign up without database errors