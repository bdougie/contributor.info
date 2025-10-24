# Polar Webhook Error Handling

## Overview

This document describes the error handling patterns, debugging procedures, and monitoring best practices for the Polar webhook integration. This guide was created following the resolution of Issue #1105 (Subscription Activation Failures).

## Error Handling Patterns

### Database Operations

**Always check errors on database operations**. Never assume database calls succeed.

```typescript
// ✅ CORRECT: Check for errors
const { data, error } = await supabase.from('subscriptions').upsert({
  // ... data
});

if (error) {
  console.error('❌ Failed to create subscription:', error);
  throw error; // Return error to Polar for retry
}

console.log('✅ Subscription created:', data);
```

```typescript
// ❌ INCORRECT: Silent failure
await supabase.from('subscriptions').upsert({
  // ... data
});
// No error checking - fails silently!
```

### Validation and Logging

**Log warnings for unexpected values** to help with debugging:

```typescript
// ✅ CORRECT: Validation with context logging
const tier = mapProductToTier(subscription.product_id);

if (tier === 'free' && subscription.product_id) {
  console.error('⚠️ Product ID mismatch!');
  console.error('Product:', subscription.product_id);
  console.error('Expected Pro:', process.env.POLAR_PRODUCT_ID_PRO);
  console.error('Expected Team:', process.env.POLAR_PRODUCT_ID_TEAM);
}
```

```typescript
// ❌ INCORRECT: Silent fallback
function mapProductToTier(productId: string): string {
  return productTierMap[productId] || 'free'; // Dangerous!
}
```

### Required Field Validation

**Validate all required fields** before proceeding:

```typescript
// ✅ CORRECT: Validate required fields
const userId = subscription.metadata?.user_id as string;
if (!userId) {
  console.error('❌ No user_id in subscription metadata:', subscription.id);
  throw new Error('Missing user_id in subscription metadata');
}

// Proceed with userId
```

```typescript
// ❌ INCORRECT: Assume field exists
const userId = subscription.metadata?.user_id as string;
// No validation - may be undefined!
```

## Webhook Event Handlers

### onSubscriptionCreated

Critical error handling points:

1. **User ID validation**
   ```typescript
   const userId = subscription.metadata?.user_id as string;
   if (!userId) {
     throw new Error('Missing user_id in subscription metadata');
   }
   ```

2. **Tier mapping validation**
   ```typescript
   const tier = mapProductToTier(subscription.product_id);
   if (tier === 'free' && subscription.product_id) {
     console.error('⚠️ Product ID mismatch!', ...);
   }
   ```

3. **Database upsert validation**
   ```typescript
   const { data, error } = await supabase.from('subscriptions').upsert({...});
   if (error) {
     console.error('❌ Failed to create subscription:', error);
     throw error;
   }
   ```

### onSubscriptionUpdated

Similar error handling as creation, plus:

1. **Addon detection validation**
   ```typescript
   if (isExtendedRetentionAddon && subscription.status === 'active') {
     const userId = subscription.metadata?.user_id as string;
     if (!userId) {
       console.error('No user_id in subscription metadata for addon');
       return;
     }
   }
   ```

2. **Update operation validation**
   ```typescript
   const { error: updateError } = await supabase
     .from('subscriptions')
     .update({...})
     .eq('polar_subscription_id', subscription.id);

   if (updateError) {
     console.error('❌ Failed to update subscription:', updateError);
     throw updateError;
   }
   ```

## Required Subscription Fields

When creating or updating subscriptions, **always include all required fields**:

```typescript
const limits = getTierLimits(tier);
const billingCycle =
  subscription.recurring_interval === 'year' ? 'yearly' :
  subscription.recurring_interval === 'month' ? 'monthly' : null;

await supabase.from('subscriptions').upsert({
  // Identity fields
  user_id: userId,
  polar_customer_id: subscription.customer_id,
  polar_subscription_id: subscription.id,

  // Subscription details
  status: subscription.status,
  tier,

  // Critical for workspace creation
  max_workspaces: limits.max_workspaces,
  max_repos_per_workspace: limits.max_repos_per_workspace,
  billing_cycle: billingCycle,

  // Period tracking
  current_period_start: subscription.current_period_start,
  current_period_end: subscription.current_period_end,

  // Timestamps
  created_at: subscription.created_at,
  updated_at: new Date().toISOString(),
});
```

### Field Descriptions

| Field | Required | Description | Source |
|-------|----------|-------------|--------|
| `user_id` | ✅ | User identifier | `subscription.metadata.user_id` |
| `polar_customer_id` | ✅ | Polar customer ID | `subscription.customer_id` |
| `polar_subscription_id` | ✅ | Polar subscription ID | `subscription.id` |
| `status` | ✅ | Subscription status | `subscription.status` |
| `tier` | ✅ | Subscription tier | Mapped from `subscription.product_id` |
| `max_workspaces` | ✅ | Workspace limit | From `getTierLimits(tier)` |
| `max_repos_per_workspace` | ✅ | Repository limit | From `getTierLimits(tier)` |
| `billing_cycle` | ✅ | Billing frequency | Mapped from `subscription.recurring_interval` |
| `current_period_start` | ✅ | Billing period start | `subscription.current_period_start` |
| `current_period_end` | ✅ | Billing period end | `subscription.current_period_end` |

## Tier Limits Reference

```typescript
function getTierLimits(tier: string) {
  const tierLimits = {
    pro: { max_workspaces: 1, max_repos_per_workspace: 3 },
    team: { max_workspaces: 3, max_repos_per_workspace: 3 },
    free: { max_workspaces: 0, max_repos_per_workspace: 0 },
  };
  return tierLimits[tier] || tierLimits.free;
}
```

