#!/bin/bash

# Check embeddings backlog status

echo "📊 Embeddings Status"
echo "==================="
echo ""

# Check total items needing embeddings
echo "SELECT
  item_type,
  COUNT(*) as pending_count
FROM items_needing_embeddings
GROUP BY item_type
ORDER BY pending_count DESC;" | npx supabase db execute --project-ref egcxzonpmmcirmgqdrla

echo ""
echo "📈 Recent Embeddings Generated:"
echo ""

# Check recently generated embeddings
echo "SELECT
  'issue' as type,
  COUNT(*) as count,
  MAX(embedding_generated_at) as latest
FROM issues
WHERE embedding_generated_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'pull_request' as type,
  COUNT(*) as count,
  MAX(embedding_generated_at) as latest
FROM pull_requests
WHERE embedding_generated_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'discussion' as type,
  COUNT(*) as count,
  MAX(embedding_generated_at) as latest
FROM discussions
WHERE embedding_generated_at > NOW() - INTERVAL '1 hour';" | npx supabase db execute --project-ref egcxzonpmmcirmgqdrla
