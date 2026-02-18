import type { Context } from '@netlify/functions';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, convertToModelMessages, jsonSchema } from 'ai';
import { getSupabaseClient } from './_shared/supabase-client';
import { getSupabaseClients } from './lib/api-key-clients';
type DatapipeClient = typeof import('./lib/gh-datapipe-client.mts');

let _datapipeCache: DatapipeClient | null | undefined;
async function getDatapipe(): Promise<DatapipeClient | null> {
  if (_datapipeCache !== undefined) return _datapipeCache;
  try {
    _datapipeCache = await import('./lib/gh-datapipe-client.mts');
  } catch (err) {
    console.error('[chat] Failed to load gh-datapipe client: %s', err);
    _datapipeCache = null;
  }
  return _datapipeCache;
}

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

const BASE_CAPABILITIES = [
  '- **Repository overview**: description, stars, forks, language, and recent PR count',
  '- **Pull requests needing attention**: open PRs ranked by urgency based on age and size',
  '- **Repository health score**: an assessment based on merge times, activity levels, and stale PRs',
  '- **Actionable recommendations**: suggestions to improve repo health and contributor experience',
];

const DATAPIPE_CAPABILITIES = [
  '- **Contributor rankings**: top contributors ranked by quality score, with confidence and activity breakdowns',
  '- **Lottery factor**: how concentrated contributions are among top contributors, plus contributor of the month',
  '- **Activity feed**: daily breakdown of PRs opened/merged, reviews, and issues',
];

