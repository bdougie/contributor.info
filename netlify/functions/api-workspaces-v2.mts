import type { Context } from "@netlify/functions";
import { createClient } from '@supabase/supabase-js';
import type { 
  CreateWorkspaceRequest, 
  UpdateWorkspaceRequest,
  WorkspaceFilters 
} from '../../src/types/workspace';
import { 
  validateCreateWorkspace, 
  validateUpdateWorkspace,
  formatValidationErrors 
} from '../../src/lib/validations/workspace';
import { getApiConfig, validateConfig } from './lib/config';
import { handlePreflight, applyCorsHeaders } from './lib/cors';
import { 
  ErrorResponses, 
  createErrorResponse, 
  handleUnknownError,
  ValidationErrorDetail 
} from './lib/errors';
import { 
  RateLimiter, 
  getRateLimitKey, 
  applyRateLimitHeaders 
} from './lib/rate-limiter';
import { sanitizeSearchInput, sanitizePaginationParams } from './lib/sanitization';

// Initialize configuration
let config: ReturnType<typeof getApiConfig>;
let supabase: ReturnType<typeof createClient>;
let rateLimiter: RateLimiter;

try {
  config = getApiConfig();
  validateConfig(config);
  
  supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  
  if (config.rateLimit.enabled) {
    rateLimiter = new RateLimiter(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        maxRequests: config.rateLimit.maxRequests,
        windowMs: config.rateLimit.windowMs,
        keyPrefix: 'workspace_api'
      }
    );
  }
} catch (error) {
  console.error('Configuration error:', error);
  throw error;
}

