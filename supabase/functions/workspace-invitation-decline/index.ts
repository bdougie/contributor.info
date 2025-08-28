import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Main function for declining workspace invitations
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

    // Parse the request payload
    const { token, reason } = await req.json();
    
    if (!token) {
      console.error('Invalid payload: missing invitation token');
      return new Response(
        JSON.stringify({ error: 'Invitation token required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_invitations')
      .select(`
        *,
        workspace:workspaces!workspace_id(
          id,
          name,
          slug
        )
      `)
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      console.error('Failed to fetch invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Invalid or already processed invitation' }),
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

    console.log('Declining workspace invitation:', {
      invitationId: invitation.id,
      workspaceId: invitation.workspace_id,
      email: invitation.email
    });

    // Update invitation status to declined
    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ 
        status: 'declined',
        rejected_at: new Date().toISOString(),
        metadata: {
          ...invitation.metadata,
          decline_reason: reason || 'User declined invitation',
          declined_at: new Date().toISOString()
        }
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Failed to update invitation status:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to decline invitation' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log activity for audit trail (optional - since user may not be authenticated)
    await supabase
      .from('workspace_activity_log')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: null, // User might not be authenticated when declining
        action: 'invitation_declined',
        details: {
          invitation_id: invitation.id,
          email: invitation.email,
          invited_by: invitation.invited_by,
          role: invitation.role,
          declined_at: new Date().toISOString(),
          reason: reason || 'User declined invitation'
        }
      });

    // Optionally notify the inviter that the invitation was declined
    // This could be done through another email or in-app notification
    console.log('Workspace invitation declined successfully:', {
      invitationId: invitation.id,
      workspaceId: invitation.workspace_id
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Invitation declined successfully',
        workspace: {
          name: invitation.workspace.name
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error declining workspace invitation:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to decline workspace invitation' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});