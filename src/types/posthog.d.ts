/**
 * Type declarations for optional PostHog dependencies
 * These packages are dynamically imported and may not be installed
 */

declare module 'posthog-node' {
  export class PostHog {
    constructor(apiKey: string, options?: { host?: string });
    capture(params: {
      distinctId: string;
      event: string;
      properties?: Record<string, unknown>;
      groups?: Record<string, string>;
    }): void;
    shutdown(): Promise<void>;
  }
}

declare module '@posthog/ai' {
  export class OpenAI {
    constructor(options: { apiKey?: string; posthog?: unknown });
    chat: {
      completions: {
        create(params: {
          model: string;
          messages: Array<{ role: string; content: string }>;
          max_tokens?: number;
          temperature?: number;
          posthogDistinctId?: string;
          posthogTraceId?: string;
          posthogProperties?: Record<string, unknown>;
          posthogGroups?: Record<string, string>;
        }): Promise<{
          choices: Array<{
            message: {
              content?: string;
            };
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
          model: string;
        }>;
      };
    };
  }
}
