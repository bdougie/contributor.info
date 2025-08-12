/**
 * Input validation and sanitization utilities
 * Provides security validation for webhook payloads
 */

/**
 * Validate and sanitize repository name
 */
export function validateRepositoryName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    throw new Error('Invalid repository name: must be a non-empty string');
  }
  
  // Repository names should be in format owner/repo
  const pattern = /^[a-zA-Z0-9][\w.-]*\/[a-zA-Z0-9][\w.-]*$/;
  if (!pattern.test(fullName)) {
    throw new Error(`Invalid repository name format: ${fullName}`);
  }
  
  // Prevent excessively long names
  if (fullName.length > 100) {
    throw new Error('Repository name too long');
  }
  
  return fullName;
}

/**
 * Validate GitHub user/org name
 */
export function validateGitHubUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username: must be a non-empty string');
  }
  
  // GitHub username rules: alphanumeric, hyphens (not at start/end), max 39 chars
  const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  if (!pattern.test(username)) {
    throw new Error(`Invalid GitHub username: ${username}`);
  }
  
  return username;
}

/**
 * Validate PR/Issue number
 */
export function validateIssueNumber(number) {
  const num = parseInt(number, 10);
  if (isNaN(num) || num < 1 || num > 999999) {
    throw new Error(`Invalid issue/PR number: ${number}`);
  }
  return num;
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload, eventType) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }
  
  // Check required fields based on event type
  switch (eventType) {
    case 'pull_request':
      if (!payload.pull_request || !payload.repository || !payload.action) {
        throw new Error('Missing required fields for pull_request event');
      }
      validateIssueNumber(payload.pull_request.number);
      validateRepositoryName(payload.repository.full_name);
      break;
      
    case 'issues':
      if (!payload.issue || !payload.repository || !payload.action) {
        throw new Error('Missing required fields for issues event');
      }
      validateIssueNumber(payload.issue.number);
      validateRepositoryName(payload.repository.full_name);
      break;
      
    case 'issue_comment':
      if (!payload.comment || !payload.issue || !payload.repository) {
        throw new Error('Missing required fields for issue_comment event');
      }
      validateIssueNumber(payload.issue.number);
      validateRepositoryName(payload.repository.full_name);
      break;
      
    case 'installation':
      if (!payload.installation || !payload.action) {
        throw new Error('Missing required fields for installation event');
      }
      break;
      
    case 'ping':
      // Ping events have minimal requirements
      break;
      
    default:
      // Unknown event types are allowed but logged
      break;
  }
  
  return true;
}

/**
 * Sanitize text content for database storage
 */
export function sanitizeText(text, maxLength = 65535) {
  if (!text) return null;
  if (typeof text !== 'string') return null;
  
  // Truncate to max length
  let sanitized = text.substring(0, maxLength);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Validate GitHub installation ID
 */
export function validateInstallationId(id) {
  const installId = parseInt(id, 10);
  if (isNaN(installId) || installId < 1) {
    throw new Error(`Invalid installation ID: ${id}`);
  }
  return installId;
}

/**
 * Create safe error response
 */
export function createSafeError(error, context) {
  // Never expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    error: isProduction ? 'An error occurred processing the webhook' : error.message,
    context: context,
    timestamp: new Date().toISOString()
  };
}