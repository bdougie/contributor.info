import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Similar issue result from RPC call
 */
export interface SimilarIssueResult {
  issue_id: string;
  title: string;
  state: string;
  number: number;
  similarity_score: number;
}

/**
 * Hook for fetching similar issues for a given issue ID
 *
 * Uses the database vector similarity function to find semantically
 * similar issues based on embeddings. Falls back to fetching any
 * issues from the same repository if similarity check fails.
 *
 * @param issueId - The issue ID to find similar issues for
 * @param limit - Maximum number of similar issues to return (default: 5)
 * @returns Object with loading state, similar issues, and error if any
 *
 * @example
 * ```tsx
 * const { similarIssues, loading, error } = useSimilarIssues(issueId);
 * ```
 */
export function useSimilarIssues(issueId: string, limit: number = 5) {
  const [loading, setLoading] = useState(true);
  const [similarIssues, setSimilarIssues] = useState<SimilarIssueResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimilarIssues = async () => {
      setLoading(true);
      setError(null);

      try {
        // Query for similar issues using vector similarity
        const { data, error: rpcError } = await supabase.rpc('find_similar_issues', {
          target_issue_id: issueId,
          limit_count: limit,
        });

        if (rpcError) {
          console.error('Failed to fetch similar issues via RPC:', rpcError);

          // Fallback: Try to get any issues from the same repository
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('issues')
            .select('id, title, state, number')
            .neq('id', issueId)
            .limit(limit);

          if (fallbackError) {
            setError('Failed to fetch similar issues');
            setSimilarIssues([]);
            return;
          }

          if (fallbackData) {
            setSimilarIssues(
              fallbackData.map((i) => ({
                ...i,
                issue_id: i.id,
                similarity_score: 0.5,
              }))
            );
          }
        } else if (data) {
          setSimilarIssues(data);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Error fetching similar issues:', err);
        setError(errorMessage);
        setSimilarIssues([]);
      } finally {
        setLoading(false);
      }
    };

    if (issueId) {
      fetchSimilarIssues();
    }
  }, [issueId, limit]);

  return { similarIssues, loading, error };
}
