// Fixed import paths for Netlify Functions build
import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.ts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mts';

interface CodeOwnersSuggestion {
  pattern: string;
  owners: string[];
  confidence: number;
  reasoning: string;
}

// Helper function to create Supabase client
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey);
}

interface ContributorStats {
  username: string;
  contributions: number;
  files: string[];
  directories: Set<string>;
}

async function analyzeContributions(owner: string, repo: string): Promise<Map<string, ContributorStats>> {
  const supabase = createSupabaseClient();

  // First try the repositories table
  const { data: repository } = await supabase
    .from('repositories')
    .select('id')
    .or(`and(owner.eq.${owner},name.eq.${repo}),full_name.eq.${owner}/${repo}`)
    .maybeSingle();

  if (!repository) {
    throw new Error(`Repository ${owner}/${repo} not found in database`);
  }

  // Try to get recent commits and contributors
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: commits, error } = await supabase
    .from('commits')
    .select(`
      author:contributors!author_id(username, avatar_url),
      message,
      committed_date
    `)
    .eq('repository_id', repository.id)
    .gte('committed_date', ninetyDaysAgo)
    .order('committed_date', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching commits:', error);
    // Fall back to empty map rather than throwing
    return new Map<string, ContributorStats>();
  }

  const contributorMap = new Map<string, ContributorStats>();

  // Process commits to build contributor stats
  for (const commit of commits || []) {
    const username = commit.author?.username;
    if (!username) continue;

    if (!contributorMap.has(username)) {
      contributorMap.set(username, {
        username,
        contributions: 0,
        files: [],
        directories: new Set()
      });
    }

    const stats = contributorMap.get(username)!;
    stats.contributions += 1;

    // Try to extract file paths from commit messages (basic heuristic)
    const message = commit.message || '';
    const fileMatches = message.match(/(\w+\/[\w\/.]+\.\w+)/g) || [];
    for (const file of fileMatches) {
      stats.files.push(file);
      const dir = file.substring(0, file.lastIndexOf('/'));
      if (dir) stats.directories.add(dir);
    }
  }

  // If we have no data, try to fetch from GitHub API
  if (contributorMap.size === 0) {
    const ghToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || '';
    if (ghToken) {
      try {
        const headers: HeadersInit = {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${ghToken}`,
        };

        const resp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=30`,
          { headers }
        );

        if (resp.ok) {
          const contributors = await resp.json();
          for (const contrib of contributors) {
            if (contrib.login) {
              contributorMap.set(contrib.login, {
                username: contrib.login,
                contributions: contrib.contributions || 0,
                files: [],
                directories: new Set(['src', 'lib', 'components', 'api']), // Common dirs
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch from GitHub:', e);
      }
    }
  }

  return contributorMap;
}

function generateCodeOwnersSuggestions(
  contributorStats: Map<string, ContributorStats>,
  existingTeams?: string[]
): CodeOwnersSuggestion[] {
  const suggestions: CodeOwnersSuggestion[] = [];
  const directoryOwnership = new Map<string, { owners: string[]; total: number }>();

  for (const [username, stats] of contributorStats) {
    for (const dir of stats.directories) {
      const rec = directoryOwnership.get(dir) || { owners: [], total: 0 };
      rec.owners.push(username);
      rec.total += stats.contributions;
      directoryOwnership.set(dir, rec);
    }
  }

  // Add team suggestions if provided (from existing CODEOWNERS analysis)
  if (existingTeams && existingTeams.length > 0) {
    // Add a suggestion for common directories with teams
    suggestions.push({
      pattern: '/*',
      owners: existingTeams,
      confidence: 0.85,
      reasoning: 'Existing team ownership pattern detected'
    });
  }

  for (const [dir, rec] of directoryOwnership) {
    const sorted = rec.owners.sort((a, b) => (contributorStats.get(b)!.contributions - contributorStats.get(a)!.contributions));
    const top = sorted.slice(0, 3).map((u) => {
      // Handle both individual users and preserve team format
      return u.includes('/') ? `@${u}` : `@${u}`;
    });

    if (top.length > 0) {
      const confidence = Math.min(0.9, (rec.total / 100) * 0.3 + 0.3);
      suggestions.push({
        pattern: `/${dir}/`,
        owners: top,
        confidence,
        reasoning: `Top ${top.length} contributor(s) to this directory`
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export default async (req: Request, context: Context) => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  const limiter = new RateLimiter(supabaseUrl, supabaseKey, {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  });

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'GET') return createErrorResponse('Method not allowed', 405);

  try {
    const rateKey = getRateLimitKey(req);
    const rate = await limiter.checkLimit(rateKey);
    if (!rate.allowed) return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');
    if (apiIndex === -1 || parts.length < apiIndex + 5) return createErrorResponse('Invalid API path format');
    const owner = parts[apiIndex + 2];
    const repo = parts[apiIndex + 3];

    const validation = await validateRepository(owner, repo);
    if (!validation.isTracked) return createNotFoundResponse(owner, repo, validation.trackingUrl);
    if (validation.error) return createErrorResponse(validation.error);

    const supabase = createSupabaseClient();
    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .maybeSingle();
    if (repoError || !repository) return createNotFoundResponse(owner, repo);

    // Try cache first
    const { data: cached, error: cacheError } = await supabase
      .from('codeowners_suggestions')
      .select('suggestions, generated_content, total_contributors, generated_at')
      .eq('repository_id', repository.id)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cacheError && cached) {
      const resp = new Response(
        JSON.stringify({
          suggestions: cached.suggestions,
          codeOwnersContent: cached.generated_content,
          repository: `${owner}/${repo}`,
          totalContributors: cached.total_contributors,
          generatedAt: cached.generated_at,
          cached: true,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } }
      );
      return applyRateLimitHeaders(resp, rate);
    }

    // Check for existing CODEOWNERS to extract teams
    let existingTeams: string[] = [];
    try {
      const { data: codeowners } = await supabase
        .from('codeowners')
        .select('content')
        .eq('repository_id', repository.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (codeowners?.content) {
        // Extract team handles (format: @org/team) from existing CODEOWNERS
        const teamPattern = /@([a-zA-Z0-9-]+\/[a-zA-Z0-9-]+)/g;
        const matches = codeowners.content.match(teamPattern);
        if (matches) {
          existingTeams = [...new Set(matches)]; // Unique teams
          console.log(`Found existing teams in CODEOWNERS: ${existingTeams.join(', ')}`);
        }
      }
    } catch (e) {
      console.error('Failed to fetch existing CODEOWNERS:', e);
    }

    const contributorStats = await analyzeContributions(owner, repo);

    // Even if no individual contributors, we can still suggest teams
    if (contributorStats.size === 0 && existingTeams.length === 0) {
      const resp = new Response(
        JSON.stringify({ suggestions: [], message: 'No contribution data available for analysis', repository: `${owner}/${repo}` }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
      return applyRateLimitHeaders(resp, rate);
    }

    let suggestions = generateCodeOwnersSuggestions(contributorStats, existingTeams);
    let codeOwnersContent = [
      '# CODEOWNERS file generated based on contribution analysis',
      '# Review and adjust these suggestions before using',
      '',
      ...suggestions.map((s) => `${s.pattern} ${s.owners.join(' ')} # ${s.reasoning} (confidence: ${(s.confidence * 100).toFixed(0)}%)`),
    ].join('\n');

    // LLM fallback or augmentation when no suggestions or explicit request
    const urlParams = new URL(req.url).searchParams;
    const useLLM = urlParams.get('llm') === '1' || suggestions.length === 0;
    const openAIKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (useLLM && openAIKey) {
      try {
        const prompt = `You are helping generate a CODEOWNERS file for ${owner}/${repo}.
${existingTeams.length > 0 ? `Existing team owners: ${existingTeams.join(', ')}` : ''}
We have these active contributors: ${Array.from(contributorStats.values())
          .map((s) => `${s.username} -> [${Array.from(s.directories).slice(0, 10).join(', ')}]`)
          .join('; ')}.
Suggest up to 10 patterns with owners (both @user and @org/team format). Include existing teams where appropriate.
Output lines in the format:
/path/ @owner1 @owner2 @org/team # reasoning (confidence: 80%)`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAIKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert at generating CODEOWNERS suggestions.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content?.trim();
          if (content) {
            codeOwnersContent = `# CODEOWNERS suggestions (LLM-assisted)\n# Review before committing\n\n${content}`;
            // If we had no suggestions before, create a minimal set from LLM content
            if (suggestions.length === 0) {
              suggestions = content
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line && !line.startsWith('#'))
                .map((line: string) => {
                  const [pattern, ...owners] = line.split(/\s+/);
                  return {
                    pattern,
                    owners: owners.filter((o) => o.startsWith('@')),
                    confidence: 0.6,
                    reasoning: 'LLM-assisted suggestion',
                  } as CodeOwnersSuggestion;
                });
            }
          }
        } else {
          console.error('OpenAI error:', await response.text());
        }
      } catch (e) {
        console.error('LLM suggestion error:', e);
      }
    } else if (useLLM) {
      // No OPENAI key in Netlify, but Supabase Edge Functions may have it
      try {
        const client = createSupabaseClient();
        const payload = {
          owner,
          repo,
          contributors: Array.from(contributorStats.values()).map((s) => ({
            username: s.username,
            contributions: s.contributions,
            files: s.files.slice(0, 50),
            directories: Array.from(s.directories).slice(0, 50),
          })),
        };
        const { data: fnData, error: fnError } = await (client as any).functions.invoke('codeowners-llm', {
          body: payload,
        });
        if (!fnError && fnData?.content) {
          const content = String(fnData.content);
          codeOwnersContent = `# CODEOWNERS suggestions (LLM-assisted via Supabase)\n# Review before committing\n\n${content}`;
          if (suggestions.length === 0) {
            suggestions = content
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line && !line.startsWith('#'))
              .map((line: string) => {
                const [pattern, ...owners] = line.split(/\s+/);
                return {
                  pattern,
                  owners: owners.filter((o) => o.startsWith('@')),
                  confidence: 0.6,
                  reasoning: 'LLM-assisted suggestion',
                } as CodeOwnersSuggestion;
              });
          }
        } else if (fnError) {
          console.error('codeowners-llm edge function error:', fnError);
        }
      } catch (e) {
        console.error('Failed to invoke codeowners-llm edge function:', e);
      }
    }

    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    try {
      await supabase.from('codeowners_suggestions').upsert({
        repository_id: repository.id,
        suggestions,
        generated_content: codeOwnersContent,
        total_contributors: contributorStats.size,
        generated_at: generatedAt,
        expires_at: expiresAt,
      }, { onConflict: 'repository_id' });
    } catch (e) {
      console.error('Failed to cache suggestions:', e);
    }

    const resp = new Response(
      JSON.stringify({ suggestions, codeOwnersContent, repository: `${owner}/${repo}` , totalContributors: contributorStats.size, generatedAt }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } }
    );
    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    console.error('Error in api-suggested-codeowners:', error);
    return createErrorResponse(`Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/suggested-codeowners',
};
