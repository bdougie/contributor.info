# Polar Subscription System Setup Guide

This guide walks through setting up the Polar.sh subscription system for contributor.info workspaces.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: Polar Account Setup](#step-1-polar-account-setup)
- [Step 2: Create Subscription Products](#step-2-create-subscription-products)
- [Step 3: Configure Webhooks](#step-3-configure-webhooks)
- [Step 4: Environment Configuration](#step-4-environment-configuration)
- [Step 5: Deploy and Test](#step-5-deploy-and-test)
- [Troubleshooting](#troubleshooting)

## Overview

The Polar subscription system provides:
- **Three tiers**: Free, Pro ($29/month), Team ($99/month)
- **Workspace limits**: Control workspace, repository, and member counts
- **Feature gating**: Private workspaces, data exports, extended retention
- **Simple integration**: 4-line checkout integration
- **Tax compliance**: Polar handles global tax as Merchant of Record

## Prerequisites

- Node.js 18+ and npm
- Supabase project with authentication configured
- Netlify account for serverless functions
- GitHub OAuth app configured in Supabase

## Step 1: Polar Account Setup

### 1.1 Create a Polar Account

1. Go to [https://polar.sh](https://polar.sh)
2. Sign up with GitHub
3. Create an organization for your project

### 1.2 Generate Access Token

1. Navigate to **Settings** → **Access Tokens**
2. Click **"Create Access Token"**
3. Name it (e.g., "contributor.info Production")
4. Select scopes:
   - `products:read`
   - `checkouts:write`
   - `customers:read`
   - `customers:write`
   - `subscriptions:read`
   - `subscriptions:write`
5. Copy and save the token (starts with `polar_pat_`)

## Step 2: Create Subscription Products

### 2.1 Create Pro Tier Product

1. Go to **Products** in Polar dashboard
2. Click **"Create Product"**
3. Configure:
   ```
   Name: Pro Plan
   Description: Unlimited workspaces, 20 repos per workspace, advanced analytics
   Price: $29
   Billing: Monthly recurring
   Product ID: (auto-generated, e.g., prod_xxxxx_pro)
   ```
4. Add benefits:
   - Unlimited workspaces
   - 20 repositories per workspace
   - Unlimited team members
   - 365-day data retention
   - Private workspaces
   - Data exports

### 2.2 Create Team Tier Product

1. Click **"Create Product"** again
2. Configure:
   ```
   Name: Team Plan
   Description: Everything in Pro + 100 repos, SSO, audit logs
   Price: $99
   Billing: Monthly recurring
   Product ID: (auto-generated, e.g., prod_xxxxx_team)
   ```
3. Add benefits:
   - Everything in Pro
   - 100 repositories per workspace
   - Unlimited data retention
   - SSO authentication
   - Audit logs
   - Priority support

### 2.3 Configure GitHub Repository Benefits (Optional)

If you have premium documentation or tools in separate repos:

1. Go to **Benefits** → **GitHub Repository Access**
2. Add repositories that Pro/Team users should access
3. Link benefits to respective products

## Step 3: Configure Webhooks

### 3.1 Create Webhook Endpoint

1. Go to **Settings** → **Webhooks**
2. Click **"Create Webhook"**
3. Configure:
   ```
   Name: Production Webhook
   URL: https://your-app.netlify.app/.netlify/functions/polar-webhook
   Events: Select all subscription and customer events
   ```
4. Copy the webhook secret (starts with `polar_whs_`)

### 3.2 Select Webhook Events

Enable these events:
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.revoked`
- `customer.created`
- `customer.updated`
- `order.created`

## Step 4: Environment Configuration

### 4.1 Local Development (.env.local)

```bash
# Polar Configuration (Sandbox)
POLAR_ACCESS_TOKEN=polar_pat_sandbox_xxxxx
POLAR_WEBHOOK_SECRET=polar_whs_sandbox_xxxxx
POLAR_PRODUCT_ID_PRO=prod_sandbox_pro_xxxxx
POLAR_PRODUCT_ID_TEAM=prod_sandbox_team_xxxxx
POLAR_ENVIRONMENT=sandbox

# Existing Supabase config
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4.2 Production Environment (Netlify)

In Netlify Dashboard → Site Settings → Environment Variables:

```bash
# Polar Configuration (Production)
POLAR_ACCESS_TOKEN=polar_pat_production_xxxxx
POLAR_WEBHOOK_SECRET=polar_whs_production_xxxxx
POLAR_PRODUCT_ID_PRO=prod_production_pro_xxxxx
POLAR_PRODUCT_ID_TEAM=prod_production_team_xxxxx
POLAR_ENVIRONMENT=production

# Base URL for redirects
BASE_URL=https://contributor.info
```

## Step 5: Deploy and Test

### 5.1 Database Migration

The migration should already be applied, but verify:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscriptions', 'feature_usage', 'subscription_features');
```

### 5.2 Deploy to Netlify

```bash
# Commit changes
git add .
git commit -m "feat: add Polar subscription system"
git push origin feature/workspace-subscriptions

# Create PR and merge to main
# Netlify will auto-deploy
```

### 5.3 Test Subscription Flow

#### Sandbox Testing

1. Use Polar's test mode (sandbox environment)
2. Test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
3. Any future expiry date and CVC

#### Test Checklist

- [ ] Navigate to `/billing` page
- [ ] View current plan (should show Free)
- [ ] Click "Upgrade to Pro"
- [ ] Complete checkout with test card
- [ ] Verify webhook received (check Netlify function logs)
- [ ] Confirm subscription updated in database
- [ ] Test limit enforcement (try creating > 1 workspace on Free)
- [ ] Test cancellation flow
- [ ] Verify downgrade to Free tier

### 5.4 Monitor Webhook Events

Check webhook delivery in Polar dashboard:
1. Go to **Settings** → **Webhooks** → **Your Webhook**
2. Click **"Recent Deliveries"**
3. Verify successful delivery (200 status)

Check Netlify function logs:
```bash
netlify functions:log polar-webhook --tail
```

## Subscription Tiers Reference

| Feature | Free | Pro ($29/mo) | Team ($99/mo) |
|---------|------|--------------|---------------|
| Workspaces | 1 (public only) | Unlimited | Unlimited |
| Repos per workspace | 2 | 20 | 100 |
| Members per workspace | 3 | Unlimited | Unlimited |
| Data retention | 30 days | 365 days | Unlimited |
| Private workspaces | ❌ | ✅ | ✅ |
| Data exports | ❌ | ✅ | ✅ |
| Advanced analytics | ❌ | ✅ | ✅ |
| SSO authentication | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ✅ |

## Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Events

- Verify webhook URL is correct and publicly accessible
- Check webhook secret matches in both Polar and environment variables
- Ensure Netlify function is deployed
- Check Netlify function logs for errors

#### 2. Subscription Not Updating

- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (webhooks need admin access)
- Check database RLS policies allow service role
- Verify user_id is passed in checkout metadata

#### 3. Checkout Redirect Issues

- Ensure `BASE_URL` environment variable is set correctly
- Check CORS settings if using custom domain
- Verify Polar checkout session is created successfully

#### 4. Limit Enforcement Not Working

- Check subscription status in database
- Verify feature_usage table is being updated
- Check subscription tier is correctly mapped

### Debug Queries

```sql
-- Check user's current subscription
SELECT * FROM subscriptions 
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC;

-- Check feature usage
SELECT * FROM feature_usage
WHERE user_id = 'USER_ID_HERE';

-- Check subscription features
SELECT * FROM subscription_features
ORDER BY tier, feature_name;

-- Check workspace limits
SELECT 
  w.id,
  w.name,
  COUNT(DISTINCT wr.repository_id) as repo_count,
  COUNT(DISTINCT wm.user_id) as member_count
FROM workspaces w
LEFT JOIN workspace_repositories wr ON w.id = wr.workspace_id
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE w.owner_id = 'USER_ID_HERE'
GROUP BY w.id, w.name;
```

## Production Checklist

Before going live:

- [ ] Switch from sandbox to production environment
- [ ] Update all product IDs to production values
- [ ] Configure production webhook endpoint
- [ ] Test with real payment method (can refund)
- [ ] Set up monitoring for failed payments
- [ ] Configure customer support email in Polar
- [ ] Set up usage alerts for approaching limits
- [ ] Document refund/cancellation process
- [ ] Create internal admin tools for subscription management

## Support Resources

- **Polar Documentation**: [https://docs.polar.sh](https://docs.polar.sh)
- **Polar Support**: support@polar.sh
- **API Reference**: [https://api.polar.sh/docs](https://api.polar.sh/docs)
- **Status Page**: [https://status.polar.sh](https://status.polar.sh)

## Next Steps

1. **Customer Portal**: Users can manage subscriptions at `https://polar.sh/purchases`
2. **Usage Analytics**: Implement usage tracking dashboard
3. **Upgrade Prompts**: Add contextual upgrade prompts when limits are reached
4. **Email Notifications**: Set up email alerts for subscription changes
5. **Admin Dashboard**: Build internal tools for subscription management