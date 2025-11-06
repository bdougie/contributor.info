-- Migration: Add RPC function for efficient assignee distribution calculation
-- This optimizes the Assignee Distribution chart by moving computation to the database

-- Function to calculate assignee distribution efficiently
CREATE OR REPLACE FUNCTION calculate_assignee_distribution(
    p_repository_ids UUID[],
    p_exclude_bots BOOLEAN DEFAULT true,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    login TEXT,
    avatar_url TEXT,
    issue_count BIGINT,
    repository_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH open_issues AS (
        -- Get only open issues for the selected repositories
        SELECT 
            i.id,
            i.assignees,
            i.repository_id,
            r.owner,
            r.name
        FROM issues i
        JOIN repositories r ON i.repository_id = r.id
        WHERE 
            i.repository_id = ANY(p_repository_ids)
            AND i.state = 'open'
    ),
    expanded_assignees AS (
        -- Expand the assignees JSONB array
        SELECT 
            oi.id as issue_id,
            oi.repository_id,
            oi.owner,
            oi.name,
            assignee->>'login' as assignee_login,
            assignee->>'avatar_url' as assignee_avatar_url
        FROM open_issues oi,
        LATERAL jsonb_array_elements(oi.assignees) as assignee
    ),
    filtered_assignees AS (
        -- Filter out bots if requested
        SELECT 
            issue_id,
            repository_id,
            owner,
            name,
            assignee_login,
            assignee_avatar_url
        FROM expanded_assignees
        WHERE 
            CASE 
                WHEN p_exclude_bots THEN 
                    -- Bot detection logic
                    NOT (
                        assignee_login ILIKE '%bot%'
                        OR assignee_login ILIKE '%[bot]%'
                        OR assignee_login IN ('dependabot', 'renovate', 'github-actions', 'codecov')
                    )
                ELSE true
            END
    )
    SELECT 
        fa.assignee_login as login,
        fa.assignee_avatar_url as avatar_url,
        COUNT(DISTINCT fa.issue_id) as issue_count,
        COUNT(DISTINCT fa.repository_id) as repository_count
    FROM filtered_assignees fa
    GROUP BY fa.assignee_login, fa.assignee_avatar_url
    ORDER BY issue_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION calculate_assignee_distribution TO authenticated, anon;

-- Add comment for documentation
COMMENT ON FUNCTION calculate_assignee_distribution IS 
    'Efficiently calculates assignee distribution for open issues across repositories. 
     Returns assignee login, avatar URL, number of issues, and number of repositories.
     Supports bot filtering and result limiting for performance.';