function buildSystemPrompt(hasDatapipe: boolean): string {
  const capabilities = hasDatapipe
    ? [...BASE_CAPABILITIES, ...DATAPIPE_CAPABILITIES]
    : BASE_CAPABILITIES;

  const examples = hasDatapipe
    ? [
        '"Who are the top contributors?"',
        '"What\'s the lottery factor?"',
        '"How active is this repo?"',
        '"Which PRs need attention right now?"',
      ]
    : [
        '"How healthy is this repo?"',
        '"Which PRs need attention right now?"',
        '"What recommendations do you have?"',
      ];

  return `You are a helpful repository insights assistant for a GitHub repository.
You help maintainers understand their repository health and areas needing attention.

You can answer questions about these topics using your tools:
${capabilities.join('\n')}

When users ask about topics outside these capabilities (e.g. commit history or specific code changes), be honest that you cannot look that up yet and suggest things you *can* help with as brief, natural-language example questions they can try. For example:
${examples.map((e) => `- ${e}`).join('\n')}

When users ask questions within your capabilities, use the available tools to fetch real data.
Keep responses concise and actionable. Use the tool results to provide data-backed answers.
Format your text responses with markdown for readability.`;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { anon: supabaseAnon } = getSupabaseClients();
    const {
      data: { user },
      error: authError,
    } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    console.log('[chat] Received request with keys: %s', Object.keys(body).join(', '));
    const { messages: uiMessages, owner, repo, timeRange: rawTimeRange = '30' } = body;

    if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

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
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Validate timeRange: must parse to a finite positive number, default 30
    const parsedTimeRange = parseInt(rawTimeRange, 10);
    const timeRange =
      Number.isFinite(parsedTimeRange) && parsedTimeRange > 0 ? parsedTimeRange : 30;

    const openai = buildOpenAIProvider();
    const tapesHeaders = buildTapesHeaders(owner, repo);
    const supabase = getSupabaseClient();

    // Check datapipe availability once, before building tools
    const dp = await getDatapipe();
    const hasDatapipe = dp?.isConfigured() === true;

    // Look up repo ID once to share across all tools
    const { data: repoRow } = await supabase
      .from('repositories')
      .select(
        'id, description, stargazers_count, forks_count, language, open_issues_count, owner, name'
      )
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    const repoId: number | null = repoRow?.id ?? null;

    const result = streamText({
      model: openai('gpt-4.1'),
      system: buildSystemPrompt(hasDatapipe),
      messages: [
        {
          role: 'user' as const,
          content: `[Repository context: ${owner}/${repo}]`,
        },
        ...messages,
      ],
      tools: {
        get_repo_summary: tool({
          description:
            'Get a summary of the repository including description, stars, language, and recent activity stats',
          inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
          execute: async () => {
            if (!repoRow) {
              return { error: 'Repository not found in database' };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - timeRange);

            const { count: recentPrCount } = await supabase
              .from('pull_requests')
              .select('id', { count: 'exact', head: true })
              .eq('repository_id', repoId!)
              .gte('created_at', cutoffDate.toISOString());

            return {
              description: repoRow.description,
              stars: repoRow.stargazers_count,
              forks: repoRow.forks_count,
              language: repoRow.language,
              openIssues: repoRow.open_issues_count,
              recentPRs: recentPrCount || 0,
              timeRangeDays: timeRange,
            };
          },
        }),

        get_prs_needing_attention: tool({
          description: 'Get pull requests that need maintainer attention, sorted by urgency',
          inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
          execute: async () => {
            if (!repoId) {
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
              .eq('repository_id', repoId)
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
            if (!repoId) {
              return { score: 0, factors: [], recommendations: ['Repository not found'] };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - timeRange);
            const cutoffIso = cutoffDate.toISOString();

            const [prData, recentPRs, openPRs] = await Promise.all([
              supabase
                .from('pull_requests')
                .select('state, merged_at, created_at')
                .eq('repository_id', repoId)
                .gte('created_at', cutoffIso),
              supabase
                .from('pull_requests')
                .select('created_at')
                .eq('repository_id', repoId)
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
              supabase
                .from('pull_requests')
                .select('created_at')
                .eq('repository_id', repoId)
                .eq('state', 'open')
                .limit(500),
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
            if (!repoId) {
              return { recommendations: [] };
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - timeRange);
            const cutoffIso = cutoffDate.toISOString();

            const { data: allPRs } = await supabase
              .from('pull_requests')
              .select('state, merged_at, created_at, additions, deletions')
              .eq('repository_id', repoId)
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

        // Datapipe tools — only registered when the API is configured
        ...(hasDatapipe && dp
          ? {
              get_contributor_rankings: tool({
                description:
                  'Get top contributors ranked by quality score with confidence and activity breakdowns',
                inputSchema: jsonSchema({
                  type: 'object' as const,
                  properties: {
                    limit: {
                      type: 'number' as const,
                      description: 'Max contributors to return (default 20)',
                    },
                  },
                }),
                execute: async (input: { limit?: number }) => {
                  try {
                    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
                    const data = await dp.getContributors(owner, repo, limit);
                    if (!data) {
                      return { error: 'Could not reach analytics service' };
                    }
                    return {
                      repository: data.repository,
                      total: data.total,
                      contributors: data.contributors.map((c) => ({
                        login: c.login,
                        qualityScore: c.contribution_quality,
                        confidenceScore: c.confidence_score,
                        prsOpened: c.activity.prs_opened,
                        prsMerged: c.activity.prs_merged,
                        reviewsGiven: c.activity.reviews_given,
                        issuesOpened: c.activity.issues_opened,
                      })),
                    };
                  } catch (err) {
                    console.error('[chat] get_contributor_rankings error: %s', err);
                    return { error: 'Could not fetch contributor rankings' };
                  }
                },
              }),

              get_lottery_factor: tool({
                description:
                  'Get lottery factor rankings showing contribution concentration, plus contributor of the month and health trending score',
                inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
                execute: async () => {
                  try {
                    const data = await dp.getInsights(owner, repo);
                    if (!data) {
                      return { error: 'Could not reach analytics service' };
                    }
                    return {
                      repository: data.repository,
                      calculatedAt: data.calculated_at,
                      health: data.health
                        ? {
                            trendingScore: data.health.trending_score,
                            freshnessStatus: data.health.freshness_status,
                            isSignificantChange: data.health.is_significant_change,
                          }
                        : null,
                      lotteryFactor: data.lottery_factor?.top_contributors
                        ? data.lottery_factor.top_contributors.map((c) => ({
                            login: c.login,
                            weightedScore: c.weighted_score,
                            rank: c.rank,
                          }))
                        : null,
                      contributorOfMonth: data.contributor_of_month
                        ? {
                            login: data.contributor_of_month.login,
                            score: data.contributor_of_month.score,
                            month: data.contributor_of_month.month,
                          }
                        : null,
                    };
                  } catch (err) {
                    console.error('[chat] get_lottery_factor error: %s', err);
                    return { error: 'Could not fetch lottery factor' };
                  }
                },
              }),

              get_activity_feed: tool({
                description:
                  'Get daily activity breakdown including PRs opened/merged, reviews, and issues for a repository',
                inputSchema: jsonSchema({
                  type: 'object' as const,
                  properties: {
                    days: {
                      type: 'number' as const,
                      description: 'Number of days of activity (default 30)',
                    },
                  },
                }),
                execute: async (input: { days?: number }) => {
                  try {
                    const days = Math.min(Math.max(input.days ?? 30, 1), 365);
                    const data = await dp.getActivity(owner, repo, days);
                    if (!data) {
                      return { error: 'Could not reach analytics service' };
                    }
                    return {
                      repository: data.repository,
                      days: data.days,
                      activity: data.activity.map((d) => ({
                        date: d.date,
                        prsOpened: d.prs_opened,
                        prsMerged: d.prs_merged,
                        reviews: d.reviews,
                        issuesOpened: d.issues_opened,
                        issuesClosed: d.issues_closed,
                      })),
                    };
                  } catch (err) {
                    console.error('[chat] get_activity_feed error: %s', err);
                    return { error: 'Could not fetch activity feed' };
                  }
                },
              }),
            }
          : {}),
      },
      maxSteps: 5,
      headers: tapesHeaders,
      onError: ({ error }) => {
        console.error('[chat] streamText error: %s', error);
      },
    });

    return result.toUIMessageStreamResponse({
      headers: CORS_HEADERS,
      onError: (error) => {
        const msg = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('[chat] stream error: %s', msg);
        return msg;
      },
    });
  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};
