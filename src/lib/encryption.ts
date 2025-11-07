/**
 * Encryption utilities for sensitive data
 * Uses Web Crypto API for secure encryption/decryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM

/**
 * Get the encryption key from environment
 * In production, this should be a secure, randomly generated key
 */
function getEncryptionKey(): string {
  const key = import.meta.env.VITE_SLACK_WEBHOOK_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('VITE_SLACK_WEBHOOK_ENCRYPTION_KEY is not configured');
  }
  return key;
}

/**
 * Convert a base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Derive a CryptoKey from the encryption key string
 */
async function deriveKey(keyString: string): Promise<CryptoKey> {
  // Use the key string as material for key derivation
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(keyString);

  // Import the key material
  const importedKey = await crypto.subtle.importKey('raw', keyMaterial, 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);

  // Derive the actual encryption key using PBKDF2
  const salt = encoder.encode('slack-webhook-salt'); // Fixed salt for consistency
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string with IV prepended
 */
export async function encryptString(plaintext: string): Promise<string> {
  try {
    const keyString = getEncryptionKey();
    const key = await deriveKey(keyString);

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encode the plaintext
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
      },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption error: %s', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string value
 * @param encryptedBase64 - Base64-encoded encrypted string with IV prepended
 * @returns Decrypted plaintext string
 */
export async function decryptString(encryptedBase64: string): Promise<string> {
  try {
    const keyString = getEncryptionKey();
    const key = await deriveKey(keyString);

    // Decode from base64
    const combined = base64ToArrayBuffer(encryptedBase64);

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv,
      },
      key,
      encrypted
    );

    // Decode the decrypted data
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error: %s', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    const key = import.meta.env.VITE_SLACK_WEBHOOK_ENCRYPTION_KEY;
    return !!key && key.length >= 32; // At least 32 characters for security
  } catch {
    return false;
  }
}
