# GitHub App Documentation

This directory contains documentation for GitHub App integration, configuration, and features in contributor.info.

## Purpose

GitHub App documentation helps developers:
- **Integrate with GitHub** - Deep integration via GitHub App APIs
- **Manage permissions** - Understanding GitHub App permission model
- **Handle webhooks** - Process GitHub events and notifications
- **Troubleshoot issues** - Debug GitHub App integration problems

## Documentation Index

### 🔧 Setup & Configuration
- **[CODEOWNERS Setup](./codeowners-setup.md)** - Code ownership and review assignment configuration
- **[Issue Context Command](./issue-context-command.md)** - Automated issue context generation

## GitHub App Integration Overview

### Authentication & Authorization

#### GitHub App vs Personal Access Token
```typescript
// GitHub App authentication (preferred)
const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET
  }
});

// Installation-specific authentication
const octokit = await app.getInstallationOctokit(installationId);

// Personal Access Token (fallback)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});
```

#### Permission Scopes
```json
{
  "permissions": {
    "contents": "read",
    "metadata": "read", 
    "pull_requests": "read",
    "issues": "read",
    "repository_hooks": "read",
    "members": "read"
  },
  "events": [
    "push",
    "pull_request",
    "issues",
    "installation",
    "installation_repositories"
  ]
}
```

### Webhook Event Handling

#### Webhook Setup
```typescript
import { Webhooks } from '@octokit/webhooks';

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET
});

// Handle pull request events
webhooks.on('pull_request.opened', async ({ payload }) => {
  console.log('New PR opened:', payload.pull_request.title);
  
  // Process contributor data
  await processContributorData({
    repository: payload.repository.full_name,
    contributor: payload.pull_request.user.login,
    action: 'pull_request_opened'
  });
});

// Handle installation events
webhooks.on('installation.created', async ({ payload }) => {
  console.log('App installed on:', payload.installation.account.login);
  
  // Initialize repository tracking
  await initializeRepositoryTracking(payload.installation);
});
```

#### Event Processing Pipeline
```typescript
const processWebhookEvent = async (event: WebhookEvent) => {
  try {
    // 1. Validate webhook signature
    const isValid = await webhooks.verify(event.payload, event.signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }
    
    // 2. Parse event data
    const eventData = parseEventData(event);
    
    // 3. Queue for background processing
    await queueBackgroundJob({
      type: 'github_event',
      data: eventData,
      priority: getEventPriority(event.name)
    });
    
    // 4. Send immediate acknowledgment
    return { status: 'received' };
    
  } catch (error) {
    console.error('Webhook processing failed:', error);
    
    // Log error but don't fail webhook delivery
    await logWebhookError(event, error);
    return { status: 'error', message: error.message };
  }
};
```

## GitHub App Features

### 1. Automated Code Review Assignment

#### CODEOWNERS Integration
```typescript
const assignCodeReviewers = async (pullRequest: PullRequest) => {
  // Parse CODEOWNERS file
  const codeowners = await parseCodeowners(pullRequest.repository);
  
  // Find matching patterns for changed files
  const changedFiles = await getChangedFiles(pullRequest);
  const reviewers = findCodeOwners(changedFiles, codeowners);
  
  // Assign reviewers based on expertise
  const assignments = await calculateReviewerAssignments({
    reviewers,
    pullRequest,
    workloadBalance: true,
    expertiseMatch: true
  });
  
  // Request reviews via GitHub API
  await requestReviews(pullRequest, assignments);
};
```

### 2. Issue Context Generation

#### Automated Issue Analysis
```typescript
const generateIssueContext = async (issue: Issue) => {
  // Analyze issue content
  const analysis = await analyzeIssueContent(issue);
  
  // Find related code and contributors
  const context = await gatherIssueContext({
    repository: issue.repository,
    keywords: analysis.keywords,
    labels: issue.labels
  });
  
  // Generate helpful comment
  const comment = await generateContextComment({
    issue,
    analysis,
    context,
    suggestions: await getSuggestedActions(analysis)
  });
  
  // Post comment to issue
  await postIssueComment(issue, comment);
};
```

### 3. Repository Health Monitoring

#### Health Metrics Collection
```typescript
const collectRepositoryHealth = async (repository: Repository) => {
  const health = {
    // Code quality metrics
    codeQuality: await analyzeCodeQuality(repository),
    
    // Contribution metrics
    contributions: await analyzeContributions(repository),
    
    // Community health
    community: await analyzeCommunityHealth(repository),
    
    // Security status
    security: await analyzeSecurityStatus(repository)
  };
  
  // Store health data
  await storeRepositoryHealth(repository.id, health);
  
  // Trigger alerts if needed
  await checkHealthAlerts(repository, health);
  
  return health;
};
```

## Integration Patterns

### Repository Discovery
```typescript
const discoverRepositories = async (installation: Installation) => {
  // Get installation repositories
  const repos = await app.getInstallationOctokit(installation.id)
    .rest.apps.listReposAccessibleToInstallation();
  
  // Process each repository
  for (const repo of repos.data.repositories) {
    await processRepository({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner.login,
      installation_id: installation.id
    });
  }
};
```

