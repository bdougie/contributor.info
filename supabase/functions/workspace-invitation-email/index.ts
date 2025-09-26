import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Email template types
interface WorkspaceInvitationData {
  recipientEmail: string;
  recipientName?: string;
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string;
  inviterEmail: string;
  role: 'admin' | 'editor' | 'viewer';
  invitationToken: string;
  expiresAt: string;
}

// Email templates
const getInvitationEmailHTML = (data: WorkspaceInvitationData) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Invitation - Contributor.info</title>
    <style>
        /* Design system colors and typography - Black & White */
        :root {
            --primary: #000000;        /* Black */
            --background: #F8F9FA;     /* Light slate background */
            --card: #FFFFFF;           /* White cards */
            --foreground: #11181C;     /* Dark slate text */
            --muted: #6B7280;          /* Muted gray text */
            --border: #E5E7EB;         /* Light gray border */
            --content-bg: #F9FAFB;     /* Very light gray content background */
            --success: #10B981;        /* Green for accept */
            --danger: #EF4444;         /* Red for decline */
        }
        
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: var(--foreground);
            margin: 0;
            padding: 0;
            background-color: var(--background);
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 32px 16px;
        }
        
        .card {
            background: var(--card);
            border-radius: 12px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid var(--border);
            overflow: hidden;
        }
        
        .header {
            background: var(--primary);
            color: white;
            padding: 40px 32px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.025em;
        }
        
        .content {
            padding: 32px;
        }
        
        .content p {
            margin: 0 0 16px 0;
            color: var(--foreground);
        }
        
        .content p:last-child {
            margin-bottom: 0;
        }
        
        .workspace-info {
            background: var(--content-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .workspace-info h2 {
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--primary);
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .info-label {
            color: var(--muted);
            font-size: 14px;
        }
        
        .info-value {
            color: var(--foreground);
            font-weight: 500;
            font-size: 14px;
        }
        
        .role-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            background: var(--primary);
            color: white;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .cta-container {
            margin: 32px 0;
            display: flex;
            gap: 16px;
            justify-content: center;
        }
        
        .cta-button {
            display: inline-block;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            font-size: 16px;
            transition: opacity 0.2s ease;
            text-align: center;
            min-width: 120px;
        }
        
        .cta-button:hover {
            opacity: 0.9;
        }
        
        .cta-button-accept {
            background: var(--success);
            color: white;
        }
        
        .cta-button-decline {
            background: var(--danger);
            color: white;
        }
        
        .expiry-notice {
            background: #FEF3C7;
            border: 1px solid #FCD34D;
            border-radius: 8px;
            padding: 12px 16px;
            margin: 24px 0;
            color: #92400E;
            font-size: 14px;
            text-align: center;
        }
        
        .expiry-notice strong {
            color: #78350F;
        }
        
        .footer {
            text-align: center;
            padding: 24px 32px;
            background: var(--content-bg);
            border-top: 1px solid var(--border);
        }
        
        .footer p {
            margin: 0;
            font-size: 14px;
            color: var(--muted);
        }
        
        .footer a {
            color: var(--primary);
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .divider {
            margin: 0 8px;
            color: var(--muted);
        }
        
        .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 24px;
        }
        
        .security-notice {
            margin-top: 24px;
            padding: 16px;
            background: var(--content-bg);
            border-radius: 8px;
            font-size: 13px;
            color: var(--muted);
            text-align: center;
        }
        
        /* Responsive design */
        @media (max-width: 600px) {
            .email-container {
                padding: 16px;
            }
            
            .header {
                padding: 32px 24px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px;
            }
            
            .cta-container {
                flex-direction: column;
                gap: 12px;
            }
            
            .cta-button {
                width: 100%;
            }
            
            .footer {
                padding: 20px 24px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="card">
            <div class="header">
                <h1>🤝 Workspace Invitation</h1>
            </div>
            
            <div class="content">
                <p class="greeting">Hi ${data.recipientName || data.recipientEmail.split('@')[0]},</p>
                
                <p><strong>${data.inviterName}</strong> has invited you to join the <strong>${data.workspaceName}</strong> workspace on contributor.info.</p>
                
                <div class="workspace-info">
                    <h2>Invitation Details</h2>
                    <div class="info-row">
                        <span class="info-label">Workspace:</span>
                        <span class="info-value">${data.workspaceName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Invited by:</span>
                        <span class="info-value">${data.inviterName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Your role:</span>
                        <span class="info-value">
                            <span class="role-badge">${data.role}</span>
                        </span>
                    </div>
                </div>
                
                <p>As a <strong>${data.role}</strong>, you'll be able to:</p>
                <ul style="margin: 16px 0; padding-left: 20px; color: var(--foreground);">
                    ${
                      data.role === 'admin'
                        ? `
                        <li>Manage workspace members and invitations</li>
                        <li>Add and remove repositories</li>
                        <li>Configure workspace settings</li>
                        <li>View all workspace analytics and insights</li>
                    `
                        : data.role === 'editor'
                          ? `
                        <li>Add and remove repositories</li>
                        <li>Update workspace repositories</li>
                        <li>View all workspace analytics and insights</li>
                    `
                          : `
                        <li>View workspace repositories</li>
                        <li>Access analytics and insights</li>
                        <li>Monitor contributor activity</li>
                    `
                    }
                </ul>
                
                <div class="expiry-notice">
                    ⏰ This invitation expires on <strong>${new Date(data.expiresAt).toLocaleString(
                      'en-US',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short',
                      }
                    )}</strong>
                </div>
                
                <div class="cta-container">
                    <a href="https://contributor.info/workspace/invitation/accept?token=${data.invitationToken}" class="cta-button cta-button-accept">
                        Accept Invitation
                    </a>
                    <a href="https://contributor.info/workspace/invitation/decline?token=${data.invitationToken}" class="cta-button cta-button-decline">
                        Decline
                    </a>
                </div>
                
                <div class="security-notice">
                    🔒 This invitation link is unique and secure. Do not share it with others.
                </div>
            </div>
            
            <div class="footer">
                <p>
                    <a href="https://contributor.info/settings">Email preferences</a>
                    <span class="divider">•</span>
                    <a href="https://contributor.info/privacy">Privacy policy</a>
                    <span class="divider">•</span>
                    <a href="https://github.com/bdougie/contributor.info">GitHub</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`;

const getInvitationEmailText = (data: WorkspaceInvitationData) => `
🤝 Workspace Invitation

Hi ${data.recipientName || data.recipientEmail.split('@')[0]},

${data.inviterName} has invited you to join the ${data.workspaceName} workspace on contributor.info.

INVITATION DETAILS
==================
Workspace: ${data.workspaceName}
Invited by: ${data.inviterName}
Your role: ${data.role.toUpperCase()}

As a ${data.role}, you'll be able to:
${
  data.role === 'admin'
    ? `
• Manage workspace members and invitations
• Add and remove repositories
• Configure workspace settings
• View all workspace analytics and insights
`
    : data.role === 'editor'
      ? `
• Add and remove repositories
• Update workspace repositories
• View all workspace analytics and insights
`
      : `
• View workspace repositories
• Access analytics and insights
• Monitor contributor activity
`
}

⏰ This invitation expires on ${new Date(data.expiresAt).toLocaleString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
})}

Accept invitation:
https://contributor.info/workspace/invitation/accept?token=${data.invitationToken}

Decline invitation:
https://contributor.info/workspace/invitation/decline?token=${data.invitationToken}

🔒 This invitation link is unique and secure. Do not share it with others.

--
Email preferences: https://contributor.info/settings
Privacy policy: https://contributor.info/privacy
GitHub: https://github.com/bdougie/contributor.info
`;

// CORS headers for development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Main function
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the request payload
    const payload = await req.json();

    // Validate required fields
    if (!payload.invitationId) {
      console.error('Invalid payload: missing invitationId');
      return new Response(JSON.stringify({ error: 'Invalid payload: invitationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invitation details with related workspace and inviter information
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_invitations')
      .select(
        `
        *,
        workspace:workspaces!workspace_id(
          id,
          name,
          slug,
          owner_id
        )
      `
      )
      .eq('id', payload.invitationId)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      console.error('Failed to fetch invitation:', invitationError);
      return new Response(JSON.stringify({ error: 'Invitation not found or already processed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch inviter details from auth.users
    const { data: inviter, error: inviterError } = await supabase
      .from('auth.users')
      .select('email, raw_user_meta_data')
      .eq('id', invitation.invited_by)
      .single();

    if (inviterError || !inviter) {
      console.error('Failed to fetch inviter details:', inviterError);
      return new Response(JSON.stringify({ error: 'Inviter information not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract inviter name
    const inviterName =
      inviter.raw_user_meta_data?.name ||
      inviter.raw_user_meta_data?.full_name ||
      inviter.raw_user_meta_data?.user_name ||
      inviter.email?.split('@')[0] ||
      'A team member';

    // Check if invitation is still valid (not expired)
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      console.error('Invitation has expired');
      return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing workspace invitation email for:', {
      recipientEmail: invitation.email,
      workspace: invitation.workspace.name,
      invitedBy: inviterName,
      role: invitation.role,
    });

    // GDPR COMPLIANCE: Log processing activity
    const { data: gdprLogId, error: gdprError } = await supabase.rpc('log_gdpr_processing', {
      p_user_id: invitation.invited_by,
      p_purpose: 'workspace_invitation_email',
      p_legal_basis: 'legitimate_interest',
      p_data_categories: ['email', 'name', 'workspace_membership'],
      p_notes: `Sending workspace invitation email to ${invitation.email} for workspace ${invitation.workspace.name}`,
    });

    if (gdprError) {
      console.warn('Failed to log GDPR processing:', gdprError);
    }

    // Prepare email data
    const emailData: WorkspaceInvitationData = {
      recipientEmail: invitation.email,
      recipientName: payload.recipientName, // Optional, may be provided if known
      workspaceName: invitation.workspace.name,
      workspaceSlug: invitation.workspace.slug,
      inviterName: inviterName,
      inviterEmail: inviter.email || '',
      role: invitation.role,
      invitationToken: invitation.invitation_token,
      expiresAt: invitation.expires_at,
    };

    console.log('Sending workspace invitation email to:', invitation.email);

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'contributor.info <no-reply@updates.contributor.info>',
        to: [invitation.email],
        subject: `You're invited to join ${invitation.workspace.name} on Contributor.info`,
        html: getInvitationEmailHTML(emailData),
        text: getInvitationEmailText(emailData),
        tags: [
          { name: 'type', value: 'workspace_invitation' },
          { name: 'workspace_id', value: invitation.workspace.id },
          { name: 'invitation_id', value: invitation.id },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        error: errorText,
      });
      throw new Error(`Resend API error: ${emailResponse.status} ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log('Workspace invitation email sent successfully:', emailResult);

    // GDPR COMPLIANCE: Log the email send for audit trail
    try {
      await supabase.from('email_logs').insert({
        user_id: invitation.invited_by,
        email_type: 'workspace_invitation',
        recipient_email: invitation.email,
        resend_email_id: emailResult.id,
        sent_at: new Date().toISOString(),
        legal_basis: 'legitimate_interest',
        gdpr_log_id: gdprLogId,
        metadata: {
          workspace_id: invitation.workspace.id,
          workspace_name: invitation.workspace.name,
          invitation_id: invitation.id,
          inviter_name: inviterName,
          role: invitation.role,
          expires_at: invitation.expires_at,
        },
      });

      // Update invitation record to track that email was sent
      await supabase
        .from('workspace_invitations')
        .update({
          metadata: {
            ...invitation.metadata,
            email_sent: true,
            email_sent_at: new Date().toISOString(),
            resend_email_id: emailResult.id,
          },
        })
        .eq('id', invitation.id);

      // Mark GDPR processing as completed
      if (gdprLogId) {
        await supabase
          .from('gdpr_processing_log')
          .update({
            processing_completed_at: new Date().toISOString(),
            notes: `Workspace invitation email sent successfully via Resend (ID: ${emailResult.id})`,
          })
          .eq('id', gdprLogId);
      }

      console.log('Email send logged successfully with GDPR compliance');
    } catch (logError) {
      // Don't fail the main function if logging fails, but warn about compliance
      console.warn('Failed to log email send - GDPR compliance may be affected:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Workspace invitation email sent successfully',
        email_id: emailResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending workspace invitation email:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to send workspace invitation email',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
