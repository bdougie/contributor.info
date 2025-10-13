/**
 * Type declarations for Deno environment to support cross-runtime code
 *
 * This file provides type definitions for Node.js globals (like `process`)
 * that are checked at runtime in env.ts for compatibility across Vite/Node/Deno.
 */

// Declare process as potentially undefined (runtime check handles actual availability)
declare const process: NodeJS.Process | undefined;

// Minimal NodeJS namespace needed for type checking
declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
  }
}
