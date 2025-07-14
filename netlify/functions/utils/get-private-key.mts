import { getStore } from '@netlify/blobs';

/**
 * Get private key from various sources
 * Priority: Netlify Blobs > Split env vars > Single env var
 */
export async function getPrivateKey(): Promise<string | undefined> {
  try {
    // Try Netlify Blobs first (recommended for large keys)
    const store = getStore('github-app');
    const privateKeyFromBlob = await store.get('private-key', { type: 'text' });
    
    if (privateKeyFromBlob) {
      console.log('Using private key from Netlify Blobs');
      return privateKeyFromBlob;
    }
  } catch (error) {
    console.log('Netlify Blobs not available or key not found, trying env vars');
  }
  
  // Try split key parts
  if (process.env.GITHUB_PEM_PART1) {
    const keyParts = [
      process.env.GITHUB_PEM_PART1,
      process.env.GITHUB_PEM_PART2,
      process.env.GITHUB_PEM_PART3,
      process.env.GITHUB_PEM_PART4,
      process.env.GITHUB_PEM_PART5
    ].filter(Boolean);
    
    if (keyParts.length > 0) {
      console.log(`Using private key from ${keyParts.length} split parts`);
      return keyParts.join('').replace(/\\n/g, '\n');
    }
  }
  
  // Try encoded format
  if (process.env.GITHUB_APP_PRIVATE_KEY_ENCODED) {
    console.log('Using private key from GITHUB_APP_PRIVATE_KEY_ENCODED');
    return process.env.GITHUB_APP_PRIVATE_KEY_ENCODED.replace(/\\n/g, '\n');
  }
  
  // Try regular format
  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    console.log('Using private key from GITHUB_APP_PRIVATE_KEY');
    return process.env.GITHUB_APP_PRIVATE_KEY;
  }
  
  console.error('No private key found in any source');
  return undefined;
}

/**
 * Check if private key is available from any source
 */
export async function hasPrivateKey(): Promise<{
  hasBlob: boolean;
  hasSplitKey: boolean;
  splitKeyParts: number;
  hasEncodedKey: boolean;
  hasRegularKey: boolean;
}> {
  let hasBlob = false;
  
  try {
    const store = getStore('github-app');
    const key = await store.get('private-key', { type: 'text' });
    hasBlob = !!key;
  } catch (error) {
    // Blobs not available
  }
  
  const splitKeyParts = [
    process.env.GITHUB_PEM_PART1,
    process.env.GITHUB_PEM_PART2,
    process.env.GITHUB_PEM_PART3,
    process.env.GITHUB_PEM_PART4,
    process.env.GITHUB_PEM_PART5
  ].filter(Boolean).length;
  
  return {
    hasBlob,
    hasSplitKey: splitKeyParts > 0,
    splitKeyParts,
    hasEncodedKey: !!process.env.GITHUB_APP_PRIVATE_KEY_ENCODED,
    hasRegularKey: !!process.env.GITHUB_APP_PRIVATE_KEY
  };
}