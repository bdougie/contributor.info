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

interface InngestStub {
  send: () => never;
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
