/**
 * Browser stub for Inngest SDK
 *
 * The Inngest SDK uses Node.js-specific modules (like node:module) that cannot
 * be bundled for browser environments. This stub prevents the real SDK from being
 * imported in browser builds.
 *
 * All browser code should use `sendInngestEvent()` from client-safe.ts, which
 * routes events through API endpoints instead of directly calling the SDK.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

interface InngestStub {
  send: () => never;
}

/**
 * Mock Inngest class for browser builds
 * This satisfies type imports but should never be instantiated
 */
export class Inngest {
  constructor(_config?: Record<string, unknown>) {
    throw new Error(
      'Inngest SDK cannot be instantiated in browser. Use sendInngestEvent() from client-safe.ts'
    );
  }

  send(): never {
    throw new Error(
      'Direct inngest.send() not available in browser. Use sendInngestEvent() from client-safe.ts'
    );
  }
}

/**
 * Mock NonRetriableError for browser builds
 * Inngest function definitions import this, but functions don't run in browser
 */
export class NonRetriableError extends Error {
  constructor(message: string, _cause?: Error) {
    super(message);
    this.name = 'NonRetriableError';
    throw new Error(
      'Inngest functions cannot run in browser. This error should never be thrown in browser context.'
    );
  }
}

export const inngest: InngestStub = {
  send: () => {
    throw new Error(
      'Direct inngest.send() not available in browser. Use sendInngestEvent() from client-safe.ts'
    );
  },
};

// Re-export for compatibility
export default inngest;
