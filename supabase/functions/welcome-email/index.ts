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
        .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 13px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Contributor.info!</h1>
        </div>
        
        <div class="content">
            <p>Hi ${data.userName},</p>
            
            <p>Your account has been successfully created. You can now:</p>
            
            <ul>
                <li>Search GitHub repositories</li>
                <li>View contributor analytics</li>
                <li>Track repository health metrics</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="https://contributor.info" class="button">Get Started</a>
            </div>
            
            <p>If you have any questions, feel free to reply to this email.</p>
            
            <p>Best regards,<br>
            The Contributor.info Team</p>
        </div>
        
        <div class="footer">
            <p>
                <a href="https://contributor.info/settings/email-preferences">Email preferences</a> • 
                <a href="https://contributor.info/privacy">Privacy policy</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

const getWelcomeEmailText = (data: WelcomeEmailData) => `
Welcome to Contributor.info!

Hi ${data.userName},

Your account has been successfully created. You can now:

• Search GitHub repositories
• View contributor analytics
• Track repository health metrics

Get started: https://contributor.info

If you have any questions, feel free to reply to this email.

Best regards,
The Contributor.info Team

--
Email preferences: https://contributor.info/settings/email-preferences
Privacy policy: https://contributor.info/privacy
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
        from: 'Contributor.info <welcome@contributor.info>',
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