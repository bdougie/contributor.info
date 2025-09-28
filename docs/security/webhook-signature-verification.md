# Webhook Signature Verification

## Overview

All webhook endpoints in the contributor.info platform verify signatures to ensure requests are authentic and haven't been tampered with. This prevents unauthorized access and protects against replay attacks.

## Inngest Webhook Security

### Configuration

The `inngest-hybrid` function verifies all incoming webhooks using HMAC-SHA256 signatures.

**Required Environment Variable:**
```bash
INNGEST_SIGNING_KEY=signkey_prod_xxxxxxxxxxxxx
```

### Signature Format

Inngest sends signatures in the `x-inngest-signature` header with format:
```
t=<timestamp> s=<signature>
```

- `timestamp`: Unix timestamp when signature was generated
- `signature`: HMAC-SHA256 hash of `timestamp.body`

### Verification Process

1. **Extract components** from signature header
2. **Check timestamp** is within 5-minute window (prevents replay attacks)
3. **Calculate expected signature** using HMAC-SHA256
4. **Compare signatures** using timing-safe comparison

### Security Features

- **Replay Protection**: Rejects signatures older than 5 minutes
- **Timing-Safe Comparison**: Prevents timing attacks
- **Body Integrity**: Any modification to request body invalidates signature
- **Development Mode**: Allows unsigned requests only in development

## GitHub Webhook Security

GitHub webhook handlers verify signatures using the same HMAC-SHA256 pattern.

**Required Environment Variable:**
```bash
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

### Signature Format

GitHub sends signatures in the `x-hub-signature-256` header:
```
sha256=<signature>
```

### Verification Process

```typescript
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

## Testing Webhook Signatures

### Generate Test Signature

```typescript
// Generate a valid test signature
const timestamp = Math.floor(Date.now() / 1000);
const body = JSON.stringify({ test: true });
const signedPayload = `${timestamp}.${body}`;

const signature = crypto
  .createHmac('sha256', SIGNING_KEY)
  .update(signedPayload)
  .digest('hex');

const header = `t=${timestamp} s=${signature}`;
```

### Test with cURL

```bash
# Set variables
TIMESTAMP=$(date +%s)
BODY='{"name":"test/event","data":{}}'
SIGNING_KEY="your-signing-key"

# Generate signature
SIGNED_PAYLOAD="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$SIGNED_PAYLOAD" | openssl dgst -sha256 -hmac "$SIGNING_KEY" | cut -d' ' -f2)

# Send request
curl -X POST https://contributor.info/.netlify/functions/inngest-hybrid \
  -H "Content-Type: application/json" \
  -H "x-inngest-signature: t=$TIMESTAMP s=$SIGNATURE" \
  -d "$BODY"
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized: Invalid signature**
   - Verify INNGEST_SIGNING_KEY is set correctly
   - Check signature header format
   - Ensure body hasn't been modified

2. **Signature timestamp too old**
   - Clock sync issues between servers
   - Request took too long to reach server
   - Replay of old webhook

3. **Invalid signature format**
   - Missing `t=` or `s=` prefix
   - Malformed header value
   - Wrong header name

### Debug Logging

Enable debug logging to troubleshoot signature issues:

```typescript
console.log('Signature header:', signature);
console.log('Body length:', body.length);
console.log('Timestamp age:', currentTime - signatureTime);
```

## Security Best Practices

1. **Never log signing keys** - Use environment variables
2. **Rotate keys regularly** - Update both Inngest and environment
3. **Monitor failed verifications** - Could indicate attack attempts
4. **Use HTTPS only** - Prevents man-in-the-middle attacks
5. **Keep timestamp window small** - 5 minutes maximum

## Environment Setup

### Local Development

```bash
# .env.local
INNGEST_SIGNING_KEY=signkey_test_xxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=test-secret
NODE_ENV=development
```

### Production

```bash
# Set in Netlify environment variables
INNGEST_SIGNING_KEY=signkey_prod_xxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=production-secret
NODE_ENV=production
```

## Monitoring

Track webhook signature verification failures:

```sql
-- Failed webhook verifications (from logs)
SELECT
  timestamp,
  function_name,
  error_message,
  ip_address
FROM function_logs
WHERE error_message LIKE '%Invalid signature%'
  OR error_message LIKE '%Unauthorized%'
ORDER BY timestamp DESC
LIMIT 100;
```

## References

- [Inngest Webhook Security](https://www.inngest.com/docs/reference/webhooks#security)
- [GitHub Webhook Security](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)
- [HMAC Best Practices](https://www.rfc-editor.org/rfc/rfc2104)
