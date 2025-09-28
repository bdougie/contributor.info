import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock the verification function for testing
function verifyInngestSignature(
  body: string,
  signature: string | null,
  signingKey: string
): boolean {
  if (!signingKey) {
    return false;
  }

  if (!signature) {
    return false;
  }

  try {
    // Inngest uses HMAC-SHA256 for webhook signatures
    // Format: "t=timestamp s=signature"
    const parts = signature.split(' ');
    const timestamp = parts.find((p) => p.startsWith('t='))?.substring(2);
    const sig = parts.find((p) => p.startsWith('s='))?.substring(2);

    if (!timestamp || !sig) {
      return false;
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    const currentTime = Math.floor(Date.now() / 1000);
    const signatureTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - signatureTime) > 300) {
      return false;
    }

    // Verify signature
    const signedPayload = `${timestamp}.${body}`;
    const expectedSig = crypto.createHmac('sha256', signingKey).update(signedPayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

describe('Inngest Webhook Signature Verification', () => {
  const SIGNING_KEY = 'signkey_test_1234567890';
  const VALID_BODY = JSON.stringify({
    name: 'test/event',
    data: { test: true },
    ts: Date.now(),
    id: 'test-id',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${VALID_BODY}`;
    const signature = crypto.createHmac('sha256', SIGNING_KEY).update(signedPayload).digest('hex');

    const signatureHeader = `t=${timestamp} s=${signature}`;

    const result = verifyInngestSignature(VALID_BODY, signatureHeader, SIGNING_KEY);
    expect(result).toBe(true);
  });

  it('should reject missing signature', () => {
    const result = verifyInngestSignature(VALID_BODY, null, SIGNING_KEY);
    expect(result).toBe(false);
  });

  it('should reject invalid signature format', () => {
    const result = verifyInngestSignature(VALID_BODY, 'invalid-format', SIGNING_KEY);
    expect(result).toBe(false);
  });

  it('should reject incorrect signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongSignature = 'incorrect-signature-hash';
    const signatureHeader = `t=${timestamp} s=${wrongSignature}`;

    const result = verifyInngestSignature(VALID_BODY, signatureHeader, SIGNING_KEY);
    expect(result).toBe(false);
  });

  it('should reject expired timestamp (older than 5 minutes)', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 301; // 301 seconds ago
    const signedPayload = `${oldTimestamp}.${VALID_BODY}`;
    const signature = crypto.createHmac('sha256', SIGNING_KEY).update(signedPayload).digest('hex');

    const signatureHeader = `t=${oldTimestamp} s=${signature}`;

    const result = verifyInngestSignature(VALID_BODY, signatureHeader, SIGNING_KEY);
    expect(result).toBe(false);
  });

  it('should reject future timestamp (more than 5 minutes ahead)', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 301; // 301 seconds in future
    const signedPayload = `${futureTimestamp}.${VALID_BODY}`;
    const signature = crypto.createHmac('sha256', SIGNING_KEY).update(signedPayload).digest('hex');

    const signatureHeader = `t=${futureTimestamp} s=${signature}`;

    const result = verifyInngestSignature(VALID_BODY, signatureHeader, SIGNING_KEY);
    expect(result).toBe(false);
  });

  it('should reject tampered body', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${VALID_BODY}`;
    const signature = crypto.createHmac('sha256', SIGNING_KEY).update(signedPayload).digest('hex');

    const signatureHeader = `t=${timestamp} s=${signature}`;

    const tamperedBody = JSON.stringify({
      name: 'malicious/event',
      data: { hacked: true },
    });

    const result = verifyInngestSignature(tamperedBody, signatureHeader, SIGNING_KEY);
    expect(result).toBe(false);
  });

  it('should handle missing signing key', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = `t=${timestamp} s=some-signature`;

    const result = verifyInngestSignature(VALID_BODY, signatureHeader, '');
    expect(result).toBe(false);
  });
});