## Debugging Procedures

### 1. Check Netlify Function Logs

```bash
netlify functions:log polar-webhook --tail
```

Look for:
- ❌ Error messages
- ⚠️ Warning messages about product ID mismatches
- ✅ Success messages with subscription details

### 2. Check Polar Webhook Deliveries

1. Go to Polar Dashboard → Settings → Webhooks
2. View "Recent Deliveries"
3. Check response status and body
4. Look for failed deliveries (non-200 responses)

### 3. Query Database

Check if subscription exists:

```sql
SELECT
  user_id,
  tier,
  status,
  max_workspaces,
  max_repos_per_workspace,
  polar_customer_id,
  polar_subscription_id,
  billing_cycle,
  created_at
FROM subscriptions
WHERE user_id = '<USER_ID>';
```

Check for incomplete subscriptions:

```sql
SELECT
  user_id,
  tier,
  status,
  max_workspaces,
  max_repos_per_workspace
FROM subscriptions
WHERE max_workspaces IS NULL
   OR max_repos_per_workspace IS NULL
   OR billing_cycle IS NULL;
```

### 4. Verify Environment Variables

In Netlify → Site Settings → Environment Variables:

- `POLAR_WEBHOOK_SECRET` - Webhook signature secret
- `POLAR_PRODUCT_ID_PRO` - Pro tier product ID
- `POLAR_PRODUCT_ID_TEAM` - Team tier product ID
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### 5. Test Webhook Locally

```bash
# Start local dev server
netlify dev

# In another terminal, trigger test webhook
curl -X POST http://localhost:8888/.netlify/functions/polar-webhook \
  -H "Content-Type: application/json" \
  -H "x-polar-signature: test" \
  -d @test-webhook-payload.json
```

## Common Issues and Solutions

### Issue: Subscription created with wrong tier

**Symptoms**:
- User pays for Team but gets free tier
- Logs show "Unknown product ID"

**Solution**:
1. Check product ID in Polar dashboard
2. Verify environment variable `POLAR_PRODUCT_ID_TEAM` matches
3. Update environment variable if needed
4. Manually fix subscription:
   ```sql
   UPDATE subscriptions
   SET tier = 'team',
       max_workspaces = 3,
       max_repos_per_workspace = 3
   WHERE polar_subscription_id = '<SUBSCRIPTION_ID>';
   ```

### Issue: Subscription created but workspace creation fails

**Symptoms**:
- Subscription exists in database
- User cannot create workspaces
- Status shows 'active' or 'trialing'

**Solution**:
1. Check subscription has all required fields:
   ```sql
   SELECT max_workspaces, max_repos_per_workspace
   FROM subscriptions
   WHERE user_id = '<USER_ID>';
   ```

2. If fields are NULL, update them:
   ```sql
   UPDATE subscriptions
   SET max_workspaces = 3,
       max_repos_per_workspace = 3
   WHERE user_id = '<USER_ID>'
     AND tier = 'team';
   ```

### Issue: Webhook signature verification fails

**Symptoms**:
- Logs show "signature verification failed"
- Webhook returns 400 error

**Solution**:
1. Verify `POLAR_WEBHOOK_SECRET` in Netlify matches Polar
2. Check webhook endpoint URL is correct in Polar dashboard
3. Ensure webhook payload is being sent correctly

### Issue: Database upsert fails silently

**Symptoms**:
- Polar shows successful webhook delivery
- No subscription in database
- No error in logs

**Solution**:
This should no longer happen after the fix, but to debug:
1. Check Supabase logs for errors
2. Verify RLS policies allow service role to insert
3. Check database constraints

## Monitoring Best Practices

### What to Monitor

1. **Webhook Errors**
   - Track failed webhooks in Polar dashboard
   - Set up alerts for webhook failures
   - Monitor Netlify function errors

2. **Product ID Mismatches**
   - Alert on "Unknown product ID" log messages
   - Monitor subscriptions created with 'free' tier after payment

3. **Incomplete Subscriptions**
   - Alert on subscriptions with NULL required fields
   - Monitor subscriptions with status 'trialing' for extended periods

4. **Database Errors**
   - Track database operation failures
   - Alert on upsert/update errors

### Recommended Alerts

1. **Critical**: Webhook signature verification failure
2. **Critical**: Database operation failure on subscription creation
3. **High**: Product ID mismatch detected
4. **Medium**: Subscription created with missing fields
5. **Low**: Subscription status stuck in 'trialing' > 30 days

## Testing Checklist

Before deploying webhook changes:

- [ ] Test successful subscription creation
- [ ] Test subscription creation with unknown product ID
- [ ] Test subscription creation with missing user_id
- [ ] Test subscription update with tier change
- [ ] Test database operation failure handling
- [ ] Test webhook signature verification
- [ ] Test all tier mappings (free, pro, team)
- [ ] Test all billing cycle mappings (month, year)
- [ ] Verify all required fields are set
- [ ] Check logs for proper error messages
- [ ] Test Polar retry behavior on errors

## Related Documentation

- [Polar Subscription Setup](./polar-subscription-setup.md)
- [Postmortem: Subscription Activation Failures](../postmortems/2025-10-23-subscription-activation-failures.md)
- [Workspace Service Architecture](../architecture/workspace-service.md)
- [Testing Guidelines](../testing/BULLETPROOF_TESTING_GUIDELINES.md)

## Support

If you encounter issues not covered by this guide:

1. Check the [postmortem document](../postmortems/2025-10-23-subscription-activation-failures.md)
2. Review Netlify function logs
3. Check Polar webhook delivery history
4. Query database for subscription state
5. Open GitHub issue with detailed logs
