import type { Context } from "@netlify/functions";
import { createClient } from '@supabase/supabase-js';
import type { AddRepositoryRequest } from '../../src/types/workspace';

// Initialize Supabase client - Use server-only env vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers - Fixed: Cannot use wildcard with credentials
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://contributor.info',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin'
};

// Helper to get user from Authorization header
async function getAuthUser(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// Helper to check workspace permissions
async function checkWorkspacePermission(workspaceId: string, userId: string, requiredRoles: string[]) {
  const { data: member, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (error || !member) {
    return false;
  }

  return requiredRoles.includes(member.role);
}

export default async (req: Request, _context: Context) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Extract workspace ID and repository ID from path
  // Expected path: /api/workspaces/:workspaceId/repositories/:repositoryId
  const workspaceIdIndex = pathParts.indexOf('workspaces') + 1;
  const workspaceId = pathParts[workspaceIdIndex];
  const repositoryIdIndex = pathParts.indexOf('repositories') + 1;
  const repositoryId = repositoryIdIndex < pathParts.length ? pathParts[repositoryIdIndex] : null;

  if (!workspaceId) {
    return new Response(JSON.stringify({ error: 'Workspace ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = req.headers.get('Authorization');
  const user = await getAuthUser(authHeader);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // GET /api/workspaces/:id/repositories - List workspace repositories
        // Check if user has access to workspace
        const hasAccess = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin', 'editor', 'viewer']);
        
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const isPinned = url.searchParams.get('pinned') === 'true';
        const search = url.searchParams.get('search');
        
        const offset = (page - 1) * limit;

        let query = supabase
          .from('workspace_repositories')
          .select(`
            *,
            repositories (
              id,
              owner,
              name,
              description,
              stars,
              language,
              last_synced_at
            ),
            added_by_user:users!workspace_repositories_added_by_fkey (
              id,
              email,
              display_name,
              avatar_url
            )
          `, { count: 'exact' })
          .eq('workspace_id', workspaceId)
          .order('added_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (isPinned !== null) {
          query = query.eq('is_pinned', isPinned);
        }

        if (search) {
          query = query.or(`notes.ilike.%${search}%`);
        }

        const { data: repositories, error, count } = await query;

        if (error) throw error;

        return new Response(JSON.stringify({ 
          repositories,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'POST': {
        // POST /api/workspaces/:id/repositories - Add repository to workspace
        const hasPermission = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin', 'editor']);
        
        if (!hasPermission) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await req.json() as AddRepositoryRequest;

        if (!body.repository_id) {
          return new Response(JSON.stringify({ error: 'Repository ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if repository exists
        const { data: repository, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('id', body.repository_id)
          .single();

        if (repoError || !repository) {
          return new Response(JSON.stringify({ error: 'Repository not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check workspace repository limit
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .select('max_repositories, current_repository_count')
          .eq('id', workspaceId)
          .single();

        if (workspaceError || !workspace) {
          return new Response(JSON.stringify({ error: 'Workspace not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (workspace.current_repository_count >= workspace.max_repositories) {
          return new Response(JSON.stringify({ 
            error: 'Repository limit reached',
            message: `This workspace has reached its limit of ${workspace.max_repositories} repositories`
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if repository is already in workspace
        const { data: existing, error: existingError } = await supabase
          .from('workspace_repositories')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('repository_id', body.repository_id)
          .single();

        if (existing) {
          return new Response(JSON.stringify({ error: 'Repository already in workspace' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Add repository to workspace
        const { data: workspaceRepo, error: addError } = await supabase
          .from('workspace_repositories')
          .insert({
            workspace_id: workspaceId,
            repository_id: body.repository_id,
            added_by: user.id,
            notes: body.notes || null,
            tags: body.tags || [],
            is_pinned: body.is_pinned || false
          })
          .select(`
            *,
            repositories (
              id,
              owner,
              name,
              description,
              stars,
              language
            )
          `)
          .single();

        if (addError) {
          throw addError;
        }

        // Update workspace repository count
        await supabase
          .from('workspaces')
          .update({ 
            current_repository_count: workspace.current_repository_count + 1,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', workspaceId);

        return new Response(JSON.stringify({ repository: workspaceRepo }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'DELETE': {
        // DELETE /api/workspaces/:id/repositories/:repoId - Remove repository from workspace
        if (!repositoryId) {
          return new Response(JSON.stringify({ error: 'Repository ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const hasPermission = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin', 'editor']);
        
        if (!hasPermission) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if repository is in workspace
        const { data: workspaceRepo, error: checkError } = await supabase
          .from('workspace_repositories')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('repository_id', repositoryId)
          .single();

        if (checkError || !workspaceRepo) {
          return new Response(JSON.stringify({ error: 'Repository not found in workspace' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Remove repository from workspace
        const { error: deleteError } = await supabase
          .from('workspace_repositories')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('repository_id', repositoryId);

        if (deleteError) {
          throw deleteError;
        }

        // Update workspace repository count
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('current_repository_count')
          .eq('id', workspaceId)
          .single();

        if (workspace) {
          await supabase
            .from('workspaces')
            .update({ 
              current_repository_count: Math.max(0, workspace.current_repository_count - 1),
              last_activity_at: new Date().toISOString()
            })
            .eq('id', workspaceId);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default: {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  } catch (error) {
    // Log full error for debugging but don't expose to client
    console.error('Workspace repositories API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};