### Rate Limit Management
```typescript
const rateLimitedRequest = async (request: () => Promise<any>) => {
  const rateLimit = await octokit.rest.rateLimit.get();
  
  if (rateLimit.data.rate.remaining < 100) {
    const resetTime = rateLimit.data.rate.reset * 1000;
    const waitTime = resetTime - Date.now();
    
    console.log(`Rate limit low, waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  return await request();
};
```

### Error Handling & Retry Logic
```typescript
const githubApiCall = async (apiCall: () => Promise<any>, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 403 && error.message.includes('rate limit')) {
        // Handle rate limiting
        const retryAfter = error.response.headers['retry-after'];
        await new Promise(resolve => 
          setTimeout(resolve, (retryAfter || 60) * 1000)
        );
        continue;
      }
      
      if (error.status >= 500 && attempt < retries) {
        // Retry server errors with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
};
```

## Security Considerations

### Webhook Security
```typescript
const verifyWebhookSignature = (payload: string, signature: string, secret: string) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

### Private Key Security
```typescript
// Store private key securely
const privateKey = process.env.GITHUB_PRIVATE_KEY
  ?.replace(/\\n/g, '\n') // Handle escaped newlines
  || '';

if (!privateKey) {
  throw new Error('GitHub App private key not configured');
}

// Use environment-specific key storage
const getPrivateKey = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use secure key management service
    return getSecretFromVault('github-app-private-key');
  }
  return process.env.GITHUB_PRIVATE_KEY;
};
```

## Testing GitHub App Integration

### Webhook Testing
```typescript
describe('GitHub Webhook Processing', () => {
  beforeEach(() => {
    // Mock GitHub API responses
    nock('https://api.github.com')
      .persist()
      .get('/installation/repositories')
      .reply(200, { repositories: [] });
  });
  
  it('processes pull request events', async () => {
    const payload = {
      action: 'opened',
      pull_request: {
        id: 123,
        title: 'Test PR',
        user: { login: 'testuser' }
      },
      repository: {
        full_name: 'owner/repo'
      }
    };
    
    const result = await processWebhookEvent({
      name: 'pull_request',
      payload,
      signature: generateWebhookSignature(payload)
    });
    
    expect(result.status).toBe('received');
  });
});
```

### Integration Testing
```typescript
describe('GitHub App Integration', () => {
  it('authenticates with GitHub App', async () => {
    const installation = await app.getInstallationOctokit(TEST_INSTALLATION_ID);
    const response = await installation.rest.apps.getAuthenticated();
    
    expect(response.data.name).toBe('contributor.info');
  });
  
  it('handles repository discovery', async () => {
    const repos = await discoverRepositories(TEST_INSTALLATION);
    
    expect(repos).toHaveLength(0); // Test installation has no repos
  });
});
```

## Monitoring & Observability

### GitHub App Metrics
```typescript
const trackGitHubAppMetrics = () => {
  // API usage tracking
  const apiUsage = {
    requests_made: 0,
    rate_limit_remaining: 0,
    rate_limit_reset: 0
  };
  
  // Webhook processing metrics
  const webhookMetrics = {
    events_received: 0,
    events_processed: 0,
    processing_errors: 0,
    average_processing_time: 0
  };
  
  // Installation metrics
  const installationMetrics = {
    active_installations: 0,
    repositories_tracked: 0,
    contributors_discovered: 0
  };
  
  return { apiUsage, webhookMetrics, installationMetrics };
};
```

### Error Monitoring
```typescript
const logGitHubAppError = (error: Error, context: any) => {
  console.error('GitHub App Error:', error.message, context);
  
  // Send to monitoring service
  Sentry.captureException(error, {
    tags: {
      component: 'github-app',
      operation: context.operation
    },
    extra: {
      installation_id: context.installationId,
      repository: context.repository,
      event_type: context.eventType
    }
  });
};
```

## Deployment & Configuration

### Environment Variables
```bash
# GitHub App configuration
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Optional: GitHub Enterprise
GITHUB_BASE_URL=https://github.example.com/api/v3
```

### Production Deployment
```typescript
// Production webhook endpoint
app.post('/github/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
      return res.status(401).send('Unauthorized');
    }
    
    // Process webhook
    const result = await processWebhookEvent({
      name: req.headers['x-github-event'],
      payload: req.body,
      signature
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Troubleshooting

### Common Issues

1. **Webhook delivery failures**
   - Check webhook URL accessibility
   - Verify webhook secret configuration
   - Review GitHub App permissions

2. **Authentication errors**
   - Validate private key format
   - Check installation ID
   - Verify app permissions

3. **Rate limiting**
   - Monitor API usage
   - Implement proper retry logic
   - Use GraphQL for complex queries

### Debug Tools
```typescript
// Debug GitHub App configuration
const debugGitHubApp = async () => {
  const app = await octokit.rest.apps.getAuthenticated();
  console.log('GitHub App:', app.data.name, app.data.id);
  
  const installations = await octokit.rest.apps.listInstallations();
  console.log('Installations:', installations.data.length);
  
  const rateLimit = await octokit.rest.rateLimit.get();
  console.log('Rate limit:', rateLimit.data.rate);
};
```

## Related Documentation

- [Setup Documentation](../setup/) - GitHub App setup procedures
- [Security Documentation](../security/) - Security best practices
- [Troubleshooting Guide](../troubleshooting/) - GitHub integration issues
- [Data Fetching Guide](../data-fetching/) - GitHub API integration patterns

---

**GitHub App Philosophy**: Build integrations that enhance the developer workflow without being intrusive or overwhelming.