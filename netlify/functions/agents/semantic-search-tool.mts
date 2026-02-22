/**
 * Semantic Search Sub-Agent Tool
 *
 * Provides on-demand semantic search over repository activity (PRs, issues,
 * discussions) using pgvector embeddings. Called by the manager in chat.mts
 * when the LLM determines a query needs repository context.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RAGItem {
  item_type: string;
  id: string;
  title: string;
  number: number;
  similarity: number;
  url: string;
  state: string;
  repository_name: string;
  body_preview: string | null;
  created_at: string | null;
  author_login: string | null;
}

export interface EmbedQueryResponse {
  embedding: number[];
  dimensions: number;
  elapsed_ms: number;
}

export interface SemanticSearchItem {
  type: string;
  number: number;
  title: string;
  url: string;
  state: string;
  author: string | null;
  age: string | null;
  similarity: number;
  bodyPreview: string | null;
}

export interface SemanticSearchResult {
  items: SemanticSearchItem[];
  elapsed_ms: number;
}

// ---------------------------------------------------------------------------
// Helpers — exported for unit testing
// ---------------------------------------------------------------------------

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function transformRAGItems(items: RAGItem[]): SemanticSearchItem[] {
  return items.map((item) => ({
    type: item.item_type === 'pull_request' ? 'PR' : item.item_type,
    number: item.number,
    title: item.title,
    url: item.url,
    state: item.state,
    author: item.author_login ?? null,
    age: item.created_at ? formatRelativeTime(item.created_at) : null,
    similarity: item.similarity,
    bodyPreview: item.body_preview ? item.body_preview.replace(/\n/g, ' ') : null,
  }));
}

// ---------------------------------------------------------------------------
// Core search function
// ---------------------------------------------------------------------------

export async function searchRepositoryContext(
  query: string,
  repoId: string,
  supabase: SupabaseClient
): Promise<SemanticSearchResult> {
  const edgeFunctionUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!edgeFunctionUrl || !serviceRoleKey) {
    console.log('[semantic-search] skipped: missing Supabase URL or service role key');
    return { items: [], elapsed_ms: 0 };
  }

  const start = Date.now();

  // Step 1: Get embedding from the edge function with a 3s timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  let embedding: number[];
  try {
    const embedResponse = await fetch(`${edgeFunctionUrl}/functions/v1/embed-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ text: query }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!embedResponse.ok) {
      console.log('[semantic-search] embed-query returned %d', embedResponse.status);
      return { items: [], elapsed_ms: Date.now() - start };
    }

    const embedData: EmbedQueryResponse = await embedResponse.json();
    embedding = embedData.embedding;
  } catch (err) {
    clearTimeout(timeout);
    const reason = err instanceof Error ? err.message : String(err);
    console.log('[semantic-search] embed-query failed: %s', reason);
    return { items: [], elapsed_ms: Date.now() - start };
  }

  // Step 2: Call vector search RPC
  const { data: similarItems, error: rpcError } = await supabase.rpc(
    'find_similar_items_cross_entity',
    {
      query_embedding: embedding,
      repo_ids: [repoId],
      match_count: 8,
      exclude_item_type: null,
      exclude_item_id: null,
    }
  );

  if (rpcError) {
    console.log('[semantic-search] RPC error: %s', rpcError.message);
    return { items: [], elapsed_ms: Date.now() - start };
  }

  // Step 3: Filter by similarity threshold and transform
  const items = (similarItems as RAGItem[] | null) ?? [];
  const relevant = items.filter((item) => item.similarity > 0.3);

  const elapsed = Date.now() - start;
  console.log('[semantic-search] retrieval: %dms, %d items', elapsed, relevant.length);

  return {
    items: transformRAGItems(relevant),
    elapsed_ms: elapsed,
  };
}
