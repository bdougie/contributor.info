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
        body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        .feature { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px; }
        .privacy-notice { background: #f0f4ff; border: 1px solid #d1e7ff; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
        .unsubscribe { background: #fafafa; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to Contributor.info!</h1>
            <p>Discover amazing open source contributors and their impact</p>
        </div>
        
        <div class="content">
            <h2>Hi ${data.userName}!</h2>
            
            <p>Thanks for joining Contributor.info on ${data.signupDate}! You're now part of a community that celebrates open source contributions and helps discover amazing developers.</p>
            
            <div class="feature">
                <h3>🔍 What you can do now:</h3>
                <ul>
                    <li><strong>Search repositories</strong> to find top contributors</li>
                    <li><strong>Analyze contribution patterns</strong> with detailed insights</li>
                    <li><strong>Track repository health</strong> and community metrics</li>
                    <li><strong>Discover new projects</strong> and maintainers to follow</li>
                </ul>
            </div>
            
            <div class="feature">
                <h3>📊 Featured insights:</h3>
                <ul>
                    <li>Contributor confidence scoring</li>
                    <li>Pull request activity analysis</li>
                    <li>Repository health metrics</li>
                    <li>Time-based contribution trends</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="https://contributor.info" class="button">Start Exploring →</a>
            </div>
            
            <div class="privacy-notice">
                <h4>🔒 Your Privacy Matters</h4>
                <p>We process your email address based on your consent when you signed up. You can manage your email preferences or withdraw consent at any time by visiting your <a href="https://contributor.info/settings/privacy">Privacy Settings</a>.</p>
                <p>Read our <a href="https://contributor.info/privacy">Privacy Policy</a> for details on how we protect your data.</p>
            </div>
            
            <p>If you have any questions or feedback, just reply to this email. We'd love to hear from you!</p>
            
            <p>Happy contributing!<br>
            The Contributor.info Team</p>
        </div>
        
        <div class="unsubscribe">
            <p><strong>Email Preferences:</strong></p>
            <p>• You received this welcome email because you signed up for Contributor.info</p>
            <p>• <a href="https://contributor.info/settings/email-preferences">Manage email preferences</a></p>
            <p>• <a href="https://contributor.info/unsubscribe?token={{unsubscribe_token}}">Unsubscribe from all emails</a></p>
            <p>• <a href="https://contributor.info/privacy/data-request">Request your data or deletion</a></p>
        </div>
        
        <div class="footer">
            <p>Built with ❤️ for the open source community</p>
            <p>This email was sent in compliance with GDPR and privacy regulations</p>
        </div>
    </div>
</body>
</html>
`;

const getWelcomeEmailText = (data: WelcomeEmailData) => `
Welcome to Contributor.info!

Hi ${data.userName}!

Thanks for joining Contributor.info on ${data.signupDate}! You're now part of a community that celebrates open source contributions and helps discover amazing developers.

What you can do now:
• Search repositories to find top contributors
• Analyze contribution patterns with detailed insights  
• Track repository health and community metrics
• Discover new projects and maintainers to follow

Featured insights:
• Contributor confidence scoring
• Pull request activity analysis
• Repository health metrics
• Time-based contribution trends

Get started: https://contributor.info

YOUR PRIVACY MATTERS
We process your email address based on your consent when you signed up. You can manage your email preferences or withdraw consent at any time by visiting: https://contributor.info/settings/privacy

Read our Privacy Policy: https://contributor.info/privacy

If you have any questions or feedback, just reply to this email. We'd love to hear from you!

Happy contributing!
The Contributor.info Team

EMAIL PREFERENCES:
• You received this welcome email because you signed up for Contributor.info
• Manage email preferences: https://contributor.info/settings/email-preferences
• Unsubscribe from all emails: https://contributor.info/unsubscribe?token={{unsubscribe_token}}
• Request your data or deletion: https://contributor.info/privacy/data-request

This email was sent in compliance with GDPR and privacy regulations.
Built with ❤️ for the open source community
`;

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

    // GDPR COMPLIANCE: Check user consent before sending email
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user has consented to welcome emails
    const { data: consentData, error: consentError } = await supabase
      .rpc('user_has_email_consent', {
        p_user_id: record.id,
        p_email_type: 'welcome'
      });

    if (consentError) {
      console.error('Error checking user consent:', consentError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify user consent' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!consentData) {
      console.log('User has not consented to welcome emails, skipping send:', userEmail);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email send skipped - user has not consented to welcome emails',
          reason: 'no_consent'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log GDPR processing activity
    const { data: gdprLogId, error: gdprError } = await supabase
      .rpc('log_gdpr_processing', {
        p_user_id: record.id,
        p_purpose: 'welcome_email',
        p_legal_basis: 'consent',
        p_data_categories: ['email', 'name'],
        p_notes: `Sending welcome email to ${userEmail}`
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

    console.log('User has consented, sending welcome email to:', userEmail);

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Contributor.info <welcome@contributor.info>',
        to: [userEmail],
        subject: '🎉 Welcome to Contributor.info - Discover Amazing Open Source Contributors!',
        html: getWelcomeEmailHTML(emailData),
        text: getWelcomeEmailText(emailData),
        tags: [
          { name: 'type', value: 'welcome' },
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
          legal_basis: 'consent',
          gdpr_log_id: gdprLogId,
          metadata: {
            user_name: userName,
            signup_date: signupDate,
            consent_verified: true,
            privacy_policy_version: '1.0'
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
        message: 'Welcome email sent successfully',
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