# Email System Documentation

## Overview

The contributor.info email system handles various transactional emails including workspace invitations, notifications, and user communications. All emails are designed with GDPR compliance, accessibility, and a consistent brand experience in mind.

## Email Types

### 1. Workspace Invitation Emails

Workspace invitation emails are sent when a workspace owner or admin invites a new member to join their workspace.

#### Features:
- **Beautiful HTML templates** with responsive design
- **Plain text fallback** for email clients that don't support HTML
- **GDPR compliance** with processing activity logging
- **Secure token-based acceptance** via unique invitation links
- **Expiration handling** (7-day default expiration)
- **Role-based permissions** display (Admin, Editor, Viewer)

#### Email Flow:
1. Admin initiates invitation through UI or API
2. System generates secure invitation token
3. Email is sent via Supabase Edge Function
4. Recipient receives email with accept/decline options
5. Clicking accept redirects to workspace acceptance page
6. System validates token and adds user as member
7. Member count is atomically incremented
8. Activity is logged for audit trail

### 2. System Notifications (Planned)

- Repository sync completions
- Error notifications for failed operations
- Security alerts

### 3. User Notifications (Planned)

- New contributor activity
- Milestone achievements
- Weekly/monthly summaries

## Technical Implementation

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│ Supabase     │────▶│ Email Edge  │
│   Trigger   │     │ Database     │     │ Functions   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ Activity Log │     │ Email       │
                    │ & GDPR Log   │     │ Service     │
                    └──────────────┘     └─────────────┘
```

### Database Schema

#### Email Logs Table
```sql
email_logs (
  id: UUID PRIMARY KEY,
  recipient_email: TEXT NOT NULL,
  email_type: TEXT CHECK (IN 'workspace_invitation', 'notification', etc),
  subject: TEXT,
  sent_at: TIMESTAMPTZ,
  status: TEXT CHECK (IN 'sent', 'failed', 'bounced'),
  metadata: JSONB,
  legal_basis: TEXT CHECK (IN 'consent', 'contract', 'legitimate_interest'),
  gdpr_log_id: UUID REFERENCES gdpr_processing_log(id)
)
```

#### GDPR Processing Log
```sql
gdpr_processing_log (
  id: UUID PRIMARY KEY,
  user_id: UUID,
  processing_activity: TEXT,
  legal_basis: TEXT,
  purpose: TEXT,
  data_categories: TEXT[],
  retention_period: TEXT,
  created_at: TIMESTAMPTZ,
  notes: TEXT
)
```

#### Workspace Activity Log
```sql
workspace_activity_log (
  id: UUID PRIMARY KEY,
  workspace_id: UUID REFERENCES workspaces(id),
  user_id: UUID,
  action: TEXT CHECK (IN 'invitation_sent', 'invitation_accepted', etc),
  details: JSONB,
  created_at: TIMESTAMPTZ
)
```

### Edge Functions

#### workspace-invitation-email
Sends invitation emails with HTML and plain text versions.

**Endpoint:** `/workspace-invitation-email`

**Request:**
```json
{
  "recipientEmail": "user@example.com",
  "recipientName": "John Doe",
  "workspaceName": "My Workspace",
  "workspaceSlug": "my-workspace",
  "inviterName": "Admin Name",
  "inviterEmail": "admin@example.com",
  "role": "editor",
  "invitationToken": "secure-token-here",
  "expiresAt": "2024-01-08T00:00:00Z"
}
```

#### workspace-invitation-accept
Handles invitation acceptance with authentication and validation.

**Endpoint:** `/workspace-invitation-accept`

**Headers:**
```
Authorization: Bearer <user-token>
```

**Request:**
```json
{
  "token": "invitation-token"
}
```

**Process:**
1. Authenticates user via header
2. Fetches user email via RPC function (secure auth.users access)
3. Validates invitation token and expiration
4. Verifies email match
5. Adds user to workspace
6. Updates invitation status
7. Increments member count atomically
8. Logs activity for audit

#### workspace-invitation-decline
Handles invitation declination.

**Endpoint:** `/workspace-invitation-decline`

**Request:**
```json
{
  "token": "invitation-token",
  "reason": "optional-decline-reason"
}
```

## Email Templates

### Design System
- **Colors**: Black & white theme with accent colors for CTAs
- **Typography**: System fonts for maximum compatibility
- **Layout**: Single column, max-width 600px
- **Images**: Minimal use, text-focused for accessibility

### HTML Template Structure
```html
<!DOCTYPE html>
<html>
<head>
  <!-- Responsive meta tags -->
  <!-- Inline CSS for maximum compatibility -->
</head>
<body>
  <div class="email-container">
    <div class="card">
      <div class="header">
        <!-- Brand header -->
      </div>
      <div class="content">
        <!-- Main message -->
        <div class="workspace-info">
          <!-- Workspace details -->
        </div>
        <div class="permissions">
          <!-- Role permissions -->
        </div>
        <div class="cta-container">
          <!-- Accept/Decline buttons -->
        </div>
        <div class="expiry-notice">
          <!-- Expiration warning -->
        </div>
      </div>
      <div class="footer">
        <!-- Legal/unsubscribe links -->
      </div>
    </div>
  </div>
