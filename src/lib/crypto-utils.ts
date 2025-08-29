/**
 * Cryptographically secure random number utilities
 * Uses Web Crypto API for secure random generation
 */

/**
 * Generates a cryptographically secure random number between 0 and 1
 * Similar to Math.random() but secure
 * @returns A random number between 0 and 1
 */
export function secureRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Convert to number between 0 and 1
  return array[0] / (0xffffffff + 1);
}

/**
 * Generates a secure random integer between min and max (inclusive)
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns A random integer between min and max
 */
export function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  return Math.floor(secureRandom() * range) + min;
}

/**
 * Securely shuffles an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns A new shuffled array
 */
export function secureShuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generates a secure random ID string
 * @param length - Length of the ID (default 16)
 * @returns A random alphanumeric string
 */
export function generateSecureId(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array)
    .map(byte => chars[byte % chars.length])
    .join('');
}

/**
 * Generates a secure UUID v4
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback to manual UUID v4 generation
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // Set version (4) and variant bits
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  
  const hex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Picks a random element from an array securely
 * @param array - Array to pick from
 * @returns A random element from the array
 */
export function secureRandomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  const index = secureRandomInt(0, array.length - 1);
  return array[index];
}

/**
 * Generates a secure random float between min and max
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns A random float between min and max
 */
export function secureRandomFloat(min: number, max: number): number {
  return secureRandom() * (max - min) + min;
}

/**
 * Determines if we're in a test/demo environment where Math.random is acceptable
 * @returns true if in test/demo mode
 */
export function isDemoMode(): boolean {
  // Check if we're in Storybook or demo pages
  if (typeof window !== 'undefined') {
    const url = window.location.href;
    return url.includes('storybook') || 
           url.includes('demo') || 
           url.includes('localhost:6006'); // Storybook default port
  }
  return false;
}

/**
 * Gets a random function based on the environment
 * Uses Math.random for demos/tests, crypto for production
 * @returns The appropriate random function
 */
export function getRandomFunction(): () => number {
  return isDemoMode() ? Math.random : secureRandom;
}

/**
 * Gets a random integer function based on the environment
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns A random integer
 */
export function getRandomInt(min: number, max: number): number {
  if (isDemoMode()) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  return secureRandomInt(min, max);
}