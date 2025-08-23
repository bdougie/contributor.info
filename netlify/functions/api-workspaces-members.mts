import type { Context } from "@netlify/functions";
import { createClient } from '@supabase/supabase-js';
import type { InviteMemberRequest, WorkspaceRole } from '../../src/types/workspace';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
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
    return { hasPermission: false, currentRole: null };
  }

  return { 
    hasPermission: requiredRoles.includes(member.role),
    currentRole: member.role as WorkspaceRole
  };
}

// Helper to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default async (req: Request, context: Context) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Extract workspace ID and member ID from path
  // Expected path: /api/workspaces/:workspaceId/members/:memberId
  const workspaceIdIndex = pathParts.indexOf('workspaces') + 1;
  const workspaceId = pathParts[workspaceIdIndex];
  const memberIdIndex = pathParts.indexOf('members') + 1;
  const memberId = memberIdIndex < pathParts.length ? pathParts[memberIdIndex] : null;

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
        // GET /api/workspaces/:id/members - List workspace members
        const { hasPermission } = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin', 'editor', 'viewer']);
        
        if (!hasPermission) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const role = url.searchParams.get('role') as WorkspaceRole | null;
        
        const offset = (page - 1) * limit;

        let query = supabase
          .from('workspace_members')
          .select(`
            *,
            user:users!workspace_members_user_id_fkey (
              id,
              email,
              display_name,
              avatar_url
            )
          `, { count: 'exact' })
          .eq('workspace_id', workspaceId)
          .order('joined_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (role) {
          query = query.eq('role', role);
        }

        const { data: members, error, count } = await query;

        if (error) throw error;

        // Also get pending invitations
        const { data: invitations } = await supabase
          .from('workspace_invitations')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending');

        return new Response(JSON.stringify({ 
          members,
          invitations: invitations || [],
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
        // POST /api/workspaces/:id/members - Invite member to workspace
        const { hasPermission } = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin']);
        
        if (!hasPermission) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await req.json() as InviteMemberRequest;

        if (!body.email || !isValidEmail(body.email)) {
          return new Response(JSON.stringify({ error: 'Valid email required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!body.role || !['admin', 'editor', 'viewer'].includes(body.role)) {
          return new Response(JSON.stringify({ error: 'Valid role required (admin, editor, or viewer)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if user is already a member
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', body.email)
          .single();

        if (existingUser) {
          const { data: existingMember } = await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', existingUser.id)
            .single();

          if (existingMember) {
            return new Response(JSON.stringify({ error: 'User is already a member of this workspace' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Check for existing pending invitation
        const { data: existingInvite } = await supabase
          .from('workspace_invitations')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('email', body.email)
          .eq('status', 'pending')
          .single();

        if (existingInvite) {
          return new Response(JSON.stringify({ error: 'Invitation already sent to this email' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create invitation
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

        const { data: invitation, error: inviteError } = await supabase
          .from('workspace_invitations')
          .insert({
            workspace_id: workspaceId,
            email: body.email,
            role: body.role,
            invited_by: user.id,
            expires_at: expiresAt.toISOString(),
            custom_message: body.message || null
          })
          .select()
          .single();

        if (inviteError) {
          throw inviteError;
        }

        // TODO: Send invitation email
        // This would typically be handled by a separate email service

        return new Response(JSON.stringify({ invitation }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'PUT': {
        // PUT /api/workspaces/:id/members/:memberId - Update member role
        if (!memberId) {
          return new Response(JSON.stringify({ error: 'Member ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { hasPermission, currentRole } = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin']);
        
        if (!hasPermission) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await req.json() as { role: WorkspaceRole };

        if (!body.role || !['admin', 'editor', 'viewer'].includes(body.role)) {
          return new Response(JSON.stringify({ error: 'Valid role required (admin, editor, or viewer)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if target member exists and get their current role
        const { data: targetMember, error: targetError } = await supabase
          .from('workspace_members')
          .select('role, user_id')
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)
          .single();

        if (targetError || !targetMember) {
          return new Response(JSON.stringify({ error: 'Member not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Prevent changing owner role
        if (targetMember.role === 'owner') {
          return new Response(JSON.stringify({ error: 'Cannot change owner role' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Only owner can promote to admin
        if (body.role === 'admin' && currentRole !== 'owner') {
          return new Response(JSON.stringify({ error: 'Only workspace owner can promote members to admin' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update member role
        const { data: updatedMember, error: updateError } = await supabase
          .from('workspace_members')
          .update({ 
            role: body.role,
            updated_at: new Date().toISOString()
          })
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)
          .select(`
            *,
            user:users!workspace_members_user_id_fkey (
              id,
              email,
              display_name,
              avatar_url
            )
          `)
          .single();

        if (updateError) {
          throw updateError;
        }

        return new Response(JSON.stringify({ member: updatedMember }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'DELETE': {
        // DELETE /api/workspaces/:id/members/:memberId - Remove member from workspace
        if (!memberId) {
          return new Response(JSON.stringify({ error: 'Member ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { hasPermission } = await checkWorkspacePermission(workspaceId, user.id, ['owner', 'admin']);
        
        // Users can remove themselves from workspace
        const isSelfRemoval = memberId === user.id;
        
        if (!hasPermission && !isSelfRemoval) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if target member exists and get their role
        const { data: targetMember, error: targetError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId)
          .single();

        if (targetError || !targetMember) {
          return new Response(JSON.stringify({ error: 'Member not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Prevent removing workspace owner
        if (targetMember.role === 'owner') {
          return new Response(JSON.stringify({ error: 'Cannot remove workspace owner' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Remove member from workspace
        const { error: deleteError } = await supabase
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', memberId);

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
    console.error('Workspace members API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};