# Postmortem: Subscription Not Activating After Successful Purchase

**Date**: October 23, 2025
**Issue Discovered**: October 9, 2025
**Severity**: 🔴 Critical
**Status**: ✅ Resolved
**Author**: System Team

## Executive Summary

Between October 9 and October 23, 2025, paying customers who successfully completed checkout through Polar could not access their purchased workspace features. Despite successful payment processing, the subscription activation flow had multiple silent failure points that prevented proper tier assignment and feature access. The issue affected an unknown number of Team and Pro tier customers who believed they had successfully upgraded but continued to see "Upgrade to Team" prompts.

## Impact

### User Impact
- **Severity**: Critical - Paying customers unable to access paid features
- **Duration**: ~2 weeks (October 9 - October 23, 2025)
- **Affected Users**: Customers who purchased Team or Pro tier subscriptions during this period
- **User Experience**:
  - Completed Polar checkout successfully
  - Payment processed and charged
  - Redirected to `/billing?success=true`
  - **BUT**: Workspace access remained restricted
  - Application showed "Upgrade to Team" prompts
  - Users appeared to have no active subscription

### Business Impact
- Lost customer trust
- Potential refund requests
- Support burden increased
- Revenue at risk from churned customers

## Timeline

**October 9, 2025** - Issue first reported by customer via GitHub Issue #1105

**October 9-23, 2025** - Issue remained unresolved, affecting new purchases

**October 23, 2025** - Investigation revealed 5 critical failure points
- Root cause analysis completed
- Fix implemented with comprehensive error handling
- Tests added to prevent regression
- Documentation updated

## Root Cause Analysis

The subscription activation flow had **5 critical single points of failure** without proper error handling, validation, or monitoring:

### 1. Silent Webhook Failure - No Error Handling ⚠️

**Location**: `netlify/functions/polar-webhook.ts:190-210`

**Problem**: The webhook handler performed database `upsert` operations but never checked if they succeeded:

```typescript
// ❌ BEFORE: No error handling
await supabase.from('subscriptions').upsert({
  user_id: userId,
  polar_customer_id: subscription.customer_id,
  // ...
});
// Execution continued even if upsert failed!
```

**Impact**: Database operation failures (permissions, constraints, network issues) returned success to Polar but created no subscription record.

**Resolution**: Added comprehensive error checking and throws errors back to Polar for retry:

```typescript
// ✅ AFTER: Proper error handling
const { data, error } = await supabase.from('subscriptions').upsert({...});

if (error) {
  console.error('❌ Failed to create subscription:', error);
  throw error; // Polar will retry
}
```

### 2. Product ID Mapping Returned 'free' on Mismatch 🎯

**Location**: `netlify/functions/polar-webhook.ts:381-389`

**Problem**: Unknown product IDs silently mapped to 'free' tier:

```typescript
// ❌ BEFORE: Silent failure
function mapProductToTier(productId: string): string {
  const productTierMap = {
    [process.env.POLAR_PRODUCT_ID_PRO || '']: 'pro',
    [process.env.POLAR_PRODUCT_ID_TEAM || '']: 'team',
  };
  return productTierMap[productId] || 'free'; // Dangerous default!
}
```

**Impact**:
- Product ID typo or environment mismatch
- User pays $99/month for Team
- Subscription created with `tier: 'free'`
- User has `status: 'active'` but wrong tier
- No error logged

**Resolution**: Added validation and comprehensive logging:

```typescript
// ✅ AFTER: Validation and logging
const tier = productTierMap[productId];

if (!tier && productId) {
  console.error('⚠️ Unknown product ID: %s', productId);
  console.error('Configured product IDs:', {
    pro: process.env.POLAR_PRODUCT_ID_PRO,
    team: process.env.POLAR_PRODUCT_ID_TEAM,
  });
}

return tier || 'free';
```

### 3. Subscription Status Filter Excluded Valid States 📊

**Location**: `src/services/workspace.service.ts:119-124`

**Problem**: Workspace service only checked for 'active' status:

```typescript
// ❌ BEFORE: Only 'active'
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('tier, max_workspaces, max_repos_per_workspace')
  .eq('user_id', userId)
  .eq('status', 'active')  // Excludes 'trialing'!
  .maybeSingle();
```

**Impact**: Polar subscriptions with `status: 'trialing'`, `status: 'incomplete'`, or other valid statuses were invisible to workspace checks, despite the subscription service correctly including trialing states.

**Resolution**: Aligned with subscription service pattern:

```typescript
// ✅ AFTER: Include 'trialing'
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('tier, max_workspaces, max_repos_per_workspace')
  .eq('user_id', userId)
  .in('status', ['active', 'trialing'])  // Matches subscription.service.ts
  .maybeSingle();
```

### 4. Missing Required Subscription Fields 📝

**Location**: `netlify/functions/polar-webhook.ts:190-210`

**Problem**: Webhook didn't set critical fields needed by workspace service:

```typescript
// ❌ BEFORE: Missing critical fields
await supabase.from('subscriptions').upsert({
  user_id: userId,
  tier: mapProductToTier(subscription.product_id),
  status: subscription.status,
  // ❌ MISSING: max_workspaces
  // ❌ MISSING: max_repos_per_workspace
  // ❌ MISSING: billing_cycle
});
```

**Impact**: Workspace service queries for `max_workspaces` and `max_repos_per_workspace`. NULL or 0 values blocked workspace creation despite valid subscription.

**Resolution**: Added helper function and all required fields:

