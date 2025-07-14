/**
 * GitHub App Configuration
 * 
 * This file contains the configuration for the Contributor Insights GitHub App.
 * Use these values when creating the app at: https://github.com/settings/apps/new
 */

export const APP_CONFIG = {
  name: 'contributor.info',
  description: 'Get intelligent PR insights with contributor profiles, reviewer suggestions, and related issues.',
  url: 'https://contributor.info',
  webhook_url: 'https://contributor.info/api/github/webhook',
  
  // Webhook events to subscribe to
  webhook_events: [
    'installation',
    'installation_repositories',
    'pull_request',
    'pull_request_review',
    'pull_request_review_comment',
    'issues',
    'issue_comment',
    'push',
    'repository',
    'star',
  ],
  
  // Permissions required
  permissions: {
    // Repository permissions
    actions: 'read',
    contents: 'read',
    issues: 'read',
    metadata: 'read',
    pull_requests: 'write', // Need write to comment
    
    // Organization permissions
    members: 'read',
    
    // User permissions
    email: 'read',
  },
  
  // Where the app can be installed
  installation_targets: ['users', 'organizations'],
  
  // Default settings
  default_settings: {
    enabled: true,
    comment_on_prs: true,
    include_issue_context: true,
    max_reviewers_suggested: 3,
    max_issues_shown: 5,
    comment_style: 'detailed', // 'minimal', 'detailed', 'comprehensive'
  },
};

/**
 * Environment configuration
 */
/**
 * Get private key from various sources
 */
function getPrivateKey(): string {
  // Try split key parts first
  if (process.env.GITHUB_PEM_PART1) {
    const keyParts = [
      process.env.GITHUB_PEM_PART1,
      process.env.GITHUB_PEM_PART2,
      process.env.GITHUB_PEM_PART3,
      process.env.GITHUB_PEM_PART4,
      process.env.GITHUB_PEM_PART5
    ].filter(Boolean);
    
    // Join parts and decode from base64
    const base64Key = keyParts.join('');
    return Buffer.from(base64Key, 'base64').toString();
  }
  
  // Try encoded format
  if (process.env.GITHUB_APP_PRIVATE_KEY_ENCODED) {
    return Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_ENCODED, 'base64').toString();
  }
  
  // Try regular base64 format
  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    return Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY, 'base64').toString();
  }
  
  return '';
}

export const ENV_CONFIG = {
  app_id: process.env.GITHUB_APP_ID || '',
  private_key: getPrivateKey(),
  webhook_secret: process.env.GITHUB_APP_WEBHOOK_SECRET || '',
  client_id: process.env.GITHUB_APP_CLIENT_ID || '',
  client_secret: process.env.GITHUB_APP_CLIENT_SECRET || '',
};

/**
 * Feature flags
 */
export const FEATURES = {
  issue_similarity: true,
  reviewer_workload: true,
  cross_repo_insights: false, // Premium feature
  private_repos: false, // Premium feature
  slack_integration: false, // Premium feature
  custom_rules: false, // Enterprise feature
};

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  webhook_processing: {
    max_concurrent: 100,
    timeout_ms: 30000,
  },
  comment_posting: {
    per_repo_per_hour: 100,
    per_installation_per_hour: 1000,
  },
  api_calls: {
    burst_limit: 100,
    sustained_per_hour: 5000, // GitHub App limit
  },
};