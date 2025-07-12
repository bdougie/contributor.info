# Resend Email Integration

This document outlines the Resend email service integration for contributor.info.

## Overview

Resend is used for sending transactional emails, specifically welcome emails when users sign up via GitHub OAuth.

## Current Implementation

### Welcome Email System
- **Trigger**: Supabase Auth Hook on user signup
- **Function**: `supabase/functions/welcome-email/index.ts`
- **Domain**: `updates.contributor.info` (verified domain)
- **From Address**: `no-reply@updates.contributor.info`

### Email Design
- Black and white design matching app aesthetic
- "Welcome 🌱contributor.info" header
- Personal signature from bdougie
- Responsive HTML template with plain text fallback

### GDPR Compliance
- Sent under contractual necessity (transactional)
- Comprehensive audit logging in `email_logs` table
- GDPR processing records in `gdpr_processing_log` table

## Configuration

### Environment Variables
```bash
RESEND_API_KEY=re_xxx  # API key for sending emails
```

### Domain Setup
1. Domain `updates.contributor.info` is verified in Resend dashboard
2. DNS records configured for email deliverability
3. SPF, DKIM, and DMARC records properly set

## API Usage

### Sending Emails
```typescript
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
```

## Paid Features (Not Currently Used)

### Audience Management
Resend offers audience management features for subscriber lists, but these require a paid plan:

- **Audiences API**: Create and manage subscriber lists
- **Contacts API**: Add/remove contacts from audiences
- **Segmentation**: Target specific user groups
- **Analytics**: Track email performance and engagement

### Future Implementation
If upgraded to a paid plan, audience management could be added to:
1. Automatically add new users to a "Welcomed Users" audience
2. Send targeted email campaigns to specific user segments
3. Track user engagement and email preferences
4. Implement newsletter and product update emails

Example audience management code (for future use):
```typescript
// Create audience
const audienceResponse = await fetch('https://api.resend.com/audiences', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Welcomed Users'
  }),
});

// Add contact to audience
const contactResponse = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: userEmail,
    first_name: firstName,
    last_name: lastName,
    unsubscribed: false
  }),
});
```

## Testing

### Storybook Integration
Email templates can be tested and previewed using Storybook:
- **Story**: `src/stories/WelcomeEmail.stories.tsx`
- **URL**: `http://localhost:6006/?path=/story/email-templates-welcome-email`

### Manual Testing
```bash
# Test welcome email function
curl -X POST "https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/welcome-email" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "id": "test-user-id",
      "email": "test@example.com",
      "created_at": "2025-01-01T00:00:00Z",
      "raw_user_meta_data": {
        "name": "Test User"
      }
    }
  }'
```

## Monitoring

### Email Logs
All sent emails are logged in the `email_logs` table with:
- User ID and email address
- Resend email ID for tracking
- Send timestamp and legal basis
- Metadata including user information

### Error Handling
- Function logs errors to console for debugging
- GDPR processing failures are logged but don't stop email sending
- Resend API errors are captured and returned in function response

## Best Practices

1. **Always use verified domains** for from addresses
2. **Include unsubscribe links** in marketing emails (not required for transactional)
3. **Tag emails appropriately** for tracking and analytics
4. **Monitor delivery rates** and spam complaints
5. **Keep email content concise** and mobile-friendly
6. **Test templates thoroughly** before deployment

## Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Email Best Practices](https://resend.com/docs/knowledge-base/email-best-practices)
- [Domain Verification Guide](https://resend.com/docs/knowledge-base/domains)