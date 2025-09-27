import type { Context } from "@netlify/functions";
import { createClient } from '@supabase/supabase-js';
import type { 
  CreateWorkspaceRequest, 
  UpdateWorkspaceRequest
} from '../../src/types/workspace';
import { sanitizeSearchInput, sanitizePaginationParams } from './lib/sanitization';

// Initialize Supabase client - Use server-only env vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers - Fixed: Cannot use wildcard with credentials
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://contributor.info',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

// Helper to validate workspace data
function validateWorkspaceData(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!data.name || typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 100) {
    errors.push('Name must be between 1 and 100 characters');
  }
  
  if (data.description && (typeof data.description !== 'string' || data.description.length > 500)) {
    errors.push('Description must be a string with max 500 characters');
  }
  
  if (data.visibility && !['public', 'private'].includes(data.visibility)) {
    errors.push('Visibility must be either "public" or "private"');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
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
  const workspaceId = pathParts[pathParts.length - 1] !== 'api-workspaces' ? pathParts[pathParts.length - 1] : null;
  
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
        if (workspaceId) {
          // GET /api/workspaces/:id - Get specific workspace
          const { data: workspace, error } = await supabase
            .from('workspaces')
            .select(`
              *,
              workspace_members!inner(
                user_id,
                role
              ),
              workspace_repositories(
                count
              )
            `)
            .eq('id', workspaceId)
            .eq('workspace_members.user_id', user.id)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              return new Response(JSON.stringify({ error: 'Workspace not found or access denied' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            throw error;
          }

          return new Response(JSON.stringify({ workspace }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // GET /api/workspaces - List user's workspaces
          const { page, limit, offset } = sanitizePaginationParams(
            url.searchParams.get('page'),
            url.searchParams.get('limit')
          );
          const visibility = url.searchParams.get('visibility') as 'public' | 'private' | null;
          const search = url.searchParams.get('search');
          
          let query = supabase
            .from('workspaces')
            .select(`
              *,
              workspace_members!inner(
                user_id,
                role
              ),
              _repository_count:workspace_repositories(count)
            `, { count: 'exact' })
            .eq('workspace_members.user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (visibility) {
            query = query.eq('visibility', visibility);
          }

          if (search) {
            // Sanitize search input to prevent query manipulation
            const sanitizedSearch = sanitizeSearchInput(search);
            query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
          }

          const { data: workspaces, error, count } = await query;

          if (error) throw error;

          return new Response(JSON.stringify({ 
            workspaces,
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
      }

      case 'POST': {
        // POST /api/workspaces - Create new workspace
        
        // Check if workspace creation is enabled via environment variable
        const isWorkspaceCreationEnabled = process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION === 'true' || 
                                           process.env.FEATURE_FLAG_ENABLE_WORKSPACE_CREATION === '1';
        
        if (!isWorkspaceCreationEnabled) {
          return new Response(JSON.stringify({
            error: 'Workspace creation is currently disabled',
            code: 'FEATURE_DISABLED',
            message: 'This feature is temporarily unavailable. Please try again later.'
          }), {
            status: 503, // Service Unavailable
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': '3600' // Suggest retry in 1 hour
            }
          });
        }

        const body = await req.json() as CreateWorkspaceRequest;
        
        const validation = validateWorkspaceData(body);
        if (!validation.valid) {
          return new Response(JSON.stringify({ 
            error: 'Validation failed',
            errors: validation.errors 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Generate slug from name
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_workspace_slug', { workspace_name: body.name });
        
        if (slugError) {
          return new Response(JSON.stringify({ error: 'Failed to generate workspace slug' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create workspace
        const { data: workspace, error: createError } = await supabase
          .from('workspaces')
          .insert({
            name: body.name,
            slug: slugData,
            description: body.description || null,
            owner_id: user.id,
            visibility: body.visibility || 'public',
            settings: body.settings || {}
          })
          .select()
          .single();

        if (createError) {
          if (createError.code === '23505') { // Unique constraint violation
            return new Response(JSON.stringify({ error: 'A workspace with this name already exists' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          throw createError;
        }

        // Add creator as owner member
        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'owner'
          });

        if (memberError) {
          // Rollback workspace creation if member creation fails
          await supabase.from('workspaces').delete().eq('id', workspace.id);
          throw memberError;
        }

        return new Response(JSON.stringify({ workspace }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'PUT': {
        // PUT /api/workspaces/:id - Update workspace
        if (!workspaceId) {
          return new Response(JSON.stringify({ error: 'Workspace ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await req.json() as UpdateWorkspaceRequest;
        
        // Check if user has permission to update (owner or admin)
        const { data: member, error: memberError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .single();

        if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Validate update data
        const updateData: any = {};
        if (body.name !== undefined) {
          if (!body.name || body.name.length > 100) {
            return new Response(JSON.stringify({ error: 'Invalid name' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updateData.name = body.name;
        }
        
        if (body.description !== undefined) {
          updateData.description = body.description;
        }
        
        if (body.visibility !== undefined) {
          if (!['public', 'private'].includes(body.visibility)) {
            return new Response(JSON.stringify({ error: 'Invalid visibility' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updateData.visibility = body.visibility;
        }
        
        if (body.settings !== undefined) {
          updateData.settings = body.settings;
        }

        updateData.updated_at = new Date().toISOString();

        const { data: workspace, error: updateError } = await supabase
          .from('workspaces')
          .update(updateData)
          .eq('id', workspaceId)
          .select()
          .single();

        if (updateError) {
          if (updateError.code === 'PGRST116') {
            return new Response(JSON.stringify({ error: 'Workspace not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          throw updateError;
        }

        return new Response(JSON.stringify({ workspace }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'DELETE': {
        // DELETE /api/workspaces/:id - Delete workspace
        if (!workspaceId) {
          return new Response(JSON.stringify({ error: 'Workspace ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if user is the owner
        const { data: workspace, error: checkError } = await supabase
          .from('workspaces')
          .select('owner_id')
          .eq('id', workspaceId)
          .single();

        if (checkError || !workspace) {
          return new Response(JSON.stringify({ error: 'Workspace not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (workspace.owner_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Only workspace owner can delete workspace' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete workspace (cascade will handle related records)
        const { error: deleteError } = await supabase
          .from('workspaces')
          .delete()
          .eq('id', workspaceId);

        if (deleteError) {
          throw deleteError;
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
    console.error('Workspace API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};