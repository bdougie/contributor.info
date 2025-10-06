/**
 * Tests for PostHogOpenAIService
 * Verifies null guards for import.meta.env access in Node.js environments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PostHogOpenAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete (import.meta as { env?: unknown }).env;
  });

  it('should handle missing import.meta.env gracefully', async () => {
    // Simulate Node.js environment where import.meta.env might be undefined
    (import.meta as { env?: unknown }).env = undefined;

    // Dynamic import to get fresh instance
    const { posthogOpenAIService } = await import('../posthog-openai-service');

    // Should not throw and service should handle undefined env
    expect(() => posthogOpenAIService.isAvailable()).not.toThrow();
  });

  it('should fallback to process.env when import.meta.env is undefined', async () => {
    // Setup process.env BEFORE importing
    process.env.VITE_OPENAI_API_KEY = 'test-key-from-process';

    // Make import.meta.env undefined
    (import.meta as { env?: unknown }).env = undefined;

    // Reset module cache to force fresh singleton creation
    vi.resetModules();

    // Dynamic import to get fresh instance with new env vars
    const { posthogOpenAIService } = await import('../posthog-openai-service');

    // Should detect the key from process.env
    expect(posthogOpenAIService.isAvailable()).toBe(true);

    // Cleanup
    delete process.env.VITE_OPENAI_API_KEY;
  });

  it('should not crash when checking test environment with undefined import.meta.env', async () => {
    // Make import.meta.env undefined
    (import.meta as { env?: unknown }).env = undefined;

    const { posthogOpenAIService } = await import('../posthog-openai-service');

    // This should not throw even when import.meta.env is undefined
    expect(() => {
      posthogOpenAIService.isAvailable();
    }).not.toThrow();
  });

  it('should handle import.meta.env.MODE safely when undefined', async () => {
    // Setup a scenario where import.meta exists but env is undefined
    (import.meta as { env?: unknown }).env = undefined;

    const { posthogOpenAIService } = await import('../posthog-openai-service');

    // Setup a valid API key
    process.env.VITE_OPENAI_API_KEY = 'real-api-key';

    // Calling should not crash due to import.meta.env.MODE access
    expect(() => posthogOpenAIService.isAvailable()).not.toThrow();

    // Cleanup
    delete process.env.VITE_OPENAI_API_KEY;
  });
});
