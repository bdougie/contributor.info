# Security Review: Untrusted Metadata Usage

**Issue:** Cubic Dev AI Review #3370478714
**Severity:** HIGH - Potential IDOR/Broken Access Control
**Location:** `netlify/functions/polar-webhook.ts:192`
**Status:** ⚠️ NEEDS DISCUSSION

---

## Problem Statement

The Polar webhook handler uses `user_id` from external metadata (Polar webhook payload) to:
1. Identify internal users in our database
2. Perform privileged operations (update subscriptions, create addon records)
3. Trigger workspace backfill jobs

**Risk:** If Polar's webhook authentication is compromised or metadata can be manipulated, an attacker could:
- Link Polar subscriptions to arbitrary users
- Trigger backfill operations for other users' workspaces
- Access/modify subscription data they don't own (IDOR vulnerability)

---

## Current Implementation

```typescript
// netlify/functions/polar-webhook.ts
onSubscriptionUpdated: async (subscription) => {
  // Get user ID from subscription metadata
  const userId = subscription.metadata?.user_id as string;
  if (userId) {
    // Use untrusted userId to query our database
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('polar_subscription_id', subscription.id)
      .maybeSingle();

    // Create addon record and trigger backfill for this user
    await triggerWorkspaceBackfill(userId, sub.id, ...);
  }
}
```

---

## Security Considerations

### ✅ Existing Protections

1. **Webhook Signature Verification**
   - Polar SDK verifies webhook signatures via `webhookSecret`
   - Prevents external parties from sending fake webhooks
   - See: `netlify/functions/polar-webhook.ts:123-136`

2. **Polar Subscription ID Validation**
   - We query `subscriptions` table using `polar_subscription_id`
   - Only creates addon if subscription already exists in our DB
   - Links addons to existing subscription records, not arbitrary users

3. **RLS Policies**
   - Database-level access control on all tables
   - Users can only access their own workspace data
   - Prevents cross-user data access even if user_id is wrong

### ⚠️ Remaining Risks

1. **Account Linkage Confusion**
   - If Polar metadata contains wrong `user_id`, addon could be linked to wrong account
   - User A buys addon → metadata has User B's ID → User B gets the addon

2. **Metadata Injection (Low Risk)**
   - If Polar's system is compromised, attacker could control metadata
   - However, requires compromise of Polar's infrastructure first

3. **Replay/Race Conditions**
   - Duplicate webhooks could create multiple addon records
   - **Mitigation:** Added idempotency check in commit c1a5bea2

---

## Recommended Solutions

### Option 1: Session-Based Verification (RECOMMENDED)

Store a pending subscription UUID during checkout, verify against webhook:

```typescript
// During checkout (user-initiated)
const pendingToken = crypto.randomUUID();
await supabase.from('pending_subscriptions').insert({
  token: pendingToken,
  user_id: currentUser.id,
  created_at: new Date(),
  expires_at: new Date(Date.now() + 3600000), // 1 hour
});

// Pass token to Polar metadata
const checkoutUrl = await polar.createCheckout({
  metadata: {
    verification_token: pendingToken,
  }
});

// In webhook handler
onSubscriptionCreated: async (subscription) => {
  const token = subscription.metadata?.verification_token;

  // Verify token and get trusted user_id
  const { data: pending } = await supabase
    .from('pending_subscriptions')
    .select('user_id')
    .eq('token', token)
    .single();

  if (!pending) {
    console.error('Invalid verification token');
    return;
  }

  // Now we have a trusted user_id from our own database
  const trustedUserId = pending.user_id;
  // ... create subscription for trustedUserId
}
```

**Pros:**
- User ID comes from our own database, not external metadata
- Time-limited tokens prevent replay attacks
- Clear audit trail of who initiated each subscription

**Cons:**
- Requires schema changes and migration
- Need to handle token expiration and cleanup
- More complex checkout flow

---

### Option 2: OAuth-Style Verification

Use Polar's customer ID as the source of truth:

```typescript
// During user registration/login
// Store Polar customer ID in our database
await supabase.from('users').update({
  polar_customer_id: customer.id
}).eq('id', user.id);

// In webhook handler
onSubscriptionCreated: async (subscription) => {
  // Trust Polar's customer ID, not metadata
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('polar_customer_id', subscription.customer_id)
    .single();

  if (!user) {
    console.error('No user found for Polar customer');
    return;
  }

  // User ID comes from our own database lookup
  const trustedUserId = user.id;
  // ... create subscription for trustedUserId
}
```

**Pros:**
- Simpler than token-based approach
- No time expiration concerns
- Polar customer ID is immutable and verifiable

**Cons:**
- Requires storing Polar customer ID in user table
- Need migration to add column
- Must ensure customer ID is set during onboarding

---

### Option 3: Accept Current Risk (NOT RECOMMENDED)

Keep current implementation but document the trust boundary:

**Rationale:**
- Webhook signatures prevent external attacks
- RLS policies prevent privilege escalation
- Risk requires compromising Polar's infrastructure first
- Metadata is set by us during checkout, not user-modifiable

**Additional Mitigations:**
- Add monitoring for subscription anomalies
- Implement rate limiting per user
- Log all subscription operations for audit

**Why Not Recommended:**
- Defense in depth principle: don't rely solely on third-party security
- Metadata can be accidentally misconfigured during checkout
- No protection against insider threats or Polar breaches

---

## Action Items

### Immediate (This PR)
- [x] Document security concern in this file
- [x] Add webhook signature verification (already exists)
- [x] Add idempotency checks (completed in c1a5bea2)
- [x] Ensure RLS policies are comprehensive (verified)

### Next PR (Recommended)
- [ ] Implement Option 1 (Session-Based Verification)
- [ ] Add `pending_subscriptions` table
- [ ] Create migration for verification tokens
- [ ] Update checkout flow to generate tokens
- [ ] Update webhook handler to verify tokens
- [ ] Add token cleanup job for expired tokens

### Future Considerations
- [ ] Add subscription operation logging/audit trail
- [ ] Implement rate limiting on subscription operations
- [ ] Add monitoring alerts for subscription anomalies
- [ ] Consider webhook replay detection

---

## Testing Plan

Once implemented, test:
1. Normal checkout flow with valid token
2. Expired token handling
3. Invalid/missing token handling
4. Duplicate webhook delivery (idempotency)
5. Race condition between checkout and webhook
6. Token cleanup job execution

---

## References

- [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [Polar Webhooks Documentation](https://docs.polar.sh/api/webhooks)
- Cubic Dev AI Review: #3370478714
