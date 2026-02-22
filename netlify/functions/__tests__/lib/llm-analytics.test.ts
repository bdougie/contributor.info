import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackLLMCall, type LLMCallMetrics } from '../../lib/llm-analytics.mts';

// Mock server-tracking so we can inspect the properties passed to PostHog
const mockTrackServerEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/server-tracking.mts', () => ({
  trackServerEvent: (...args: unknown[]) => mockTrackServerEvent(...args),
}));

function baseMetrics(overrides: Partial<LLMCallMetrics> = {}): LLMCallMetrics {
  return {
    agent: 'test-agent',
    model: 'gpt-4o-mini',
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 200,
    ...overrides,
  };
}

describe('trackLLMCall', () => {
  beforeEach(() => {
    mockTrackServerEvent.mockClear();
  });

  it('emits $ai_generation event with required properties', () => {
    trackLLMCall(baseMetrics());

    expect(mockTrackServerEvent).toHaveBeenCalledOnce();
    const [event, properties] = mockTrackServerEvent.mock.calls[0];
    expect(event).toBe('$ai_generation');
    expect(properties).toMatchObject({
      $ai_provider: 'openai',
      $ai_model: 'gpt-4o-mini',
      $ai_input_tokens: 100,
      $ai_output_tokens: 50,
      $ai_latency: 200,
      agent: 'test-agent',
    });
  });

  it('includes $ai_cached_tokens when cachedTokens is provided', () => {
    trackLLMCall(baseMetrics({ cachedTokens: 64 }));

    const properties = mockTrackServerEvent.mock.calls[0][1];
    expect(properties.$ai_cached_tokens).toBe(64);
  });

  it('includes $ai_cached_tokens when cachedTokens is 0', () => {
    trackLLMCall(baseMetrics({ cachedTokens: 0 }));

    const properties = mockTrackServerEvent.mock.calls[0][1];
    expect(properties.$ai_cached_tokens).toBe(0);
  });

  it('omits $ai_cached_tokens when cachedTokens is not provided', () => {
    trackLLMCall(baseMetrics());

    const properties = mockTrackServerEvent.mock.calls[0][1];
    expect(properties).not.toHaveProperty('$ai_cached_tokens');
  });

  it('passes distinctId as the third argument', () => {
    trackLLMCall(baseMetrics({ distinctId: 'user-123' }));

    const distinctId = mockTrackServerEvent.mock.calls[0][2];
    expect(distinctId).toBe('user-123');
  });

  it('merges metadata into event properties', () => {
    trackLLMCall(baseMetrics({ metadata: { intent: 'health', tools_count: 3 } }));

    const properties = mockTrackServerEvent.mock.calls[0][1];
    expect(properties.intent).toBe('health');
    expect(properties.tools_count).toBe(3);
  });

  it('does not throw when trackServerEvent rejects', () => {
    mockTrackServerEvent.mockRejectedValueOnce(new Error('network error'));

    // Should not throw — fire-and-forget
    expect(() => trackLLMCall(baseMetrics())).not.toThrow();
  });
});
