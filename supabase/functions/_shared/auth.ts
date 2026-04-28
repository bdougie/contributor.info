import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface AuthOptions {
  /**
   * Accept the project's service-role key as a trusted backend caller (no user
   * context). Use for functions that are also invoked from Inngest, cron jobs,
   * or other server-side callers that authenticate with the service-role key.
   */
  allowServiceRole?: boolean;
}

export interface AuthResult {
  /** Authenticated end user, or null when authenticated via service-role key. */
  user: User | null;
  /** Supabase client scoped to the caller. */
  authClient: SupabaseClient;
  /** True when the caller authenticated with the service-role key. */
  isService: boolean;
}

/**
 * Validate the JWT on a request and return the authenticated principal.
 *
 * Use in functions that run with `verify_jwt = false` so the platform-level
 * check is skipped. Returns a 401 Response on missing or invalid tokens; the
 * caller forwards that response to the client.
 */
export async function authenticateRequest(
  req: Request,
  options: AuthOptions = {},
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError(401, 'Missing authorization header');
  }

  if (options.allowServiceRole) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      return { user: null, authClient: adminClient, isService: true };
    }
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    console.error('Auth verification failed: %s', error?.message ?? 'no user');
    return jsonError(401, 'Invalid or expired token');
  }

  return { user, authClient, isService: false };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
