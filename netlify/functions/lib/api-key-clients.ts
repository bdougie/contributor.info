import { Unkey } from '@unkey/api';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared client initialization for API key management functions.
 * These helpers use lazy initialization to read env vars at runtime.
 */

export function getUnkeyClient(): Unkey {
  return new Unkey({
    rootKey: process.env.UNKEY_ROOT_KEY || '',
  });
}

export function getUnkeyApiId(): string {
  return process.env.UNKEY_API_ID || '';
}

export interface SupabaseClients {
  admin: SupabaseClient;
  anon: SupabaseClient;
}

export function getSupabaseClients(): SupabaseClients {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  return {
    admin: createClient(supabaseUrl, supabaseServiceKey),
    anon: createClient(supabaseUrl, supabaseAnonKey),
  };
}

export function getSupabaseWithAuth(authHeader: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export const API_KEY_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Validation constants for API key creation
 */
export const API_KEY_VALIDATION = {
  MAX_KEY_NAME_LENGTH: 100,
  VALID_NAME_PATTERN: /^[a-zA-Z0-9\s\-_.]+$/,
  MAX_EXPIRY_DAYS: 365,
  MAX_KEYS_PER_USER: 50,
};

/**
 * Check if required Unkey environment variables are configured
 */
export function hasUnkeyConfig(): { hasRootKey: boolean; hasApiId: boolean } {
  return {
    hasRootKey: !!process.env.UNKEY_ROOT_KEY,
    hasApiId: !!process.env.UNKEY_API_ID,
  };
}

/**
 * Check if required Supabase environment variables are configured
 */
export function hasSupabaseConfig(): {
  hasUrl: boolean;
  hasServiceKey: boolean;
  hasAnonKey: boolean;
} {
  return {
    hasUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    hasServiceKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
    hasAnonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
  };
}
