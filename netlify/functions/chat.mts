import type { Context } from '@netlify/functions';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, convertToModelMessages, jsonSchema } from 'ai';
import { getSupabaseClient } from './_shared/supabase-client';

function buildOpenAIProvider() {
  const tapesProxyUrl = process.env.TAPES_PROXY_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return createOpenAI({
    apiKey,
    ...(tapesProxyUrl && { baseURL: tapesProxyUrl }),
  });
}

function buildTapesHeaders(owner: string, repo: string): Record<string, string> {
  const tapesProxyUrl = process.env.TAPES_PROXY_URL;
  if (!tapesProxyUrl) return {};

  return {
    'X-Tapes-Session': `${owner}/${repo}`,
    'X-Tapes-App': 'contributor-info',
    'X-Tapes-Environment': process.env.CONTEXT || 'development',
  };
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    console.log('[chat] Received request with keys: %s', Object.keys(body).join(', '));
    const { messages: uiMessages, owner, repo, timeRange = '30' } = body;
    const messages = await convertToModelMessages(uiMessages);

    const GITHUB_NAME_RE = /^[a-zA-Z0-9._-]{1,100}$/;
    if (
      typeof owner !== 'string' ||
      typeof repo !== 'string' ||
      !GITHUB_NAME_RE.test(owner) ||
      !GITHUB_NAME_RE.test(repo)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid owner or repo format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = buildOpenAIProvider();
    const tapesHeaders = buildTapesHeaders(owner, repo);
    const supabase = getSupabaseClient();

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: `You are a helpful repository insights assistant for the GitHub repository "${owner}/${repo}".
You help maintainers understand their repository health, contributor activity, and areas needing attention.

When users ask questions about PRs, health, recommendations, or summaries, use the available tools to fetch real data.
Keep responses concise and actionable. Use the tool results to provide data-backed answers.
Format your text responses with markdown for readability.`,
      messages,
      tools: {
        get_repo_summary: tool({
          description:
            'Get a summary of the repository including description, stars, language, and recent activity stats',
          inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
          execute: async () => {
            const { data: repoData } = await supabase
              .from('repositories')
              .select(
                'id, description, stargazers_count, forks_count, language, open_issues_count, owner, name'
              )
              .eq('owner', owner)
              .eq('name', repo)
              .maybeSingle();

            if (!repoData) {
              return { error: 'Repository not found in database' };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

            const { count: recentPrCount } = await supabase
              .from('pull_requests')
              .select('id', { count: 'exact', head: true })
              .eq('repository_id', repoData.id)
              .gte('created_at', cutoffDate.toISOString());

            return {
              description: repoData.description,
              stars: repoData.stargazers_count,
              forks: repoData.forks_count,
              language: repoData.language,
              openIssues: repoData.open_issues_count,
              recentPRs: recentPrCount || 0,
              timeRangeDays: timeRange,
            };
          },
        }),

        get_prs_needing_attention: tool({
          description: 'Get pull requests that need maintainer attention, sorted by urgency',
          inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
          execute: async () => {
            const { data: repoRow } = await supabase
              .from('repositories')
              .select('id')
              .eq('owner', owner)
              .eq('name', repo)
              .maybeSingle();

            if (!repoRow) {
              return {
                alerts: [],
                metrics: {
                  totalAlerts: 0,
                  criticalCount: 0,
                  highCount: 0,
                  mediumCount: 0,
                  lowCount: 0,
                },
              };
            }

            const { data: openPRs } = await supabase
              .from('pull_requests')
              .select(
                'id, number, title, state, created_at, updated_at, additions, deletions, contributors!inner(username, avatar_url)'
              )
              .eq('repository_id', repoRow.id)
              .eq('state', 'open')
              .order('created_at', { ascending: true })
              .limit(20);

            if (!openPRs || openPRs.length === 0) {
              return {
                alerts: [],
                metrics: {
                  totalAlerts: 0,
                  criticalCount: 0,
                  highCount: 0,
                  mediumCount: 0,
                  lowCount: 0,
                },
              };
            }

            const now = new Date();
            const alerts = openPRs
              .map((pr) => {
                const created = new Date(pr.created_at);
                const updated = new Date(pr.updated_at);
                const daysSinceCreated = Math.floor(
                  (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
                );
                const daysSinceUpdated = Math.floor(
                  (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
                );
                const linesChanged = (pr.additions || 0) + (pr.deletions || 0);

                let urgencyScore = 0;
                const reasons: string[] = [];

                if (daysSinceCreated >= 7) {
                  reasons.push(`Open for ${daysSinceCreated} days`);
                  urgencyScore += Math.min(daysSinceCreated * 2, 40);
                }
                if (daysSinceUpdated >= 3) {
                  reasons.push(`No updates for ${daysSinceUpdated} days`);
                  urgencyScore += daysSinceUpdated * 3;
                }
                if (linesChanged > 1000) {
                  reasons.push('Very large PR');
                  urgencyScore += 20;
                }

                let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
                if (urgencyScore >= 70) urgency = 'critical';
                else if (urgencyScore >= 50) urgency = 'high';
                else if (urgencyScore >= 30) urgency = 'medium';

                const contributors = pr.contributors as Array<{
                  username: string;
                  avatar_url: string;
                }>;
                const author = contributors?.[0]?.username || 'unknown';

                return {
                  number: pr.number,
                  title: pr.title,
                  author,
                  urgency,
                  urgencyScore: Math.min(urgencyScore, 100),
                  reasons: reasons.length > 0 ? reasons : ['Needs review'],
                  daysSinceCreated,
                  linesChanged,
                  url: `https://github.com/${owner}/${repo}/pull/${pr.number}`,
                };
              })
              .filter((a) => a.urgencyScore > 20);

            alerts.sort((a, b) => b.urgencyScore - a.urgencyScore);

            const metrics = {
              totalAlerts: alerts.length,
              criticalCount: alerts.filter((a) => a.urgency === 'critical').length,
              highCount: alerts.filter((a) => a.urgency === 'high').length,
              mediumCount: alerts.filter((a) => a.urgency === 'medium').length,
              lowCount: alerts.filter((a) => a.urgency === 'low').length,
            };

            return { alerts: alerts.slice(0, 5), metrics };
          },
        }),

        get_health_assessment: tool({
          description:
            'Get an AI health assessment of the repository including score and contributing factors',
          inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
          execute: async () => {
            const { data: repoRow } = await supabase
              .from('repositories')
              .select('id, stargazers_count, forks_count')
              .eq('owner', owner)
              .eq('name', repo)
              .maybeSingle();

            if (!repoRow) {
              return { score: 0, factors: [], recommendations: ['Repository not found'] };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));
            const cutoffIso = cutoffDate.toISOString();

            const [prData, recentPRs, openPRs] = await Promise.all([
              supabase
                .from('pull_requests')
                .select('state, merged_at, created_at')
                .eq('repository_id', repoRow.id)
                .gte('created_at', cutoffIso),
              supabase
                .from('pull_requests')
                .select('created_at')
                .eq('repository_id', repoRow.id)
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
              supabase
                .from('pull_requests')
                .select('created_at')
                .eq('repository_id', repoRow.id)
                .eq('state', 'open'),
            ]);

            const allPRs = prData.data || [];
            const mergedPRs = allPRs.filter((pr) => pr.merged_at);
            const weeklyPRs = recentPRs.data || [];
            const stalePRs = (openPRs.data || []).filter((pr) => {
              const created = new Date(pr.created_at);
              return (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) > 7;
            });

            const factors: Array<{
              name: string;
              score: number;
              status: string;
              description: string;
            }> = [];
            const recommendations: string[] = [];

            // Merge time
            let mergeTimeScore = 100;
            if (mergedPRs.length > 0) {
              const avgMergeHours =
                mergedPRs.reduce((sum, pr) => {
                  return (
                    sum +
                    (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) /
                      (1000 * 60 * 60)
                  );
                }, 0) / mergedPRs.length;
              if (avgMergeHours > 168) {
                mergeTimeScore = 50;
                recommendations.push('PR merge times are high - consider review SLAs');
              } else if (avgMergeHours > 72) {
                mergeTimeScore = 70;
                recommendations.push('Consider streamlining PR review process');
              } else if (avgMergeHours > 24) {
                mergeTimeScore = 85;
              }
              factors.push({
                name: 'PR Merge Time',
                score: mergeTimeScore,
                status:
                  mergeTimeScore >= 80 ? 'good' : mergeTimeScore >= 60 ? 'warning' : 'critical',
                description: `Average ${Math.round(avgMergeHours)} hours`,
              });
            }

            // Activity
            const activityScore = weeklyPRs.length === 0 ? 30 : weeklyPRs.length < 3 ? 70 : 100;
            if (weeklyPRs.length === 0) recommendations.push('No activity in the past week');
            factors.push({
              name: 'Activity Level',
              score: activityScore,
              status: activityScore >= 80 ? 'good' : activityScore >= 60 ? 'warning' : 'critical',
              description: `${weeklyPRs.length} PRs in the last 7 days`,
            });

            // Stale PRs
            const staleRatio = openPRs.data?.length ? stalePRs.length / openPRs.data.length : 0;
            const responseScore = staleRatio > 0.5 ? 50 : staleRatio > 0.25 ? 75 : 100;
            if (staleRatio > 0.5)
              recommendations.push('Many PRs are stale - establish response time SLAs');
            factors.push({
              name: 'Response Time',
              score: responseScore,
              status: responseScore >= 80 ? 'good' : responseScore >= 60 ? 'warning' : 'critical',
              description: `${stalePRs.length} PRs open > 7 days`,
            });

            const totalWeight = factors.length;
            const overallScore =
              totalWeight > 0
                ? Math.round(factors.reduce((sum, f) => sum + f.score, 0) / totalWeight)
                : 0;

            return {
              score: overallScore,
              factors,
              recommendations: recommendations.slice(0, 3),
              assessedAt: new Date().toISOString(),
            };
          },
        }),

        get_recommendations: tool({
          description:
            'Get actionable recommendations to improve repository health and contributor experience',
          inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
          execute: async () => {
            const { data: repoRow } = await supabase
              .from('repositories')
              .select('id')
              .eq('owner', owner)
              .eq('name', repo)
              .maybeSingle();

            if (!repoRow) {
              return { recommendations: [] };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));
            const cutoffIso = cutoffDate.toISOString();

            const { data: allPRs } = await supabase
              .from('pull_requests')
              .select('state, merged_at, created_at, additions, deletions')
              .eq('repository_id', repoRow.id)
              .gte('created_at', cutoffIso);

            const prs = allPRs || [];
            const recommendations: Array<{
              title: string;
              priority: 'high' | 'medium' | 'low';
              description: string;
              impact: string;
              type: string;
            }> = [];

            const mergedPRs = prs.filter((pr) => pr.merged_at);
            if (mergedPRs.length > 0) {
              const avgMergeHours =
                mergedPRs.reduce((sum, pr) => {
                  return (
                    sum +
                    (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) /
                      (1000 * 60 * 60)
                  );
                }, 0) / mergedPRs.length;
              if (avgMergeHours > 72) {
                recommendations.push({
                  title: 'Reduce PR merge times',
                  priority: 'high',
                  description: `Average merge time is ${Math.round(avgMergeHours)} hours. Consider setting review SLAs.`,
                  impact: 'Faster delivery and happier contributors',
                  type: 'process',
                });
              }
            }

            const largePRs = prs.filter((pr) => (pr.additions || 0) + (pr.deletions || 0) > 500);
            if (largePRs.length > prs.length * 0.3) {
              recommendations.push({
                title: 'Encourage smaller pull requests',
                priority: 'medium',
                description: `${Math.round((largePRs.length / prs.length) * 100)}% of PRs are over 500 lines.`,
                impact: 'Easier reviews and fewer bugs',
                type: 'quality',
              });
            }

            const weeklyPRs = prs.filter((pr) => {
              const created = new Date(pr.created_at);
              return (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) <= 7;
            });
            if (weeklyPRs.length < 3) {
              recommendations.push({
                title: 'Boost development velocity',
                priority: 'medium',
                description:
                  'Only ' +
                  weeklyPRs.length +
                  ' PRs in the last week. Consider breaking features into smaller tasks.',
                impact: 'Maintain development momentum',
                type: 'process',
              });
            }

            recommendations.push({
              title: 'Add good-first-issue labels',
              priority: 'low',
              description: 'Label issues to attract new contributors and grow the community.',
              impact: 'Grow contributor base',
              type: 'contributor',
            });

            return { recommendations: recommendations.slice(0, 4) };
          },
        }),
      },
      maxSteps: 3,
      headers: tapesHeaders,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
