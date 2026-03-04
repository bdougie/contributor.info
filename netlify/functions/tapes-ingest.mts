import type { Context } from '@netlify/functions';
import { getSupabaseClient } from './_shared/supabase-client';

interface TapesSessionNode {
  project: string;
  role: string;
  content: string;
  model?: string;
  session_hash?: string;
  token_count?: number;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tapes-App, Authorization',
};

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Validate app header
  const tapesApp = req.headers.get('X-Tapes-App');
  if (tapesApp && tapesApp !== 'contributor-info') {
    return new Response(JSON.stringify({ error: 'Invalid app identifier' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Validate authorization — require a shared secret to prevent unauthorized writes
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.TAPES_INGEST_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const nodes: TapesSessionNode[] = Array.isArray(body) ? body : [body];

    if (nodes.length === 0) {
      return new Response(JSON.stringify({ error: 'No session data provided' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Validate each node
    const validNodes = nodes.filter((node) => {
      if (!node.project || !node.role || !node.content) return false;
      if (!['user', 'assistant'].includes(node.role)) return false;
      // Validate project format: owner/repo
      if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(node.project)) return false;
      return true;
    });

    if (validNodes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid session nodes — each needs project, role, and content' }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = getSupabaseClient();

    const rows = validNodes.map((node) => ({
      project: node.project,
      app: 'contributor-info',
      session_hash: node.session_hash ?? null,
      role: node.role,
      content: node.content,
      model: node.model ?? null,
      token_count: node.token_count ?? 0,
    }));

    const { error } = await supabase.from('tapes_sessions').insert(rows);

    if (error) {
      console.error('[tapes-ingest] insert error: %s', error.message);
      return new Response(JSON.stringify({ error: 'Failed to store session data' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ inserted: rows.length }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[tapes-ingest] unexpected error: %s', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};