// Helper to get user from Authorization header
async function getAuthUser(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Helper to convert validation errors to API format
function convertValidationErrors(errors: any[]): ValidationErrorDetail[] {
  return errors.map(error => ({
    field: error.field,
    message: error.message
  }));
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  try {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return handlePreflight(req, config);
    }

    // Check rate limiting
    const authHeader = req.headers.get('Authorization');
    const tempUser = await getAuthUser(authHeader);
    const rateLimitKey = getRateLimitKey(req, tempUser?.id);
    
    if (config.rateLimit.enabled && rateLimiter) {
      const rateLimitResult = await rateLimiter.checkLimit(rateLimitKey);
      
      if (!rateLimitResult.allowed) {
        const errorResponse = createErrorResponse(
          ErrorResponses.rateLimitExceeded(rateLimitResult.retryAfter || 60),
          path
        );
        return applyRateLimitHeaders(
          applyCorsHeaders(errorResponse, req, config),
          rateLimitResult
        );
      }
      
      // Add rate limit headers to all responses
      context.rateLimitResult = rateLimitResult;
    }
    
    // Authenticate user
    const user = tempUser;
    if (!user) {
      const errorResponse = createErrorResponse(
        ErrorResponses.unauthorized(),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
    }

    // Parse workspace ID from path
    const pathParts = url.pathname.split('/').filter(Boolean);
    const workspaceId = pathParts[pathParts.length - 1] !== 'api-workspaces-v2' 
      ? pathParts[pathParts.length - 1] 
      : null;

    // Route to appropriate handler
    switch (req.method) {
      case 'GET': {
        if (workspaceId) {
          return await handleGetWorkspace(req, workspaceId, user, path);
        } else {
          return await handleListWorkspaces(req, user, path);
        }
      }

      case 'POST': {
        return await handleCreateWorkspace(req, user, path);
      }

      case 'PUT': {
        if (!workspaceId) {
          const errorResponse = createErrorResponse(
            ErrorResponses.invalidRequest('Workspace ID required'),
            path
          );
          return applyCorsHeaders(errorResponse, req, config);
        }
        return await handleUpdateWorkspace(req, workspaceId, user, path);
      }

      case 'DELETE': {
        if (!workspaceId) {
          const errorResponse = createErrorResponse(
            ErrorResponses.invalidRequest('Workspace ID required'),
            path
          );
          return applyCorsHeaders(errorResponse, req, config);
        }
        return await handleDeleteWorkspace(req, workspaceId, user, path);
      }

      default: {
        const errorResponse = createErrorResponse(
          ErrorResponses.methodNotAllowed(req.method, ['GET', 'POST', 'PUT', 'DELETE']),
          path
        );
        return applyCorsHeaders(errorResponse, req, config);
      }
    }
  } catch (error) {
    const errorResponse = handleUnknownError(error, path);
    return applyCorsHeaders(errorResponse, req, config);
  }
};

async function handleGetWorkspace(req: Request, workspaceId: string, user: any, path: string) {
  try {
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
        const errorResponse = createErrorResponse(
          ErrorResponses.notFound('Workspace'),
          path
        );
        return applyCorsHeaders(errorResponse, req, config);
      }
      throw error;
    }

    const response = new Response(JSON.stringify({ 
      data: workspace,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return addRateLimitIfNeeded(applyCorsHeaders(response, req, config), req);
  } catch (error) {
    throw error;
  }
}

async function handleListWorkspaces(req: Request, user: any, path: string) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const requestedLimit = parseInt(url.searchParams.get('limit') || String(config.pagination.defaultLimit));
    const limit = Math.min(requestedLimit, config.pagination.maxLimit);
    const visibility = url.searchParams.get('visibility') as 'public' | 'private' | null;
    const search = url.searchParams.get('search');
    
    const offset = (page - 1) * limit;
    
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
      const sanitizedSearch = sanitizeSearchInput(search);
      query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
    }

    const { data: workspaces, error, count } = await query;

    if (error) throw error;

    const response = new Response(JSON.stringify({ 
      data: workspaces,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrevious: page > 1
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return addRateLimitIfNeeded(applyCorsHeaders(response, req, config), req);
  } catch (error) {
    throw error;
  }
}

async function handleCreateWorkspace(req: Request, user: any, path: string) {
  try {
    const body = await req.json() as CreateWorkspaceRequest;
    
    // Validate input
    const validation = validateCreateWorkspace(body);
    if (!validation.valid) {
      const errorResponse = createErrorResponse(
        ErrorResponses.validationFailed(convertValidationErrors(validation.errors)),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
    }

    // Start transaction-like operation
    const { data: slugData, error: slugError } = await supabase
      .rpc('generate_workspace_slug', { workspace_name: body.name });
    
    if (slugError) {
      const errorResponse = createErrorResponse(
        ErrorResponses.internalError('Failed to generate workspace slug'),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
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
      if (createError.code === '23505') {
        const errorResponse = createErrorResponse(
          ErrorResponses.alreadyExists('Workspace with this name'),
          path
        );
        return applyCorsHeaders(errorResponse, req, config);
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
      // Attempt to rollback workspace creation
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      throw memberError;
    }

    const response = new Response(JSON.stringify({ 
      data: workspace,
      timestamp: new Date().toISOString()
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

    return addRateLimitIfNeeded(applyCorsHeaders(response, req, config), req);
  } catch (error) {
    throw error;
  }
}

async function handleUpdateWorkspace(req: Request, workspaceId: string, user: any, path: string) {
  try {
    const body = await req.json() as UpdateWorkspaceRequest;
    
    // Validate input
    const validation = validateUpdateWorkspace(body);
    if (!validation.valid) {
      const errorResponse = createErrorResponse(
        ErrorResponses.validationFailed(convertValidationErrors(validation.errors)),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
    }

    // Check permissions
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
      const errorResponse = createErrorResponse(
        ErrorResponses.insufficientPermissions('update workspace'),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
    }

    // Build update object
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.settings !== undefined) updateData.settings = body.settings;
    updateData.updated_at = new Date().toISOString();

    const { data: workspace, error: updateError } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspaceId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        const errorResponse = createErrorResponse(
          ErrorResponses.notFound('Workspace'),
          path
        );
        return applyCorsHeaders(errorResponse, req, config);
      }
      throw updateError;
    }

    const response = new Response(JSON.stringify({ 
      data: workspace,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return addRateLimitIfNeeded(applyCorsHeaders(response, req, config), req);
  } catch (error) {
    throw error;
  }
}

async function handleDeleteWorkspace(req: Request, workspaceId: string, user: any, path: string) {
  try {
    // Check if user is the owner
    const { data: workspace, error: checkError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (checkError || !workspace) {
      const errorResponse = createErrorResponse(
        ErrorResponses.notFound('Workspace'),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
    }

    if (workspace.owner_id !== user.id) {
      const errorResponse = createErrorResponse(
        ErrorResponses.insufficientPermissions('delete workspace'),
        path
      );
      return applyCorsHeaders(errorResponse, req, config);
    }

    // Delete workspace (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    if (deleteError) {
      throw deleteError;
    }

    const response = new Response(JSON.stringify({ 
      success: true,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    return addRateLimitIfNeeded(applyCorsHeaders(response, req, config), req);
  } catch (error) {
    throw error;
  }
}

// Helper to add rate limit headers if available
function addRateLimitIfNeeded(response: Response, req: any): Response {
  if (req.context?.rateLimitResult) {
    return applyRateLimitHeaders(response, req.context.rateLimitResult);
  }
  return response;
}