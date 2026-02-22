import type { Context } from '@netlify/functions';
import { createOpenAI } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  tool,
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
} from 'ai';
import { getSupabaseClient } from './_shared/supabase-client';
import { getSupabaseClients } from './lib/api-key-clients';
import {
  runRepoHealthAgent,
  type AgentContext,
  type RepoRow,
  type SubAgentResult,
} from './agents/repo-health-agent.mts';
import { runContributorAgent, type ContributorAgentContext } from './agents/contributor-agent.mts';
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

interface RAGItem {
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

function formatRelativeTime(isoDate: string): string {
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

interface EmbedQueryResponse {
  embedding: number[];
  dimensions: number;
  elapsed_ms: number;
}

/**
 * Retrieve RAG context by embedding the user query and searching for similar items.
 * Returns a formatted markdown context block, or null if unavailable.
 */
async function retrieveRAGContext(
  queryText: string,
  repoId: string,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<string | null> {
  const edgeFunctionUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!edgeFunctionUrl || !serviceRoleKey) {
    console.log('[chat] RAG skipped: missing Supabase URL or service role key');
    return null;
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
      body: JSON.stringify({ text: queryText }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!embedResponse.ok) {
      console.log('[chat] RAG embed-query returned %d', embedResponse.status);
      return null;
    }

    const embedData: EmbedQueryResponse = await embedResponse.json();
    embedding = embedData.embedding;
  } catch (err) {
    clearTimeout(timeout);
    const reason = err instanceof Error ? err.message : String(err);
    console.log('[chat] RAG embed-query failed: %s', reason);
    return null;
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
    console.log('[chat] RAG RPC error: %s', rpcError.message);
    return null;
  }

  // Step 3: Filter by similarity threshold and format
  const items = (similarItems as RAGItem[] | null) ?? [];
  const relevant = items.filter((item) => item.similarity > 0.3);

  const elapsed = Date.now() - start;
  console.log('[chat] RAG retrieval: %dms, %d items', elapsed, relevant.length);

  if (relevant.length === 0) {
    return null;
  }

  const lines = relevant.map((item) => {
    const typeLabel = item.item_type === 'pull_request' ? 'PR' : item.item_type;
    const author = item.author_login ? ` by @${item.author_login}` : '';
    const timeAgo = item.created_at ? `, ${formatRelativeTime(item.created_at)}` : '';
    let line = `- [${typeLabel} #${item.number}](${item.url})${author} (${item.state}${timeAgo}): ${item.title}`;
    if (item.body_preview) {
      line += `\n  > ${item.body_preview.replace(/\n/g, ' ')}`;
    }
    return line;
  });

  return `\n\n## Related Repository Activity (from semantic search)\nThe following items from this repository are semantically related to the user's question:\n${lines.join('\n')}\n\nUse this context to provide more informed answers when relevant. Cite specific PRs, issues, or discussions when they help answer the question.`;
}

const BASE_CAPABILITIES = [
  '- **Repository overview**: description, stars, forks, language, and recent PR count',
  '- **Pull requests needing attention**: open PRs ranked by urgency based on age and size',
  '- **Repository health score**: an assessment based on merge times, activity levels, and stale PRs',
  '- **Actionable recommendations**: suggestions to improve repo health and contributor experience',
  '- **Related activity**: semantically related PRs, issues, and discussions from the repository',
];

const DATAPIPE_CAPABILITIES = [
  '- **Contributor rankings**: top contributors ranked by quality score, with confidence and activity breakdowns',
  '- **Lottery factor**: how concentrated contributions are among top contributors, plus contributor of the month',
  '- **Activity feed**: daily breakdown of PRs opened/merged, reviews, and issues',
  '- **Repository discovery**: find repositories by language, topic, or criteria with usage statistics',
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
        '"Which repos use TypeScript?"',
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

function buildManagerSystemPrompt(hasDatapipe: boolean): string {
  const toolList = hasDatapipe
    ? '- get_repo_health: repository summary, PRs needing attention, health score, recommendations\n- get_contributor_intelligence: contributor rankings, lottery factor, activity feed\n- discover_repos: find repositories by language, topic, or criteria'
    : '- get_repo_health: repository summary, PRs needing attention, health score, recommendations';

  return `You are an orchestration manager for repository analysis. Your job is to call the right sub-agent tools to answer the user's question.

Available tools:
${toolList}

When the user's question spans multiple domains (e.g. "How healthy is this repo AND who are the top contributors?"), call both sub-agents in the same step so they run in parallel.
When the question is domain-specific, call only the relevant sub-agent.
Do not answer directly — always use tools to fetch real data.`;
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

    // Look up repo once to share across all agents — avoids duplicate queries
    const { data: repoRow } = await supabase
      .from('repositories')
      .select(
        'id, description, stargazers_count, forks_count, language, open_issues_count, owner, name'
      )
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    const repoId: string | null = repoRow?.id ?? null;
    const repoData: RepoRow | null = repoRow
      ? {
          description: repoRow.description,
          stargazers_count: repoRow.stargazers_count,
          forks_count: repoRow.forks_count,
          language: repoRow.language,
          open_issues_count: repoRow.open_issues_count,
        }
      : null;

    // Shared context passed to sub-agents
    const agentContext: AgentContext = {
      owner,
      repo,
      repoId,
      repoData,
      timeRange,
      supabase,
      openai,
      tapesHeaders,
    };

    // Retrieve RAG context from vector embeddings (non-blocking, graceful fallback)
    let ragContext: string | null = null;
    if (repoId) {
      const lastUserMessage = [...uiMessages]
        .reverse()
        .find(
          (m: { role: string; content?: string | Array<{ type: string; text?: string }> }) =>
            m.role === 'user'
        );
      const queryText =
        typeof lastUserMessage?.content === 'string'
          ? lastUserMessage.content
          : Array.isArray(lastUserMessage?.content)
            ? ((
                lastUserMessage.content.find(
                  (p: { type: string; text?: string }) => p.type === 'text'
                ) as { type: string; text?: string } | undefined
              )?.text ?? '')
            : '';

      if (queryText.trim().length > 0) {
        try {
          ragContext = await retrieveRAGContext(queryText, repoId, supabase);
        } catch (err) {
          console.log('[chat] RAG retrieval error (non-fatal): %s', err);
        }
      }
    }

    const systemPrompt = buildSystemPrompt(hasDatapipe) + (ragContext ?? '');

    const conversationMessages = [
      {
        role: 'user' as const,
        content: `[Repository context: ${owner}/${repo}]`,
      },
      ...messages,
    ];

    // Build manager tools — each dispatches to a focused sub-agent
    const managerTools = {
      get_repo_health: tool({
        description:
          'Get repository health data: summary, PRs needing attention, health score, recommendations',
        inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
        execute: async () => runRepoHealthAgent(agentContext, conversationMessages),
      }),
      ...(hasDatapipe && dp
        ? {
            get_contributor_intelligence: tool({
              description: 'Get contributor data: rankings, lottery factor, activity feed',
              inputSchema: jsonSchema({ type: 'object' as const, properties: {} }),
              execute: async () => {
                const contributorContext: ContributorAgentContext = {
                  ...agentContext,
                  datapipe: dp,
                };
                return runContributorAgent(contributorContext, conversationMessages);
              },
            }),
            discover_repos: tool({
              description:
                'Discover repositories by language, topic, or criteria with usage statistics',
              inputSchema: jsonSchema({
                type: 'object' as const,
                properties: {
                  language: {
                    type: 'string' as const,
                    description: 'Filter by programming language',
                  },
                  topic: {
                    type: 'string' as const,
                    description: 'Filter by topic or keyword',
                  },
                  min_stars: {
                    type: 'number' as const,
                    description: 'Minimum star count',
                  },
                  limit: {
                    type: 'number' as const,
                    description: 'Max results (default 10)',
                  },
                },
              }),
              execute: async (input: {
                language?: string;
                topic?: string;
                min_stars?: number;
                limit?: number;
              }) => {
                try {
                  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
                  const discoverData = await dp.discoverRepos({
                    language: input.language,
                    topic: input.topic,
                    min_stars: input.min_stars,
                    limit,
                  });
                  if (!discoverData) {
                    return { error: 'Could not reach analytics service' };
                  }

                  const stats = await dp.getDiscoveryStats(discoverData.config_id);

                  return {
                    repositories: discoverData.repositories.map((r) => ({
                      owner: r.owner,
                      name: r.name,
                      language: r.language,
                      stars: r.stars,
                      description: r.description,
                    })),
                    stats: stats
                      ? {
                          total: stats.total,
                          languageBreakdown: stats.language_breakdown,
                          avgStars: stats.avg_stars,
                        }
                      : null,
                  };
                } catch (err) {
                  console.error('[chat] discover_repos error: %s', err);
                  return { error: 'Could not discover repositories' };
                }
              },
            }),
          }
        : {}),
    };

    // Phase 1: Manager dispatches to sub-agents using generateText.
    // When the LLM issues parallel tool calls in one step, sub-agents run concurrently.
    // stopWhen is reduced to 3 — the manager needs fewer steps than a direct tool runner.
    const managerResult = await generateText({
      model: openai('gpt-4o-mini'),
      system: buildManagerSystemPrompt(hasDatapipe),
      messages: conversationMessages,
      tools: managerTools,
      stopWhen: stepCountIs(3),
      headers: tapesHeaders,
    });

    const hasToolCalls = managerResult.steps.some((s) => s.toolCalls.length > 0);

    if (!hasToolCalls) {
      // No tools used — serve the already-generated text directly via
      // createUIMessageStream so we don't waste a second LLM call.
      const text = managerResult.text;
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: 'text-start', id: 'text-0' });
          writer.write({ type: 'text-delta', id: 'text-0', delta: text });
          writer.write({ type: 'text-end', id: 'text-0' });
        },
        onError: (error) => {
          const msg = error instanceof Error ? error.message : 'An unknown error occurred';
          console.error('[chat] stream error: %s', msg);
          return msg;
        },
      });

      return createUIMessageStreamResponse({ stream, headers: CORS_HEADERS });
    }

    // Phase 2: Tools were called — stream a final response with gpt-4.1 for quality,
    // using the full manager step history (tool calls + results) as context.
    const textResult = streamText({
      model: openai('gpt-4.1'),
      system: systemPrompt,
      messages: [...conversationMessages, ...managerResult.response.messages],
      headers: tapesHeaders,
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Stream the LLM's text summary first.
        // Single text part per response — hardcoded ID is intentional.
        writer.write({ type: 'text-start', id: 'text-0' });
        for await (const chunk of textResult.textStream) {
          writer.write({ type: 'text-delta', id: 'text-0', delta: chunk });
        }
        writer.write({ type: 'text-end', id: 'text-0' });

        // Re-emit sub-agent tool events so the client creates
        // dynamic-tool parts and renders rich UI cards.
        // The manager's tool results contain SubAgentResult objects
        // with the original tool names that card components rely on.
        // Cards "pop in" after the text summary — a known trade-off of the
        // two-phase approach (AI SDK doesn't support interleaving mid-text).
        try {
          for (const step of managerResult.steps) {
            // Build a toolCallId → toolName map for manager-level tools (e.g. discover_repos)
            const managerToolNames = new Map(
              step.toolCalls.map((tc) => [tc.toolCallId, tc.toolName as string])
            );

            for (const tr of step.toolResults) {
              const subResult = tr.output as SubAgentResult | undefined;

              if (subResult?.kind === 'sub-agent-result') {
                // Sub-agent result — re-emit individual tool events with original tool names
                for (const tc of subResult.toolCalls) {
                  writer.write({
                    type: 'tool-input-start',
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    dynamic: true,
                  });
                }
                for (const subTr of subResult.toolResults) {
                  const output = subTr.output as Record<string, unknown> | undefined;
                  if (output && typeof output === 'object' && 'error' in output) {
                    continue;
                  }
                  writer.write({
                    type: 'tool-output-available',
                    toolCallId: subTr.toolCallId,
                    output: subTr.output,
                    dynamic: true,
                  });
                }
              } else {
                // Manager-level tool (discover_repos) — emit directly using the manager's tool call id
                const output = tr.output as Record<string, unknown> | undefined;
                if (output && typeof output === 'object' && 'error' in output) {
                  continue;
                }
                const toolName = managerToolNames.get(tr.toolCallId) ?? tr.toolCallId;
                writer.write({
                  type: 'tool-input-start',
                  toolCallId: tr.toolCallId,
                  toolName,
                  dynamic: true,
                });
                writer.write({
                  type: 'tool-output-available',
                  toolCallId: tr.toolCallId,
                  output: tr.output,
                  dynamic: true,
                });
              }
            }
          }
        } catch (toolEventErr) {
          console.error('[chat] Failed to emit tool events: %s', toolEventErr);
        }
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('[chat] stream error: %s', msg);
        return msg;
      },
    });

    return createUIMessageStreamResponse({ stream, headers: CORS_HEADERS });
  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};
