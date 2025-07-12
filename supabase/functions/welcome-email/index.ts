import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Email template types
interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  signupDate: string;
}

// Email templates
const getWelcomeEmailHTML = (data: WelcomeEmailData) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Contributor.info</title>
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
        
        .feature-list {
            margin: 24px 0;
            padding: 0;
            list-style: none;
        }
        
        .feature-list li {
            margin: 12px 0;
            padding: 0;
            display: flex;
            align-items: center;
            color: var(--foreground);
        }
        
        .feature-list li:before {
            content: "✓";
            color: var(--primary);
            font-weight: 600;
            margin-right: 12px;
            font-size: 16px;
        }
        
        .cta-container {
            text-align: center;
            margin: 32px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            font-size: 16px;
            transition: background-color 0.2s ease;
        }
        
        .cta-button:hover {
            background: #374151;
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
        
        .signature {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            color: var(--muted);
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
                <h1>Welcome 🌱contributor.info</h1>
            </div>
            
            <div class="content">
                <p class="greeting">Hi ${data.userName},</p>
                
                <p>Your account has been successfully created and you're all set to explore the world of open source contributions!</p>
                
                <p>With <a href="https://contributor.info" style="color: var(--primary); text-decoration: none;">contributor.info</a>, you can now:</p>
                
                <ul class="feature-list">
                    <li>Search and analyze GitHub repositories</li>
                    <li>View detailed contributor analytics and insights</li>
                    <li>Track repository health metrics and trends</li>
                    <li>Discover contribution patterns and opportunities</li>
                </ul>
                
                <div class="cta-container">
                    <a href="https://contributor.info" class="cta-button">Start Exploring</a>
                </div>
                
                <div class="signature">
                    <p>Best regards,<br>
                    <strong>bdougie</strong></p>
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

const getWelcomeEmailText = (data: WelcomeEmailData) => `
Welcome 🌱contributor.info

Hi ${data.userName},

Your account has been successfully created and you're all set to explore the world of open source contributions!

With contributor.info, you can now:

• Search and analyze GitHub repositories
• View detailed contributor analytics and insights
• Track repository health metrics and trends
• Discover contribution patterns and opportunities

Start exploring: https://contributor.info

Best regards,
bdougie

--
Email preferences: https://contributor.info/settings
Privacy policy: https://contributor.info/privacy
GitHub: https://github.com/bdougie/contributor.info
`;

// Audience management functions
const ensureAudienceExists = async (resendApiKey: string) => {
  // List existing audiences
  const audiencesResponse = await fetch('https://api.resend.com/audiences', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!audiencesResponse.ok) {
    console.error('Failed to list audiences:', audiencesResponse.status, await audiencesResponse.text());
    throw new Error(`Failed to list audiences: ${audiencesResponse.status}`);
  }

  const audiences = await audiencesResponse.json();
  console.log('Existing audiences:', audiences.data?.length || 0);

  // Check if "Welcomed Users" audience exists
  const existingAudience = audiences.data?.find(
    (audience: any) => audience.name === 'Welcomed Users'
  );

  if (existingAudience) {
    console.log('Found existing "Welcomed Users" audience:', existingAudience.id);
    return existingAudience.id;
  }

  // Create "Welcomed Users" audience if it doesn't exist
  console.log('Creating "Welcomed Users" audience...');
  const createResponse = await fetch('https://api.resend.com/audiences', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Welcomed Users'
    }),
  });

  if (!createResponse.ok) {
    console.error('Failed to create audience:', createResponse.status, await createResponse.text());
    throw new Error(`Failed to create audience: ${createResponse.status}`);
  }

  const newAudience = await createResponse.json();
  console.log('Created new "Welcomed Users" audience:', newAudience.id);
  return newAudience.id;
};

