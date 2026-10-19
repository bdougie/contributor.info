/**
 * Resolve the signed-in Supabase user from a request's Authorization header.
 *
 * The backfill endpoints create service-role rows and start billable Fly
 * machines, so they must not be callable anonymously. Pattern matches
 * chat.mts: verify the bearer token with the anon client.
 */

import { createClient } from '@supabase/supabase-js';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export function bearerToken(headers: Record<string, string | undefined>): string | null {
  const raw = headers.authorization ?? headers.Authorization;
  if (!raw || !raw.startsWith('Bearer ')) return null;
  const token = raw.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function getUserFromAuthHeader(
  headers: Record<string, string | undefined>
): Promise<AuthenticatedUser | null> {
  const token = bearerToken(headers);
  if (!token) return null;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('[request-auth] SUPABASE_URL / SUPABASE_ANON_KEY not configured');
    return null;
  }

  try {
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch (error) {
    console.error('[request-auth] token verification failed: %s', error);
    return null;
  }
}