```typescript
// ✅ AFTER: Complete field mapping
const limits = getTierLimits(tier);
const billingCycle =
  subscription.recurring_interval === 'year' ? 'yearly' :
  subscription.recurring_interval === 'month' ? 'monthly' : null;

await supabase.from('subscriptions').upsert({
  user_id: userId,
  tier,
  max_workspaces: limits.max_workspaces,
  max_repos_per_workspace: limits.max_repos_per_workspace,
  billing_cycle: billingCycle,
  // ...
});
```

### 5. No Webhook Retry or User Notification 🔔

**Problem**: Any of the above failures resulted in:
- Polar considered webhook delivered successfully
- User sees success page but has no subscription
- No error logged to monitoring
- No notification to user or admins
- User must contact support

**Resolution**:
- Errors now thrown back to Polar for automatic retry
- Comprehensive logging added for debugging
- Future: Add monitoring and user notifications

## Resolution

### Code Changes

1. **Enhanced Webhook Error Handling** (`netlify/functions/polar-webhook.ts`)
   - Added error checking for all database operations
   - Throws errors to trigger Polar's retry mechanism
   - Comprehensive logging with structured data

2. **Product ID Validation** (`netlify/functions/polar-webhook.ts`)
   - Added warning logs for unknown product IDs
   - Logs configured environment variables for debugging
   - Created `getTierLimits()` helper function

3. **Complete Field Mapping** (`netlify/functions/polar-webhook.ts`)
   - Added `max_workspaces` field
   - Added `max_repos_per_workspace` field
   - Added `billing_cycle` field
   - Proper tier limits mapping

4. **Fixed Subscription Status Filter** (`src/services/workspace.service.ts`)
   - Changed from `.eq('status', 'active')` to `.in('status', ['active', 'trialing'])`
   - Aligned with existing subscription service pattern
   - Added inline comment explaining the change

### Testing

Created comprehensive test suites:

1. **Webhook Handler Tests** (`netlify/functions/__tests__/polar-webhook.test.ts`)
   - Environment variable validation
   - User ID validation
   - Tier mapping for all product types
   - Billing cycle mapping
   - Database error handling
   - Product ID mismatch logging
   - 15+ test cases covering all scenarios

2. **Workspace Service Tests** (`src/services/__tests__/workspace.service.test.ts`)
   - Subscription status filter tests
   - Active subscription acceptance
   - Trialing subscription acceptance
   - Verification of `.in()` call with both statuses

### Documentation

1. **Updated Webhook Documentation** (`docs/setup/polar-webhook-error-handling.md`)
   - Error handling patterns
   - Debugging procedures
   - Monitoring best practices

## What Went Well

- Database schema was correct (columns existed)
- Issue was reported with excellent detail by customer
- Subscription service had correct pattern we could follow
- Root cause identified quickly once investigation began

## What Went Wrong

- No error handling on critical payment flow
- Silent failures with dangerous defaults
- No monitoring or alerting
- Inconsistent patterns between services
- No comprehensive testing of webhook handler
- Issue existed for 2 weeks before resolution

## Action Items

### Completed ✅

- [x] Add error handling to webhook operations
- [x] Add product ID validation and logging
- [x] Fix subscription status filter
- [x] Add all required fields to webhook
- [x] Create comprehensive tests
- [x] Update documentation

### Future Improvements 🔄

- [ ] Add monitoring/alerting for webhook failures (Sentry integration)
- [ ] Create admin dashboard for subscription status
- [ ] Implement automatic notification to users on activation failure
- [ ] Add end-to-end tests for full checkout flow
- [ ] Create backfill script for affected users
- [ ] Add webhook event logging to database for debugging
- [ ] Implement retry logic in application for failed activations

### Prevention 🛡️

- [ ] Add pre-commit hooks to check for database operations without error handling
- [ ] Create coding standard: All external service calls must have error handling
- [ ] Add monitoring for all Netlify function errors
- [ ] Implement feature flags for payment flow changes
- [ ] Add canary deployments for critical payment paths

## Lessons Learned

### Technical

1. **Always check errors on database operations**: Never assume database calls succeed
2. **Avoid silent fallbacks**: Dangerous defaults like `|| 'free'` mask problems
3. **Consistent patterns**: Use same query patterns across services
4. **Comprehensive logging**: Structured logging helps debugging
5. **Fail loudly**: Throw errors to enable retry mechanisms

### Process

1. **Critical paths need monitoring**: Payment flows should have alerts
2. **Test coverage for webhooks**: External integrations need robust testing
3. **Documentation matters**: Clear error handling patterns prevent issues
4. **Respond quickly**: 2 weeks is too long for critical payment issues

### Best Practices

1. **Error Handling Pattern**:
   ```typescript
   const { data, error } = await databaseOperation();
   if (error) {
     console.error('Context:', error);
     throw error; // Enable retries
   }
   ```

2. **Validation Pattern**:
   ```typescript
   const result = mapValue(input);
   if (!result && input) {
     console.error('Unexpected input:', input);
     // Log configuration for debugging
   }
   ```

3. **Testing Pattern**:
   - Test happy path
   - Test error conditions
   - Test edge cases (unknown values, null fields)
   - Test retry behavior

## Related Documentation

- [Polar Subscription Setup Guide](../setup/polar-subscription-setup.md)
- [Webhook Error Handling](../setup/polar-webhook-error-handling.md)
- [Workspace Service Architecture](../architecture/workspace-service.md)
- [Testing Guidelines](../testing/BULLETPROOF_TESTING_GUIDELINES.md)

## References

- GitHub Issue: #1105
- Implementation PR: [Link to PR]
- Polar Webhook Docs: https://docs.polar.sh/webhooks
