import { getIssue } from './github-api';
import { extractLinkedItems } from './link-parser';
import { getSupabase } from '../../src/lib/supabase-lazy';

export interface LinkedItemDetails {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
}

/**
 * Fetch details for linked issues/PRs found in text.
 *
 * @param text The text to parse for links (e.g. issue body or comment)
 * @param currentOwner The owner of the current repository (for context)
 * @param currentRepo The name of the current repository (for context)
 */
export async function fetchLinkedItems(
  text: string,
  currentOwner: string,
  currentRepo: string
): Promise<LinkedItemDetails[]> {
  const links = extractLinkedItems(text);
  if (links.length === 0) {
    return [];
  }

  const results: LinkedItemDetails[] = [];
  const processedKeys = new Set<string>();

  // Limit to 5 links to avoid excessive API calls and too much context
  const linksToProcess = links.slice(0, 5);

  for (const link of linksToProcess) {
    const owner = link.owner || currentOwner;
    const repo = link.repo || currentRepo;
    const key = `${owner}/${repo}#${link.number}`;

    if (processedKeys.has(key)) {
      continue;
    }
    processedKeys.add(key);

    try {
      // First try to fetch from our database if we have it
      // This saves API calls
      const supabase = await getSupabase();
      const { data: dbIssue } = await supabase
        .from('issues')
        .select('title, body, state')
        .eq('number', link.number)
        .eq('repository_id', await getRepositoryId(owner, repo, supabase))
        .maybeSingle();

      if (dbIssue) {
        results.push({
          number: link.number,
          title: dbIssue.title,
          body: dbIssue.body,
          state: dbIssue.state,
          html_url: `https://github.com/${owner}/${repo}/issues/${link.number}`,
        });
        continue;
      }

      // Fallback to GitHub API
      const issue = await getIssue(owner, repo, link.number);
      results.push({
        number: issue.number,
        title: issue.title,
        body: issue.body || null,
        state: issue.state,
        html_url: issue.html_url,
      });
    } catch (error) {
      console.warn('Failed to fetch linked item %s:', key, error);
      // Continue to next link even if one fails
    }
  }

  return results;
}

// Helper to get repo ID from owner/name
async function getRepositoryId(owner: string, repo: string, supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('repositories')
    .select('id')
    .eq('full_name', `${owner}/${repo}`)
    .maybeSingle();

  return data?.id || null;
}

/**
 * Format linked items for embedding context
 */
export function formatLinkedItemsForEmbedding(items: LinkedItemDetails[]): string {
  if (items.length === 0) {
    return '';
  }

  return items
    .map((item) => {
      // Truncate body to avoid hitting token limits
      const bodyPreview = item.body ? item.body.substring(0, 200).replace(/\n/g, ' ') : '';
      return `Related Issue #${item.number}: ${item.title} - ${bodyPreview}`;
    })
    .join('\n');
}
