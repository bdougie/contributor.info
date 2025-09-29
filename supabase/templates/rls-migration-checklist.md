# RLS Migration Checklist

Use this checklist when adding new tables to ensure proper Row Level Security implementation and prevent access errors.

## Pre-Migration Planning

### 1. Table Classification
- [ ] Determine table category:
  - [ ] **Core Data Table** (contributors, repositories, pull_requests)
  - [ ] **User Management Table** (workspaces, workspace_members)
  - [ ] **System/Admin Table** (logs, metrics, configuration)
  - [ ] **Tracking/Analytics Table** (activity, rankings, snapshots)

### 2. Access Requirements Analysis
- [ ] Who should have read access?
  - [ ] Public (anonymous users)
  - [ ] Authenticated users only
  - [ ] Service role only
  - [ ] Workspace members only
- [ ] Who should have write access?
  - [ ] Authenticated users
  - [ ] Service role only
  - [ ] Table owners only
- [ ] Who should have delete access?
  - [ ] Service role only
  - [ ] Table owners only
  - [ ] No one (append-only)

## Migration Implementation

### 3. Create Table Migration
- [ ] Add table creation SQL to migration file
- [ ] Include proper constraints and indexes
- [ ] Add foreign key relationships
- [ ] Test table creation locally

### 4. Enable RLS on New Table
- [ ] Add `ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;` to migration
- [ ] **CRITICAL**: Never deploy a table without RLS enabled

### 5. Create RLS Policies

#### For Core Data Tables:
- [ ] Public read policy:
  ```sql
  CREATE POLICY "public_read_your_table"
  ON your_table FOR SELECT
  USING (true);
  ```
- [ ] Authenticated insert/update policies:
  ```sql
  CREATE POLICY "service_and_auth_insert_your_table"
  ON your_table FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);
  
  CREATE POLICY "service_and_auth_update_your_table"
  ON your_table FOR UPDATE
  TO authenticated, service_role
  USING (true) WITH CHECK (true);
  ```
- [ ] Service role delete policy:
  ```sql
  CREATE POLICY "service_delete_your_table"
  ON your_table FOR DELETE
  TO service_role
  USING (true);
  ```

#### For User Management Tables:
- [ ] User-scoped read policy:
  ```sql
  CREATE POLICY "user_read_own_your_table"
  ON your_table FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR /* workspace member check */);
  ```
- [ ] User-scoped write policy:
  ```sql
  CREATE POLICY "user_write_own_your_table"
  ON your_table FOR INSERT/UPDATE
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);
  ```

#### For System/Admin Tables:
- [ ] Service role only policy:
  ```sql
  CREATE POLICY "service_manage_your_table"
  ON your_table FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
  ```
- [ ] Optional authenticated read:
  ```sql
  CREATE POLICY "auth_read_your_table"
  ON your_table FOR SELECT
  TO authenticated
  USING (true);
  ```

#### For Analytics Tables:
- [ ] Public read, service write pattern:
  ```sql
  CREATE POLICY "public_read_your_table"
  ON your_table FOR SELECT
  USING (true);
  
  CREATE POLICY "service_write_your_table"
  ON your_table FOR INSERT/UPDATE
  TO service_role
  WITH CHECK (true);
  ```

## Testing & Verification

### 6. Add Table to RLS Tests
- [ ] Update `supabase/tests/rls-policy-tests.sql`
- [ ] Add new table to core tables list in Test 1 & 2:
  ```sql
  AND tablename IN (
      'contributors', 'repositories', 'pull_requests', /* ... */
      'your_new_table'  -- Add here
  )
  ```
- [ ] Add specific read/write tests for new table:
  ```sql
  -- Test X: Test anonymous read access to your_table
  DO $$
  DECLARE test_count INTEGER;
  BEGIN
      SELECT COUNT(*) INTO test_count FROM your_table LIMIT 1;
      RAISE NOTICE '✅ Test X PASSED: Anonymous users can read your_table';
  EXCEPTION WHEN insufficient_privilege THEN
      RAISE EXCEPTION '❌ Test X FAILED: Anonymous users cannot read your_table';
  END $$;
  ```

### 7. Run RLS Tests
- [ ] Execute full RLS test suite: `supabase/tests/rls-policy-tests.sql`
- [ ] Verify all tests pass with ✅ messages
- [ ] Check policy summary report shows correct coverage
- [ ] Fix any test failures before proceeding

### 8. Manual Testing
- [ ] Test anonymous read access (should work for public tables)
- [ ] Test anonymous write access (should fail with `insufficient_privilege`)
- [ ] Test authenticated user access (should work according to policies)
- [ ] Test service role access (should work for all operations)

## Deployment

### 9. Pre-Deployment Checks
- [ ] Migration file includes table creation + RLS enablement + policies
- [ ] RLS tests updated and passing
- [ ] No security vulnerabilities identified
- [ ] Backup plan documented in case of issues

### 10. Deployment Steps
- [ ] Apply migration via Supabase Dashboard or CLI
- [ ] Run RLS test suite in production
- [ ] Monitor application for access errors
- [ ] Verify progressive onboarding still works (for public tables)

### 11. Post-Deployment Verification
- [ ] Check application functionality
- [ ] Monitor error logs for permission issues
- [ ] Verify no data access violations
- [ ] Update documentation if needed

## Common Issues & Solutions

### Issue: "new row violates row-level security policy"
**Cause**: Write policy is too restrictive or missing
**Solution**: Review INSERT/UPDATE policies, ensure proper role assignments

### Issue: "permission denied for table"
**Cause**: RLS enabled but no policies exist
**Solution**: Add appropriate SELECT policy for intended users

### Issue: Progressive onboarding broken
**Cause**: Missing public read policy on core tables
**Solution**: Add `CREATE POLICY "public_read_*" FOR SELECT USING (true)`

### Issue: Service role cannot access table
**Cause**: Missing service_role policies
**Solution**: Add service_role to existing policies or create dedicated ones

## Best Practices Reminder

- [ ] **Always enable RLS** when creating tables
- [ ] **Test extensively** before deploying to production
- [ ] **Follow established patterns** from existing tables
- [ ] **Document any deviations** from standard patterns
- [ ] **Keep policies simple** to avoid performance issues
- [ ] **Use descriptive policy names** for maintainability

## Checklist Sign-off

- [ ] **Developer**: All items completed, tests pass locally
- [ ] **Reviewer**: Migration and policies reviewed, no security issues
- [ ] **Deployer**: Production deployment successful, monitoring active

---

**Remember**: RLS protects sensitive data while preserving the progressive onboarding experience. When in doubt, follow existing patterns from similar tables.