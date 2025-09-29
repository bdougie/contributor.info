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
  const { data, error } = await supabase
    .from('github_contributions')
    .select(
      `contributor:github_contributors!inner(username,avatar_url), additions, deletions, commits, files_changed`
    )
    .eq('repository_id', `${owner}/${repo}`.toLowerCase())
    .order('commits', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const contributorMap = new Map<string, ContributorStats>();
  for (const c of data || []) {
    const username = c.contributor?.username;
    if (!username) continue;
    if (!contributorMap.has(username)) {
      contributorMap.set(username, { username, contributions: 0, files: [], directories: new Set() });
    }
    const stats = contributorMap.get(username)!;
    stats.contributions += c.commits || 0;
    if (Array.isArray(c.files_changed)) {
      for (const f of c.files_changed) {
        if (typeof f === 'string') {
          stats.files.push(f);
          const dir = f.substring(0, f.lastIndexOf('/'));
          if (dir) stats.directories.add(dir);
        }
      }
    }
  }
  return contributorMap;
}

function generateCodeOwnersSuggestions(contributorStats: Map<string, ContributorStats>): CodeOwnersSuggestion[] {
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
  for (const [dir, rec] of directoryOwnership) {
    const sorted = rec.owners.sort((a, b) => (contributorStats.get(b)!.contributions - contributorStats.get(a)!.contributions));
    const top = sorted.slice(0, 3).map((u) => `@${u}`);
    if (top.length > 0) {
      const confidence = Math.min(0.9, (rec.total / 100) * 0.3 + 0.3);
      suggestions.push({ pattern: `/${dir}/`, owners: top, confidence, reasoning: `Top ${top.length} contributor(s) to this directory` });
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
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
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

    const contributorStats = await analyzeContributions(owner, repo);
    if (contributorStats.size === 0) {
      const resp = new Response(
        JSON.stringify({ suggestions: [], message: 'No contribution data available for analysis', repository: `${owner}/${repo}` }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
      return applyRateLimitHeaders(resp, rate);
    }

    let suggestions = generateCodeOwnersSuggestions(contributorStats);
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
We have these active contributor directories with contributions: ${Array.from(contributorStats.values())
          .map((s) => `${s.username} -> [${Array.from(s.directories).slice(0, 10).join(', ')}]`)
          .join('; ')}.
Suggest up to 10 patterns with @user owners. Output lines in the format:
/path/ @owner1 @owner2 # reasoning (confidence: 80%)`;

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
