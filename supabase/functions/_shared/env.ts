/**
 * Environment variable access for Supabase Edge Functions (Deno runtime)
 *
 * This is a Deno-specific version that uses Deno.env instead of import.meta.env or process.env.
 * For cross-runtime code, see ../../src/lib/env.ts
 */

export const env = {
  // Supabase configuration
  SUPABASE_URL: Deno.env.get('SUPABASE_URL') || '',
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') || '',
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',

  // GitHub configuration
  GITHUB_TOKEN: Deno.env.get('GITHUB_TOKEN') || '',

  // Runtime detection
  get isDeno() {
    return true;
  },
  get isServer() {
    return true;
  },
  get isBrowser() {
    return false;
  },
};

export const serverEnv = env;
export const clientEnv = env;
