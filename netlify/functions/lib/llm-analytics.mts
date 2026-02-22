/**
 * LLM observability helpers for the multi-agent chat pipeline.
 *
 * Emits PostHog `$ai_generation` events for every LLM call so cost, latency,
 * and token usage are visible in PostHog's LLM analytics dashboards.
 *
 * All tracking is fire-and-forget — failures never affect chat responses.
 */

import { trackServerEvent } from './server-tracking.mts';

export interface LLMCallMetrics {
  /** Name of the agent that made the call, e.g. 'pre-processor', 'manager', 'repo-health', 'contributor', 'synthesizer' */
  agent: string;
  /** Model identifier, e.g. 'gpt-4o-mini', 'gpt-4.1' */
  model: string;
  /** Prompt (input) token count from the LLM response */
  inputTokens: number;
  /** Completion (output) token count from the LLM response */
  outputTokens: number;
  /** Wall-clock duration of the LLM call in milliseconds */
  latencyMs: number;
  /** PostHog distinct_id for per-user attribution — omit for anonymous */
  distinctId?: string;
  /** Extra properties merged into the event (agent-specific metadata) */
  metadata?: Record<string, unknown>;
}

/**
 * Emit a PostHog `$ai_generation` event for an LLM call.
 * Fire-and-forget: the returned promise is intentionally discarded.
 */
export function trackLLMCall(metrics: LLMCallMetrics): void {
  trackServerEvent(
    '$ai_generation',
    {
      $ai_provider: 'openai',
      $ai_model: metrics.model,
      $ai_input_tokens: metrics.inputTokens,
      $ai_output_tokens: metrics.outputTokens,
      $ai_latency: metrics.latencyMs,
      agent: metrics.agent,
      ...metrics.metadata,
    },
    metrics.distinctId
  ).catch((err) => {
    console.warn('[llm-analytics] Failed to track %s call: %s', metrics.agent, err);
  });
}
