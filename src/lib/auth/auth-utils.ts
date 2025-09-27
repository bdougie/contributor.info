/**
 * Authentication utility functions for handling redirect URLs
 * across different deployment contexts (local, preview, production)
 */

import { env } from '@/lib/env';

/**
 * Get the appropriate site URL based on the deployment context
 *
 * Priority order:
 * 1. Netlify DEPLOY_PRIME_URL (for deploy previews and branch deploys)
 * 2. Window location origin (for client-side)
 * 3. Fallback to production URL
 */
export function getSiteURL(): string {
  // Check if we're in a browser context
  if (typeof window !== 'undefined') {
    // In deploy preview or branch deploy context
    const deployPrimeUrl = env.DEPLOY_PRIME_URL;
    if (deployPrimeUrl) {
      // Ensure it has https:// protocol
      return deployPrimeUrl.startsWith('http') ? deployPrimeUrl : `https://${deployPrimeUrl}`;
    }

    // Check for Netlify URL (production URL)
    const netlifyUrl = env.URL;
    if (netlifyUrl) {
      return netlifyUrl.startsWith('http') ? netlifyUrl : `https://${netlifyUrl}`;
    }

    // Fallback to current window location
    return window.location.origin;
  }

  // Server-side: Use environment variables
  if (env.DEPLOY_PRIME_URL) {
    const url = env.DEPLOY_PRIME_URL;
    return url.startsWith('http') ? url : `https://${url}`;
  }

  if (env.URL) {
    const url = env.URL;
    return url.startsWith('http') ? url : `https://${url}`;
  }

  // Default to production URL
  return 'https://contributor.info';
}

/**
 * Get the OAuth redirect URL for Supabase auth
 * Preserves the current path for better UX
 */
export function getAuthRedirectURL(preservePath = true): string {
  const baseURL = getSiteURL();

  if (preservePath && typeof window !== 'undefined') {
    // Preserve the current path and query params
    const currentPath = window.location.pathname + window.location.search;
    return `${baseURL}${currentPath}`;
  }

  return baseURL;
}

/**
 * Get the deployment context (local, deploy-preview, branch-deploy, production)
 */
export function getDeploymentContext():
  | 'local'
  | 'deploy-preview'
  | 'branch-deploy'
  | 'production' {
  // Check if we're in local development
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'local';
    }
  }

  // Check Netlify context environment variable
  const context = env.CONTEXT;
  if (context === 'deploy-preview') {
    return 'deploy-preview';
  }
  if (context === 'branch-deploy') {
    return 'branch-deploy';
  }
  if (context === 'production') {
    return 'production';
  }

  // Fallback detection based on URL
  const siteURL = getSiteURL();
  if (siteURL.includes('localhost') || siteURL.includes('127.0.0.1')) {
    return 'local';
  }
  if (siteURL.includes('deploy-preview-')) {
    return 'deploy-preview';
  }
  if (siteURL.includes('--contributor-info.netlify.app')) {
    return 'branch-deploy';
  }

  return 'production';
}

/**
 * Check if we're in a deploy preview environment
 */
export function isDeployPreview(): boolean {
  return getDeploymentContext() === 'deploy-preview';
}

/**
 * Check if we're in local development
 */
export function isLocalDevelopment(): boolean {
  return getDeploymentContext() === 'local';
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return getDeploymentContext() === 'production';
}

/**
 * Validate that a redirect URL is allowed based on our patterns
 * This provides an extra security layer
 */
export function isValidRedirectURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    // Allow localhost for development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Allow Netlify preview and branch URLs
    if (hostname.endsWith('.netlify.app')) {
      return true;
    }

    // Allow production domain
    if (hostname === 'contributor.info' || hostname === 'www.contributor.info') {
      return true;
    }

    // Reject everything else
    return false;
  } catch {
    // Invalid URL
    return false;
  }
}
