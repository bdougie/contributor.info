#!/bin/bash

# Real-time embeddings progress monitor
# Shows live updates of backlog processing

PROJECT_REF="egcxzonpmmcirmgqdrla"

echo "📺 Live Embeddings Progress Monitor"
echo "===================================="
echo "Press Ctrl+C to stop"
echo ""

while true; do
  clear
  echo "📺 Live Embeddings Progress - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=================================================="
  echo ""

  echo "📊 Current Backlog (items_needing_embeddings view):"
  psql "postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
    -c "SELECT item_type, COUNT(*) as pending FROM items_needing_embeddings GROUP BY item_type ORDER BY pending DESC;" 2>/dev/null

  echo ""
  echo "📈 Processing Rate (last 5 minutes):"
  psql "postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
    -c "SELECT
      'issue' as type,
      COUNT(*) as processed
    FROM issues
    WHERE embedding_generated_at > NOW() - INTERVAL '5 minutes'

    UNION ALL

    SELECT
      'pull_request' as type,
      COUNT(*) as processed
    FROM pull_requests
    WHERE embedding_generated_at > NOW() - INTERVAL '5 minutes'

    UNION ALL

    SELECT
      'discussion' as type,
      COUNT(*) as processed
    FROM discussions
    WHERE embedding_generated_at > NOW() - INTERVAL '5 minutes';" 2>/dev/null

  echo ""
  echo "🎯 Total Progress (items with embeddings):"
  psql "postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
    -c "SELECT
      'issue' as type,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
      COUNT(*) as total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE embedding IS NOT NULL) / COUNT(*), 1) as pct_complete
    FROM issues WHERE created_at > NOW() - INTERVAL '90 days'

    UNION ALL

    SELECT
      'pull_request' as type,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
      COUNT(*) as total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE embedding IS NOT NULL) / COUNT(*), 1) as pct_complete
    FROM pull_requests WHERE created_at > NOW() - INTERVAL '90 days'

    UNION ALL

    SELECT
      'discussion' as type,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
      COUNT(*) as total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE embedding IS NOT NULL) / COUNT(*), 1) as pct_complete
    FROM discussions WHERE created_at > NOW() - INTERVAL '90 days';" 2>/dev/null

  echo ""
  echo "🔄 Refreshing in 10 seconds..."
  sleep 10
done
