/**
 * Centralized authentication configuration
 *
 * This file defines the GitHub OAuth scopes used throughout the application.
 * All auth-related components should import these constants to ensure consistency.
 */

/**
 * Standard GitHub OAuth scopes for public repository access
 * - public_repo: Access to public repositories
 * - read:user: Read user profile information
 * - user:email: Access to user email addresses
 */
export const GITHUB_OAUTH_SCOPES = 'public_repo read:user user:email';

/**
 * Debug/development scopes with broader permissions
 * Used only in debug authentication flows
 * - repo: Full repository access (includes private repos)
 * - user: Full user access
 */
export const GITHUB_OAUTH_SCOPES_DEBUG = 'repo user';
