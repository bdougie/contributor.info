-- Enrich RAG context: add body_preview, created_at, and author_login to
-- find_similar_items_cross_entity so the LLM can see content, recency, and authorship.

-- Must drop first because the return type changed (new columns added)
DROP FUNCTION IF EXISTS find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION find_similar_items_cross_entity(
    query_embedding VECTOR(384),
    repo_ids UUID[],
    match_count INTEGER DEFAULT 5,
    exclude_item_type TEXT DEFAULT NULL,
    exclude_item_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    item_type TEXT,
    id TEXT,
    title TEXT,
    number INTEGER,
    similarity FLOAT,
    url TEXT,
    state TEXT,
    repository_name TEXT,
    body_preview TEXT,
    created_at TIMESTAMPTZ,
    author_login TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'issue'::TEXT as item_type,
        i.id::TEXT as id,
        i.title,
        i.number,
        (1 - (i.embedding <=> query_embedding))::FLOAT as similarity,
        CONCAT('https://github.com/', r.full_name, '/issues/', i.number) as url,
        i.state,
        r.full_name as repository_name,
        LEFT(i.body, 300) as body_preview,
        i.created_at,
        c.username as author_login
    FROM issues i
    JOIN repositories r ON i.repository_id = r.id
    LEFT JOIN contributors c ON i.author_id = c.id
    WHERE i.repository_id = ANY(repo_ids)
    AND i.embedding IS NOT NULL
    AND NOT (exclude_item_type IS NOT DISTINCT FROM 'issue' AND exclude_item_id IS NOT DISTINCT FROM i.id::TEXT)

    UNION ALL

    SELECT
        'pull_request'::TEXT as item_type,
        pr.id::TEXT as id,
        pr.title,
        pr.number,
        (1 - (pr.embedding <=> query_embedding))::FLOAT as similarity,
        CONCAT('https://github.com/', r.full_name, '/pull/', pr.number) as url,
        pr.state,
        r.full_name as repository_name,
        LEFT(pr.body, 300) as body_preview,
        pr.created_at,
        c.username as author_login
    FROM pull_requests pr
    JOIN repositories r ON pr.repository_id = r.id
    LEFT JOIN contributors c ON pr.author_id = c.id
    WHERE pr.repository_id = ANY(repo_ids)
    AND pr.embedding IS NOT NULL
    AND NOT (exclude_item_type IS NOT DISTINCT FROM 'pull_request' AND exclude_item_id IS NOT DISTINCT FROM pr.id::TEXT)

    UNION ALL

    SELECT
        'discussion'::TEXT as item_type,
        d.id as id,
        d.title,
        d.number,
        (1 - (d.embedding <=> query_embedding))::FLOAT as similarity,
        d.url,
        CASE WHEN d.is_answered THEN 'answered' ELSE 'open' END as state,
        r.full_name as repository_name,
        LEFT(d.body, 300) as body_preview,
        d.created_at,
        d.author_login as author_login
    FROM discussions d
    JOIN repositories r ON d.repository_id = r.id
    WHERE d.repository_id = ANY(repo_ids)
    AND d.embedding IS NOT NULL
    AND NOT (exclude_item_type IS NOT DISTINCT FROM 'discussion' AND exclude_item_id IS NOT DISTINCT FROM d.id)

    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION find_similar_items_cross_entity(VECTOR, UUID[], INTEGER, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION find_similar_items_cross_entity IS 'Find similar items across all entity types (issues, pull requests, discussions) within workspace repositories using 384-dimension embeddings. Returns body preview, creation date, and author for enriched RAG context.';
