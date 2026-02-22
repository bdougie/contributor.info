/**
 * Contributor Sub-Agent
 *
 * Handles contributor intelligence tools: get_contributor_rankings,
 * get_lottery_factor, get_activity_feed.
 *
 * Called by the manager in chat.mts — never invoked directly by the client.
 * Returns early with a clear message if the datapipe client is unavailable.
 */

import { generateText, tool, jsonSchema, stepCountIs, type ModelMessage } from 'ai';
import type { AgentContext, SubAgentResult } from './repo-health-agent.mts';
import { trackLLMCall } from '../lib/llm-analytics.mts';

// Keep the last N messages to avoid unbounded context growth in long sessions.
// The first message (repo context prefix) is always preserved.
const MAX_HISTORY_MESSAGES = 10;

function capMessages(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return [messages[0], ...messages.slice(-(MAX_HISTORY_MESSAGES - 1))];
}
type DatapipeClient = typeof import('../lib/gh-datapipe-client.mts');

// ---------------------------------------------------------------------------
// Context extension
// ---------------------------------------------------------------------------

export interface ContributorAgentContext extends AgentContext {
  datapipe: DatapipeClient;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const CONTRIBUTOR_SYSTEM_PROMPT = `You are a contributor intelligence specialist with access to tools for contributor data.

Available tools:
- get_contributor_rankings: top contributors ranked by quality score with activity breakdowns
- get_lottery_factor: contribution concentration, contributor of the month, health trend
- get_activity_feed: daily breakdown of PRs opened/merged, reviews, and issues

Only call the tools that are relevant to the user's specific question. Do not call all tools for every request — for example, if the user only asks about the lottery factor, only call get_lottery_factor. If the user asks for a full contributor overview, call all relevant tools.

Return a concise, data-backed answer highlighting patterns and risks.`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function buildContributorTools(context: ContributorAgentContext) {
  const { owner, repo, datapipe } = context;

  return {
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
          const data = await datapipe.getContributors(owner, repo, limit);
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
          console.error('[contributor-agent] get_contributor_rankings error: %s', err);
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
          const data = await datapipe.getInsights(owner, repo);
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
          console.error('[contributor-agent] get_lottery_factor error: %s', err);
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
          const data = await datapipe.getActivity(owner, repo, days);
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
          console.error('[contributor-agent] get_activity_feed error: %s', err);
          return { error: 'Could not fetch activity feed' };
        }
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export async function runContributorAgent(
  context: ContributorAgentContext,
  userMessages: ModelMessage[]
): Promise<SubAgentResult> {
  const tools = buildContributorTools(context);

  const agentStart = Date.now();
  const result = await generateText({
    model: context.openai('gpt-4o-mini'),
    system: CONTRIBUTOR_SYSTEM_PROMPT,
    messages: capMessages(userMessages),
    tools,
    stopWhen: stepCountIs(3),
    headers: context.tapesHeaders,
  });

  const toolsInvoked = result.steps.flatMap((s) => s.toolCalls.map((tc) => tc.toolName as string));
  trackLLMCall({
    agent: 'contributor',
    model: 'gpt-4o-mini',
    inputTokens: result.usage.promptTokens,
    outputTokens: result.usage.completionTokens,
    latencyMs: Date.now() - agentStart,
    distinctId: context.distinctId,
    metadata: { tools_invoked: toolsInvoked, tools_invoked_count: toolsInvoked.length },
  });

  return {
    kind: 'sub-agent-result' as const,
    text: result.text,
    toolCalls: result.steps.flatMap((s) =>
      s.toolCalls.map((tc) => ({ toolCallId: tc.toolCallId, toolName: tc.toolName as string }))
    ),
    toolResults: result.steps.flatMap((s) =>
      s.toolResults.map((tr) => ({ toolCallId: tr.toolCallId, output: tr.output }))
    ),
  };
}
