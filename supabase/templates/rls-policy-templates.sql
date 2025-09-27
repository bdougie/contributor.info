-- RLS Policy Templates for contributor.info
-- Use these templates to create optimized RLS policies
-- Last updated: 2025-01-27

-- ============================================================================
-- IMPORTANT: Always wrap auth functions in SELECT subqueries for performance
-- ============================================================================

-- ============================================================================
-- Template 1: Public Read Access
-- ============================================================================
CREATE POLICY "public_read_policy"
ON your_table_name
FOR SELECT
USING (true);

-- ============================================================================
-- Template 2: Authenticated User Access (Optimized)
-- ============================================================================
-- Read access for authenticated users
CREATE POLICY "authenticated_read_policy"
ON your_table_name
FOR SELECT
TO authenticated
USING (
    (SELECT auth.role()) = 'authenticated'
);

-- Write access for record owner
CREATE POLICY "owner_write_policy"
ON your_table_name
FOR ALL
TO authenticated
USING (
    user_id = (SELECT auth.uid())
)
WITH CHECK (
    user_id = (SELECT auth.uid())
);

-- ============================================================================
-- Template 3: Service Role Full Access (Optimized)
-- ============================================================================
CREATE POLICY "service_role_all_policy"
ON your_table_name
FOR ALL
TO service_role
USING (
    (SELECT auth.role()) = 'service_role'
)
WITH CHECK (
    (SELECT auth.role()) = 'service_role'
);

-- ============================================================================
-- Template 4: Workspace Member Access (Optimized)
-- ============================================================================
CREATE POLICY "workspace_member_read_policy"
ON your_table_name
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM workspace_members wm
        WHERE wm.workspace_id = your_table_name.workspace_id
        AND wm.user_id = (SELECT auth.uid())
    )
);

-- ============================================================================
-- Template 5: Owner + Admin Combined Access (Optimized)
-- ============================================================================
CREATE POLICY "owner_or_admin_policy"
ON your_table_name
FOR ALL
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
        SELECT 1
        FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'admin'
    )
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
        SELECT 1
        FROM user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'admin'
    )
);

-- ============================================================================
-- Template 6: Time-based Access (Optimized)
-- ============================================================================
CREATE POLICY "active_records_only_policy"
ON your_table_name
FOR SELECT
TO authenticated
USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND created_by = (SELECT auth.uid())
);

-- ============================================================================
-- Template 7: Conditional Insert with Defaults (Optimized)
-- ============================================================================
CREATE POLICY "insert_with_defaults_policy"
ON your_table_name
FOR INSERT
TO authenticated
WITH CHECK (
    -- Ensure user_id matches authenticated user
    user_id = (SELECT auth.uid())
    -- Ensure required fields are present
    AND title IS NOT NULL
    AND title != ''
    -- Set default values if not provided
    AND (
        created_at = NOW()
        OR created_at IS NULL  -- Will use table default
    )
);

-- ============================================================================
-- Template 8: Soft Delete Protection (Optimized)
-- ============================================================================
CREATE POLICY "soft_delete_policy"
ON your_table_name
FOR UPDATE
TO authenticated
USING (
    -- Only owner can soft delete
    user_id = (SELECT auth.uid())
)
WITH CHECK (
    -- Can only update deleted_at from NULL to a timestamp
    (deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    OR
    -- Or update other fields if not deleted
    (deleted_at IS NULL AND NEW.deleted_at IS NULL)
);

-- ============================================================================
-- Template 9: Rate Limiting Pattern (Optimized)
-- ============================================================================
CREATE POLICY "rate_limited_insert_policy"
ON your_table_name
FOR INSERT
TO authenticated
WITH CHECK (
    -- Check rate limit: max 10 records per hour
    (
        SELECT COUNT(*)
        FROM your_table_name t
        WHERE t.user_id = (SELECT auth.uid())
        AND t.created_at > NOW() - INTERVAL '1 hour'
    ) < 10
);

-- ============================================================================
-- Template 10: Complex JWT Claims Access (Optimized)
-- ============================================================================
CREATE POLICY "jwt_claims_policy"
ON your_table_name
FOR SELECT
TO authenticated
USING (
    -- Access based on custom JWT claims
    your_table_name.organization_id = (
        (SELECT auth.jwt()) -> 'app_metadata' ->> 'organization_id'
    )::uuid
    AND
    -- Check user's role from JWT
    (
        (SELECT auth.jwt()) -> 'app_metadata' ->> 'role'
    ) IN ('viewer', 'editor', 'admin')
);

-- ============================================================================
-- ANTI-PATTERNS TO AVOID
-- ============================================================================

-- ❌ BAD: Direct auth function calls (causes per-row evaluation)
-- CREATE POLICY "bad_policy"
-- ON your_table
-- USING (user_id = auth.uid());

-- ✅ GOOD: Wrapped in SELECT (evaluates once per query)
-- CREATE POLICY "good_policy"
-- ON your_table
-- USING (user_id = (SELECT auth.uid()));

-- ❌ BAD: Multiple permissive policies for same action
-- CREATE POLICY "read_policy_1" ON table FOR SELECT USING (condition1);
-- CREATE POLICY "read_policy_2" ON table FOR SELECT USING (condition2);
-- CREATE POLICY "read_policy_3" ON table FOR SELECT USING (condition3);

-- ✅ GOOD: Single consolidated policy
-- CREATE POLICY "consolidated_read_policy"
-- ON table
-- FOR SELECT
-- USING (condition1 OR condition2 OR condition3);

-- ============================================================================
-- TESTING YOUR POLICIES
-- ============================================================================

-- Test as anonymous user
SET ROLE anon;
SELECT * FROM your_table_name;

-- Test as authenticated user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM your_table_name;

-- Test as service role
SET ROLE service_role;
SELECT * FROM your_table_name;

-- Reset to default
RESET ROLE;

-- ============================================================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================================================

-- Check for unoptimized policies
SELECT * FROM monitoring.check_unoptimized_policies();

-- View policy summary
SELECT * FROM monitoring.rls_policy_summary
WHERE optimization_status != 'OK';

-- Check performance metrics
SELECT * FROM monitoring.rls_performance_metrics
WHERE performance_risk IN ('High', 'Critical');

-- Generate health report
SELECT * FROM monitoring.generate_rls_report();