# Email Templates Quick Reference

## Workspace Invitation Email

### Template Variables

These variables are available in both HTML and plain text templates:

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `recipientEmail` | string | Email address of invitee | "john@example.com" |
| `recipientName` | string | Name of invitee (optional) | "John Doe" |
| `workspaceName` | string | Name of the workspace | "My Open Source Projects" |
| `workspaceSlug` | string | URL-safe workspace identifier | "my-open-source-projects" |
| `inviterName` | string | Name of the person inviting | "Jane Admin" |
| `inviterEmail` | string | Email of the inviter | "jane@example.com" |
| `role` | enum | Permission level | "admin", "editor", "viewer" |
| `invitationToken` | string | Secure acceptance token | "uuid-token-here" |
| `expiresAt` | string | ISO 8601 expiration date | "2024-01-08T00:00:00Z" |

### Role Permissions Display

#### Admin
- Full workspace management
- Invite and remove members
- Manage repositories
- View all analytics
- Configure workspace settings

#### Editor  
- Add and remove repositories
- View analytics and insights
- Monitor contributor activity
- Cannot manage members

#### Viewer
- View workspace repositories
- Access analytics and insights
- Monitor contributor activity
- Read-only access

### Email Subject Lines

```
"{{inviterName}} invited you to join {{workspaceName}} on Contributor.info"
```

### Call-to-Action URLs

#### Accept Invitation
```
https://contributor.info/workspace/invitation/accept?token={{invitationToken}}
```

#### Decline Invitation
```
https://contributor.info/workspace/invitation/decline?token={{invitationToken}}
```

### Color Palette

```css
:root {
  --primary: #000000;        /* Black - Headers, primary text */
  --background: #F8F9FA;     /* Light gray - Email background */
  --card: #FFFFFF;           /* White - Content cards */
  --foreground: #11181C;     /* Dark slate - Body text */
  --muted: #6B7280;          /* Gray - Secondary text */
  --border: #E5E7EB;         /* Light gray - Borders */
  --success: #10B981;        /* Green - Accept button */
  --danger: #EF4444;         /* Red - Decline button */
}
```

### Responsive Breakpoints

- **Mobile**: < 480px (single column, stacked buttons)
- **Tablet**: 480px - 768px (single column, side-by-side buttons)
- **Desktop**: > 768px (centered 600px max-width)

### Testing Email Templates

#### Local Development
1. Templates are rendered by Edge Functions
2. View in Supabase Inbox: `http://localhost:54324/inbox`
3. Test with different email clients using Litmus or Email on Acid

#### Test Scenarios
- [ ] Long workspace names (wrapping)
- [ ] Missing optional fields (recipientName)
- [ ] Different roles (admin, editor, viewer)
- [ ] Mobile responsiveness
- [ ] Dark mode compatibility
- [ ] Plain text fallback
- [ ] Link functionality
- [ ] Expiration display

### Email Client Compatibility

Tested and verified on:
- Gmail (Web, iOS, Android)
- Outlook (Web, Desktop, Mobile)
- Apple Mail (macOS, iOS)
- Yahoo Mail
- Thunderbird
- ProtonMail

### Accessibility Checklist

- [ ] Semantic HTML structure
- [ ] Alt text for images (if used)
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Logical reading order
- [ ] Clear link text (not just "click here")
- [ ] Font size minimum 14px
- [ ] Line height minimum 1.5
- [ ] Touch targets minimum 44x44px

### GDPR Compliance Elements

Every email must include:
1. **Clear sender identification**: "Contributor.info" with physical address
2. **Purpose statement**: Why the email was sent
3. **Data processing notice**: Link to privacy policy
4. **Unsubscribe option**: For marketing emails (future)
5. **Contact information**: Support email or link

### Email Footer Template

```html
<div class="footer">
  <p>© 2024 Contributor.info. All rights reserved.</p>
  <p>
    <a href="https://contributor.info/privacy">Privacy Policy</a> • 
    <a href="https://contributor.info/terms">Terms of Service</a> • 
    <a href="https://contributor.info/contact">Contact Support</a>
  </p>
  <p class="muted">
    You received this email because someone invited you to join a workspace on Contributor.info.
    This is a transactional email required for service operation.
  </p>
</div>
```

### Localization Support (Future)

Planned language support:
- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)
- Portuguese (pt)
- Japanese (ja)
- Chinese Simplified (zh-CN)

### Performance Guidelines

- **Total email size**: < 102KB (Gmail clipping threshold)
- **Image usage**: Minimal, text-focused design
- **CSS**: Inline styles only, no external stylesheets
- **Load time**: < 3 seconds on 3G connection
- **Preheader text**: First 100 characters optimized

### Monitoring & Analytics

Track these metrics:
- **Delivery rate**: > 95% expected
- **Open rate**: > 60% for transactional
- **Click rate**: > 30% for invitations
- **Bounce rate**: < 2% acceptable
- **Spam complaints**: < 0.1% threshold

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Email goes to spam | Check SPF/DKIM records, avoid spam trigger words |
| Links not working | Ensure proper URL encoding, test in multiple clients |
| Styling breaks | Use inline CSS, test with CSS inliner tool |
| Images not showing | Use absolute URLs, provide alt text |
| Mobile rendering issues | Use responsive table layouts, test on real devices |

### Development Workflow

1. **Edit template** in `/supabase/functions/workspace-invitation-email/index.ts`
2. **Test locally** with Supabase local development
3. **Preview** in multiple email clients
4. **Deploy** to Edge Function
5. **Monitor** delivery and engagement metrics
6. **Iterate** based on user feedback

### Resources

- [Can I Email](https://www.caniemail.com/) - Email client CSS/HTML support
- [MJML](https://mjml.io/) - Responsive email framework
- [Litmus](https://www.litmus.com/) - Email testing platform
- [Really Good Emails](https://reallygoodemails.com/) - Design inspiration
- [Email on Acid](https://www.emailonacid.com/) - Email testing
- [Postmark Templates](https://postmarkapp.com/transactional-email-templates) - Open source templates