</body>
</html>
```

### Plain Text Template
```
You've been invited to join [Workspace Name] on Contributor.info!

[Inviter Name] has invited you to collaborate as [Role].

Workspace Details:
- Name: [Workspace Name]
- Your Role: [Role]
- Permissions: [List of permissions]

⏰ This invitation expires on [Date]

Accept invitation:
[Accept URL]

Decline invitation:
[Decline URL]

---
Contributor.info - Track and showcase your open source contributions
```

## Security Considerations

### Token Security
- **Cryptographically secure** random tokens (UUID v4)
- **Single use** - tokens are invalidated after use
- **Time-limited** - 7-day expiration by default
- **Stored hashed** - tokens are hashed in database

### Authentication Flow
1. User authentication via Bearer token in header
2. Service role client for database operations
3. RPC functions for secure auth.users access
4. Row Level Security (RLS) policies for data access

### Email Validation
- Email addresses are validated before sending
- Bounce handling for invalid addresses
- Rate limiting on invitation endpoints
- CAPTCHA for public invitation forms (future)

## GDPR Compliance

### Legal Basis
All email sending activities have documented legal basis:
- **Consent**: Marketing emails (future)
- **Contract**: Service-related emails to users
- **Legitimate Interest**: Security alerts, critical updates

### Data Processing Activities
Each email sent creates:
1. **Email log** with sending details
2. **GDPR processing log** with legal basis
3. **Activity log** for audit trail

### User Rights
- **Access**: Users can request email history
- **Rectification**: Update email preferences
- **Erasure**: Delete email logs (subject to retention requirements)
- **Portability**: Export email communication history

### Retention Policy
- **Transactional emails**: 90 days
- **Invitation emails**: Until accepted/declined or 30 days
- **GDPR logs**: 3 years for compliance
- **Activity logs**: 1 year for audit

## Configuration

### Environment Variables
```env
# Email Service Configuration
EMAIL_FROM=noreply@contributor.info
EMAIL_FROM_NAME=Contributor.info

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Optional: External Email Service (future)
SENDGRID_API_KEY=your-sendgrid-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
```

### Rate Limits
- **Invitation emails**: 10 per workspace per hour
- **User notifications**: 100 per day per user
- **System alerts**: No limit

## Testing

### Local Development
1. Use Supabase local development environment
2. Email previews available at `http://localhost:54324/inbox`
3. Test tokens don't expire in development

### Test Cases
- ✅ Send invitation email
- ✅ Accept invitation with valid token
- ✅ Decline invitation
- ✅ Handle expired tokens
- ✅ Validate email mismatch
- ✅ Handle already-member scenario
- ✅ Rate limiting enforcement
- ✅ GDPR logging verification

## Monitoring

### Metrics to Track
- **Delivery rate**: Successful vs failed emails
- **Open rate**: Email engagement
- **Click rate**: CTA engagement
- **Acceptance rate**: Invitations accepted vs declined
- **Time to accept**: Average time from send to accept

### Alerts
- High bounce rate (>5%)
- Failed email sends
- Rate limit breaches
- Token validation failures

## Future Enhancements

### Planned Features
1. **Email Templates Management**: UI for customizing email templates
2. **Localization**: Multi-language email support
3. **A/B Testing**: Test different email designs
4. **Rich Analytics**: Detailed email performance metrics
5. **Webhook Integration**: Third-party email service support
6. **Batch Invitations**: Send multiple invitations at once
7. **Email Preferences**: User-controlled notification settings
8. **Re-send Capability**: Resend expired invitations
9. **Custom Branding**: Workspace-specific email templates
10. **Email Verification**: Verify email ownership before sending

### Integration Opportunities
- SendGrid/Mailgun for high-volume sending
- Customer.io for advanced email automation
- Segment for email analytics
- Zapier for workflow automation

## Troubleshooting

### Common Issues

#### Email Not Received
1. Check spam/junk folder
2. Verify email address is correct
3. Check email logs in database
4. Verify Edge Function execution logs

#### Token Invalid Error
1. Check token expiration
2. Verify token hasn't been used
3. Ensure correct workspace context
4. Check for database sync issues

#### Rate Limit Exceeded
1. Check current usage in headers
2. Wait for rate limit reset
3. Consider upgrading workspace tier
4. Implement client-side throttling

## API Reference

See [Workspace API Documentation](../api/workspaces.md) for detailed endpoint specifications.

## Support

For issues related to the email system:
1. Check [GitHub Issues](https://github.com/bdougie/contributor.info/issues)
2. Review Edge Function logs in Supabase Dashboard
3. Contact support with correlation IDs from logs