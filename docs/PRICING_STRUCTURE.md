# Contributor.info Pricing Structure

## Overview
Our pricing model is designed to scale with your needs, from individual developers to growing teams.

## Tier Comparison

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| **Price** | $0/mo | $19/mo | $99/mo |
| **Workspaces** | 0 | 1 included | 3 included |
| **Privacy** | N/A | Public only | Private & Public |
| **Repos per Workspace** | N/A | 3 | 3 |
| **Team Members** | N/A | 1 (solo) | 5 included |
| **Data Retention** | 7 days | 30 days | 30 days |
| **Analytics Level** | Basic | Advanced | Enterprise |
| **Exports** | ❌ | ✅ | ✅ |
| **SSO** | ❌ | ❌ | ✅ |
| **Audit Logs** | ❌ | ❌ | ✅ |

## Tier Details

### Free Tier ($0/month)
- **Best for**: Individual contributors exploring the platform
- **Limitations**:
  - No workspace creation
  - 7-day data retention only
  - Basic analytics only
  - No export capabilities

### Pro Tier ($19/month)
- **Best for**: Solo developers and individual professionals
- **Includes**:
  - 1 workspace (public only)
  - Up to 3 repositories per workspace
  - Solo use only (no team member invites)
  - 30-day data retention
  - Advanced analytics
  - Data export capabilities
- **Add-ons**:
  - Additional workspace: $12/month

### Team Tier ($99/month)
- **Best for**: Small to medium teams requiring collaboration
- **Includes**:
  - 3 workspaces
  - Private and public workspace options
  - Up to 3 repositories per workspace
  - 5 team members included
  - 30-day data retention
  - Enterprise analytics
  - Data export capabilities
  - SSO support
  - Audit logs
- **Add-ons**:
  - Additional workspace: $12/month
  - Additional team member: $20/month (after first 5)

## Implementation Notes

### Database Schema
The subscription data is stored in the `subscriptions` table with the following key fields:
- `user_id`: Links to the user who owns the subscription
- `tier`: One of 'free', 'pro', or 'team'
- `status`: Subscription status (active, canceled, past_due, trialing, inactive)
- `polar_subscription_id`: External subscription ID from Polar
- `polar_customer_id`: External customer ID from Polar

### Feature Flags
Features are controlled through the `SubscriptionService` class which checks:
- Workspace limits
- Repository limits per workspace
- Team member limits
- Private workspace access
- Data retention periods
- Export capabilities

### Billing Integration
We use Polar.sh for payment processing:
- Checkout sessions are created via `/.netlify/functions/polar-checkout`
- Webhooks handle subscription updates via `/.netlify/functions/polar-webhook`
- Product IDs are configured in environment variables:
  - `VITE_POLAR_PRODUCT_ID_PRO`: Pro tier product
  - `VITE_POLAR_PRODUCT_ID_TEAM`: Team tier product

## Upgrade/Downgrade Policies

### Upgrading
- Immediate access to new features upon successful payment
- Prorated billing for mid-cycle upgrades
- Existing data and workspaces are preserved

### Downgrading
- Changes take effect at the end of the current billing period
- Data beyond the new tier's retention period may be archived
- Workspaces exceeding the new limit become read-only

### Cancellation
- Access continues until the end of the current billing period
- Data is retained for 30 days after cancellation
- Subscription can be reactivated within the grace period

## Future Considerations
- Enterprise tier for larger organizations
- Custom pricing for high-volume users
- Extended data retention add-ons
- API access tiers