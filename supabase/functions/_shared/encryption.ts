/**
 * Shared Encryption Utilities for Supabase Edge Functions
 *
 * Provides centralized encryption/decryption using Web Crypto API.
 * Used for encrypting sensitive data like Slack bot tokens.
 *
 * Security:
 * - AES-GCM 256-bit encryption
 * - PBKDF2 key derivation with 100,000 iterations
 * - Random IV for each encryption
 * - Base64 encoding for storage
 */

const ENCRYPTION_KEY = Deno.env.get('SLACK_WEBHOOK_ENCRYPTION_KEY');

if (!ENCRYPTION_KEY) {
  throw new Error(
    'Missing required environment variable: SLACK_WEBHOOK_ENCRYPTION_KEY. ' +
      'This variable is required for encrypting/decrypting Slack bot tokens.',
  );
}

// Shared salt for consistent key derivation across all edge functions
const SALT = 'slack-webhook-salt';
const ITERATIONS = 100000;

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(usage: KeyUsage[]): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(ENCRYPTION_KEY);

  // Import the key material
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  // Derive the actual encryption/decryption key
  const salt = encoder.encode(SALT);
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

/**
 * Encrypt a string using AES-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted data (IV + ciphertext)
 *
 * @example
 * const encrypted = await encryptString("my-secret-token");
 * // Store encrypted in database
 */
export async function encryptString(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await deriveKey(['encrypt']);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const data = encoder.encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string using AES-GCM
 *
 * @param encrypted - Base64-encoded encrypted data (IV + ciphertext)
 * @returns Decrypted plaintext string
 *
 * @example
 * const plaintext = await decryptString(encryptedToken);
 * // Use plaintext token
 */
export async function decryptString(encrypted: string): Promise<string> {
  const key = await deriveKey(['decrypt']);

  // Decode from base64
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  return new TextDecoder().decode(decrypted);
}