const addUserToAudience = async (resendApiKey: string, audienceId: string, userEmail: string, userName: string) => {
  console.log(`Adding user ${userEmail} to audience ${audienceId}...`);
  
  const contactResponse = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: userEmail,
      first_name: userName.split(' ')[0] || userName,
      last_name: userName.split(' ').slice(1).join(' ') || '',
      unsubscribed: false
    }),
  });

  if (!contactResponse.ok) {
    const errorText = await contactResponse.text();
    console.error('Failed to add user to audience:', contactResponse.status, errorText);
    
    // Don't throw if user already exists (409 conflict)
    if (contactResponse.status === 409) {
      console.log('User already exists in audience');
      return null;
    }
    
    throw new Error(`Failed to add user to audience: ${contactResponse.status} ${errorText}`);
  }

  const contact = await contactResponse.json();
  console.log('Successfully added user to audience:', contact.id);
  return contact.id;
};

// Main function
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse the webhook payload
    const { record } = await req.json();
    
    if (!record || !record.email) {
      console.error('Invalid webhook payload:', { record });
      return new Response(
        JSON.stringify({ error: 'Invalid payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract user information
    const userEmail = record.email;
    const userName = record.raw_user_meta_data?.name || 
                    record.raw_user_meta_data?.full_name || 
                    record.raw_user_meta_data?.user_name ||
                    userEmail.split('@')[0];
    const signupDate = new Date(record.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log('Processing welcome email request for:', { userEmail, userName, signupDate });

    // GDPR COMPLIANCE: Welcome emails are transactional and sent under contractual necessity
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Log GDPR processing activity under contractual necessity
    const { data: gdprLogId, error: gdprError } = await supabase
      .rpc('log_gdpr_processing', {
        p_user_id: record.id,
        p_purpose: 'welcome_email_transactional',
        p_legal_basis: 'contract',
        p_data_categories: ['email', 'name'],
        p_notes: `Sending transactional welcome email to ${userEmail} - necessary for service setup`
      });

    if (gdprError) {
      console.warn('Failed to log GDPR processing:', gdprError);
    }

    // Prepare email data
    const emailData: WelcomeEmailData = {
      userName,
      userEmail,
      signupDate
    };

    console.log('Sending transactional welcome email to:', userEmail);

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'contributor.info <no-reply@updates.contributor.info>',
        to: [userEmail],
        subject: 'Welcome to Contributor.info',
        html: getWelcomeEmailHTML(emailData),
        text: getWelcomeEmailText(emailData),
        tags: [
          { name: 'type', value: 'transactional' },
          { name: 'user_id', value: record.id }
        ]
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        error: errorText
      });
      throw new Error(`Resend API error: ${emailResponse.status} ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log('Welcome email sent successfully:', emailResult);

    // AUDIENCE MANAGEMENT: Add user to Resend audience
    let audienceId = null;
    let contactId = null;
    
    try {
      audienceId = await ensureAudienceExists(resendApiKey);
      contactId = await addUserToAudience(resendApiKey, audienceId, userEmail, userName);
      console.log('User successfully added to audience:', { audienceId, contactId });
    } catch (audienceError) {
      // Don't fail the main function if audience management fails
      console.warn('Failed to manage audience - email sent but user not added to audience:', audienceError);
    }

    // GDPR COMPLIANCE: Log the email send for audit trail
    try {
      await supabase
        .from('email_logs')
        .insert({
          user_id: record.id,
          email_type: 'welcome',
          recipient_email: userEmail,
          resend_email_id: emailResult.id,
          sent_at: new Date().toISOString(),
          legal_basis: 'contract',
          gdpr_log_id: gdprLogId,
          metadata: {
            user_name: userName,
            signup_date: signupDate,
            transactional: true,
            privacy_policy_version: '1.0',
            audience_id: audienceId,
            contact_id: contactId
          }
        });
        
      // Mark GDPR processing as completed
      await supabase
        .from('gdpr_processing_log')
        .update({ 
          processing_completed_at: new Date().toISOString(),
          notes: `Welcome email sent successfully via Resend (ID: ${emailResult.id})`
        })
        .eq('id', gdprLogId);
        
      console.log('Email send logged successfully with GDPR compliance');
    } catch (logError) {
      // Don't fail the main function if logging fails, but warn about compliance
      console.warn('Failed to log email send - GDPR compliance may be affected:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transactional welcome email sent successfully',
        email_id: emailResult.id 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending welcome email:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send welcome email',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});