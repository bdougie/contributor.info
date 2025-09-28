import type { Context } from '@netlify/functions';
import { createSupabaseClient } from '@/lib/supabase';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation';

interface CodeOwnersSuggestion {
  pattern: string;
  owners: string[];
  confidence: number;
  reasoning: string;
}

interface ContributorStats {
  username: string;
  contributions: number;
  files: string[];
  directories: Set<string>;
}

async function analyzeContributions(
  owner: string,
  repo: string
): Promise<Map<string, ContributorStats>> {
  const supabase = createSupabaseClient();

  // Get contribution data from database
  const { data: contributions, error } = await supabase
    .from('github_contributions')
    .select(`
      contributor:github_contributors!inner(
        username,
        avatar_url
      ),
      additions,
      deletions,
      commits,
      files_changed
    `)
    .eq('repository_id', `${owner}/${repo}`.toLowerCase())
    .order('commits', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching contributions:', error);
    throw new Error('Failed to fetch contribution data');
  }

  const contributorMap = new Map<string, ContributorStats>();

  // Process contributions to build contributor stats
  for (const contribution of contributions || []) {
    const username = contribution.contributor?.username;
    if (!username) continue;

    if (!contributorMap.has(username)) {
      contributorMap.set(username, {
        username,
        contributions: 0,
        files: [],
        directories: new Set<string>(),
      });
    }

    const stats = contributorMap.get(username)!;
    stats.contributions += contribution.commits || 0;

    // Parse files changed if available
    if (contribution.files_changed && Array.isArray(contribution.files_changed)) {
      for (const file of contribution.files_changed) {
        if (typeof file === 'string') {
          stats.files.push(file);
          // Extract directory from file path
          const dir = file.substring(0, file.lastIndexOf('/'));
          if (dir) {
            stats.directories.add(dir);
          }
        }
      }
    }
  }

  return contributorMap;
}

function generateCodeOwnersSuggestions(
  contributorStats: Map<string, ContributorStats>
): CodeOwnersSuggestion[] {
  const suggestions: CodeOwnersSuggestion[] = [];

  // Analyze directory patterns
  const directoryOwnership = new Map<string, { owners: string[]; totalContributions: number }>();

  for (const [username, stats] of contributorStats) {
    for (const dir of stats.directories) {
      if (!directoryOwnership.has(dir)) {
        directoryOwnership.set(dir, { owners: [], totalContributions: 0 });
      }
      const dirStats = directoryOwnership.get(dir)!;
      dirStats.owners.push(username);
      dirStats.totalContributions += stats.contributions;
    }
  }

  // Generate suggestions based on directory ownership
  for (const [directory, dirStats] of directoryOwnership) {
    // Sort owners by contribution count
    const sortedOwners = dirStats.owners.sort((a, b) => {
      const aStats = contributorStats.get(a)!;
      const bStats = contributorStats.get(b)!;
      return bStats.contributions - aStats.contributions;
    });

    // Take top 3 contributors for each directory
    const topOwners = sortedOwners.slice(0, 3).map(u => `@${u}`);

    if (topOwners.length > 0) {
      const confidence = Math.min(
        0.9,
        (dirStats.totalContributions / 100) * 0.3 + 0.3
      );

      suggestions.push({
        pattern: `/${directory}/`,
        owners: topOwners,
        confidence,
        reasoning: `Top ${topOwners.length} contributor(s) to this directory`,
      });
    }
  }

  // Add high-level suggestions for common directories
  const commonPatterns = [
    { pattern: '/src/', description: 'Source code' },
    { pattern: '/tests/', description: 'Test files' },
    { pattern: '/docs/', description: 'Documentation' },
    { pattern: '/.github/', description: 'GitHub workflows' },
    { pattern: '/api/', description: 'API endpoints' },
  ];

  for (const { pattern, description } of commonPatterns) {
    const relevantContributors = Array.from(contributorStats.entries())
      .filter(([_, stats]) =>
        stats.files.some(f => f.includes(pattern.replace(/\//g, '')))
      )
      .sort(([_, a], [__, b]) => b.contributions - a.contributions)
      .slice(0, 3)
      .map(([username]) => `@${username}`);

    if (relevantContributors.length > 0) {
      suggestions.push({
        pattern,
        owners: relevantContributors,
        confidence: 0.7,
        reasoning: `Most active contributors to ${description}`,
      });
    }
  }

  // Sort suggestions by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export default async (req: Request, context: Context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    // Extract owner and repo from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');

    // Expected path: /api/repos/:owner/:repo/suggested-codeowners
    const apiIndex = pathParts.findIndex(part => part === 'api');
    if (apiIndex === -1 || pathParts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format');
    }

    const owner = pathParts[apiIndex + 2];
    const repo = pathParts[apiIndex + 3];

    // Validate repository is tracked
    const validation = await validateRepository(owner, repo);

    if (!validation.isTracked) {
      return createNotFoundResponse(owner, repo, validation.trackingUrl);
    }

    if (validation.error) {
      return createErrorResponse(validation.error);
    }

    // Get repository ID from database
    const supabase = createSupabaseClient();
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (repoError || !repository) {
      return createNotFoundResponse(owner, repo);
    }

    // Check for cached suggestions first
    const { data: cachedSuggestions, error: cacheError } = await supabase
      .from('codeowners_suggestions')
      .select('suggestions, generated_content, total_contributors, generated_at')
      .eq('repository_id', repository.id)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cachedSuggestions) {
      // Return cached suggestions if they exist and haven't expired
      return new Response(
        JSON.stringify({
          suggestions: cachedSuggestions.suggestions,
          codeOwnersContent: cachedSuggestions.generated_content,
          repository: `${owner}/${repo}`,
          totalContributors: cachedSuggestions.total_contributors,
          generatedAt: cachedSuggestions.generated_at,
          cached: true,
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          },
        }
      );
    }

    // Analyze contributions
    const contributorStats = await analyzeContributions(owner, repo);

    if (contributorStats.size === 0) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          message: 'No contribution data available for analysis',
          repository: `${owner}/${repo}`,
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Generate suggestions
    const suggestions = generateCodeOwnersSuggestions(contributorStats);

    // Format as CODEOWNERS file content
    const codeOwnersContent = [
      '# CODEOWNERS file generated based on contribution analysis',
      '# Review and adjust these suggestions before using',
      '',
      ...suggestions.map(s =>
        `${s.pattern} ${s.owners.join(' ')} # ${s.reasoning} (confidence: ${(s.confidence * 100).toFixed(0)}%)`
      ),
    ].join('\n');

    // Store suggestions in cache for future use
    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    try {
      await supabase
        .from('codeowners_suggestions')
        .upsert({
          repository_id: repository.id,
          suggestions,
          generated_content: codeOwnersContent,
          total_contributors: contributorStats.size,
          generated_at: generatedAt,
          expires_at: expiresAt,
        }, {
          onConflict: 'repository_id'
        });
    } catch (cacheStoreError) {
      console.error('Failed to cache suggestions:', cacheStoreError);
      // Don't fail the request if caching fails
    }

    return new Response(
      JSON.stringify({
        suggestions,
        codeOwnersContent,
        repository: `${owner}/${repo}`,
        totalContributors: contributorStats.size,
        generatedAt,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    console.error('Error in api-suggested-codeowners:', error);
    return createErrorResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/suggested-codeowners',
};
