import { createSupabaseClient, ensureContributor } from '../_shared/database.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { processSyncRequest } from './sync-logic.ts';
import { FileSystem, Logger, SyncRequest } from './types.ts';

// Helper to implement FileSystem using Deno APIs
const denoFileSystem: FileSystem = {
  async writeTextFile(path: string, content: string, options?: { append?: boolean }) {
    await Deno.writeTextFile(path, content, { append: options?.append });
  },
  async readTextFile(path: string) {
    return await Deno.readTextFile(path);
  },
  async exists(path: string) {
    try {
      await Deno.stat(path);
      return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error;
    }
  },
  async remove(path: string) {
    await Deno.remove(path);
  },
  async ensureDir(path: string) {
      await Deno.mkdir(path, { recursive: true });
  }
};

const logger: Logger = {
    info: console.log,
    error: console.error,
    warn: console.warn
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    const githubToken = Deno.env.get('GITHUB_TOKEN');

    if (!githubToken) {
        return new Response(JSON.stringify({ error: 'GitHub token not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    const syncRequest = await req.json() as SyncRequest;

    const result = await processSyncRequest(syncRequest, {
        supabase: supabase as any,
        fileSystem: denoFileSystem,
        logger,
        githubToken,
        fetch: fetch.bind(globalThis),
        ensureContributor: ensureContributor as any,
        env: {
            get: (key) => Deno.env.get(key)
        }
    });

    return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
  } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }
});
