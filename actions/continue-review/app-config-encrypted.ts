import * as crypto from 'crypto';
import * as core from '@actions/core';

/**
 * Encrypted Continue Agent App credentials
 * These are encrypted with a passphrase that's publicly known
 * but prevents the credentials from being easily scraped
 */

// This would be replaced with actual encrypted values during build
const ENCRYPTED_CONFIG = {
  appId: '', // Encrypted App ID will go here
  privateKey: '', // Encrypted private key will go here
};

// Simple decryption passphrase (not for security, just for obfuscation)
const PASSPHRASE = 'continue-review-action-2024';

/**
 * Decrypt a value using AES-256
 */
function decrypt(encrypted: string): string {
  if (!encrypted) return '';
  
  try {
    const [iv, authTag, data] = encrypted.split(':');
    const key = crypto.scryptSync(PASSPHRASE, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    core.debug(`Failed to decrypt: ${error}`);
    return '';
  }
}

/**
 * Get decrypted App configuration
 */
export function getEmbeddedAppConfig(): { appId: number; privateKey: string } | null {
  const appId = decrypt(ENCRYPTED_CONFIG.appId);
  const privateKey = decrypt(ENCRYPTED_CONFIG.privateKey);
  
  if (appId && privateKey) {
    core.info('Using embedded Continue Agent App credentials');
    return {
      appId: parseInt(appId, 10),
      privateKey,
    };
  }
  
  return null;
}

/**
 * Encrypt values for storage (used during build)
 */
export function encryptForStorage(value: string): string {
  const key = crypto.scryptSync(PASSPHRASE, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}