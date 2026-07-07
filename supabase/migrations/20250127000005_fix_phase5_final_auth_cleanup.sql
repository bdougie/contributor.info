-- Phase 5: Final Auth RLS Cleanup
-- Fix remaining unoptimized auth patterns from recent migrations
-- Date: 2025-01-27

-- Fix idempotency_keys table policy
DROP POLICY IF EXISTS "Users can read their own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can read their own idempotency keys"
ON public.idempotency_keys
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

-- Fix workspace_contributors policies
DROP POLICY IF EXISTS "workspace_contributors_read_policy" ON public.workspace_contributors;
CREATE POLICY "workspace_contributors_read_policy"
ON public.workspace_contributors
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM workspaces
        WHERE workspaces.id = workspace_contributors.workspace_id
        AND (
            workspaces.visibility = 'public'
            OR workspaces.owner_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1
                FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = (SELECT auth.uid())
            )
        )
    )
);

DROP POLICY IF EXISTS "workspace_contributors_write_policy" ON public.workspace_contributors;
CREATE POLICY "workspace_contributors_write_policy"
ON public.workspace_contributors
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM workspaces
        WHERE workspaces.id = workspace_contributors.workspace_id
        AND (
            workspaces.owner_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1
                FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = (SELECT auth.uid())
                AND workspace_members.role IN ('admin', 'editor')
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM workspaces
        WHERE workspaces.id = workspace_contributors.workspace_id
        AND (
            workspaces.owner_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1
                FROM workspace_members
                WHERE workspace_members.workspace_id = workspaces.id
                AND workspace_members.user_id = (SELECT auth.uid())
                AND workspace_members.role IN ('admin', 'editor')
            )
        )
    )
);

-- Verify all auth patterns are now optimized
DO $$
DECLARE
    v_unoptimized_count INTEGER;
BEGIN
    -- Count any remaining unoptimized patterns
    SELECT COUNT(*) INTO v_unoptimized_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND (
        (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%' AND qual NOT LIKE '%( SELECT auth.uid()%')
        OR (qual LIKE '%auth.role()%' AND qual NOT LIKE '%(SELECT auth.role())%' AND qual NOT LIKE '%( SELECT auth.role()%')
        OR (qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(SELECT auth.jwt())%' AND qual NOT LIKE '%( SELECT auth.jwt()%')
    );

    IF v_unoptimized_count > 0 THEN
        RAISE NOTICE 'Warning: % unoptimized auth patterns still exist', v_unoptimized_count;
    ELSE
        RAISE NOTICE 'Success: All auth patterns are now optimized!';
    END IF;
END $$;