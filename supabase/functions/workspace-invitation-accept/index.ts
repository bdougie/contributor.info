import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Main function for accepting workspace invitations
Deno.serve(async (req: Request) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user context from auth header
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get the authenticated user
    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.id;

    // Parse the request payload for the token
    const { token } = await req.json();
    
    if (!token) {
      console.error('Invalid payload: missing invitation token');
      return new Response(
        JSON.stringify({ error: 'Invitation token required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_invitations')
      .select(`
        *,
        workspace:workspaces!workspace_id(
          id,
          name,
          slug,
          owner_id,
          member_count
        )
      `)
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      console.error('Failed to fetch invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation has expired
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      // Update invitation status to expired
      await supabase
        .from('workspace_invitations')
        .update({ 
          status: 'expired',
          metadata: {
<<<<<<< HEAD
            ...(invitation.metadata ?? {}),
            expired_at: new Date().toISOString()
          }
        })
        .eq('id', invitation.id);

      console.error('Invitation has expired');
      return new Response(
        JSON.stringify({ error: 'This invitation has expired' }),
        { status: 410, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify that the user email matches the invitation email
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Failed to fetch user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (user.email !== invitation.email) {
      console.error('Email mismatch:', {
        userEmail: user.email,
        invitationEmail: invitation.email
      });
      return new Response(
        JSON.stringify({ error: 'This invitation was sent to a different email address' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a member of the workspace
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      // User is already a member, just update the invitation status
      await supabase
        .from('workspace_invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          metadata: {
            ...invitation.metadata,
            already_member: true
          }
        })
        .eq('id', invitation.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'You are already a member of this workspace',
          workspace: {
            id: invitation.workspace.id,
            name: invitation.workspace.name,
            slug: invitation.workspace.slug
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Start a transaction to accept invitation and add member
    console.log('Accepting invitation and adding member to workspace:', {
      workspaceId: invitation.workspace_id,
      userId: userId,
      role: invitation.role
    });

    // Add user as a workspace member
    const { data: newMember, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        role: invitation.role,
        invited_by: invitation.invited_by,
        invited_at: invitation.invited_at,
        accepted_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (memberError) {
      console.error('Failed to add workspace member:', memberError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to add you to the workspace',
          details: memberError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update invitation status to accepted
    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        metadata: {
          ...invitation.metadata,
          member_id: newMember.id,
          accepted_by_user_id: userId
        }
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.warn('Failed to update invitation status:', updateError);
      // Don't fail the request as member was added successfully
    }

    // Update workspace member count atomically using SQL
    const { error: countError } = await supabase.rpc('increment_workspace_member_count', {
      workspace_id_param: invitation.workspace_id
    });
    
    if (countError) {
      console.warn('Failed to update member count:', countError);
      // Don't fail the request as member was added successfully
    }

    // Log activity for audit trail
    await supabase
      .from('workspace_activity_log')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        action: 'member_joined',
        details: {
          invitation_id: invitation.id,
          invited_by: invitation.invited_by,
          role: invitation.role,
          accepted_at: new Date().toISOString()
        }
      });

    console.log('Workspace invitation accepted successfully:', {
      workspaceId: invitation.workspace_id,
      userId: userId,
      memberId: newMember.id
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Successfully joined the workspace',
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          slug: invitation.workspace.slug
        },
        member: {
          id: newMember.id,
          role: newMember.role
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error accepting workspace invitation:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to accept workspace invitation',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});