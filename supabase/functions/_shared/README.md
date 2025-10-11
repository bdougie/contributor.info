# Shared Utilities Documentation

This directory contains reusable utilities shared across edge functions. These utilities help
maintain consistency and reduce code duplication.

## Available Utilities

### cors.ts - CORS Headers Configuration

Provides standardized CORS headers for cross-origin requests.

#### Purpose

- Enable cross-origin requests from web applications
- Support preflight OPTIONS requests
- Include necessary headers for authentication and custom headers

#### Usage

```typescript
import { corsHeaders } from '../_shared/cors.ts';

// Handle preflight requests
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Include in responses
return new Response(
  JSON.stringify({ success: true }),
  {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  },
);
```

#### Configuration

The `corsHeaders` object includes:

- `Access-Control-Allow-Origin: *` - Allow all origins
- `Access-Control-Allow-Headers` - Supported request headers
- `Access-Control-Allow-Methods` - Supported HTTP methods

**Note:** The header names include both cases (e.g., `x-inngest-signature` and
`X-Inngest-Signature`) as a workaround for a Deno/Supabase case-sensitivity bug in CORS preflight.
See [issue #732](https://github.com/bdougie/contributor.info/issues/732).

#### Best Practices

1. **Always handle OPTIONS requests:**
   ```typescript
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
   ```

2. **Include CORS headers in all responses:**
   ```typescript
   // Success response
   return new Response(data, { headers: corsHeaders });

   // Error response
   return new Response(error, {
     headers: corsHeaders,
     status: 500,
   });
   ```

3. **Merge with other headers:**
   ```typescript
   return new Response(data, {
     headers: {
       ...corsHeaders,
       'Content-Type': 'application/json',
       'Cache-Control': 'no-cache',
     },
   });
   ```

---

### event-detection.ts - GitHub Event Detection

Utilities for detecting and categorizing GitHub webhook events.

#### Purpose

- Identify privileged GitHub events (maintainer actions)
- Detect bot accounts
- Route events based on type and permissions

#### Key Functions

##### `detectPrivilegedEvent(event: GitHubEvent): PrivilegedEventDetection`

Determines if an event represents a privileged action (e.g., merge, review approval).

**Usage:**

```typescript
import { detectPrivilegedEvent, GitHubEvent } from '../_shared/event-detection.ts';

const event: GitHubEvent = {
  type: 'pull_request',
  payload: {
    action: 'closed',
    pull_request: { merged: true },
  },
};

const { isPrivileged, confidence, signals } = detectPrivilegedEvent(event);
if (isPrivileged) {
  console.log('Detected privileged event with confidence: %d', confidence);
  console.log('Detection signals: %s', signals.join(', '));
}
```

**Privileged Events Include:**

- Pull request merges
- Review approvals
- Issue assignments
- Label management
- Milestone updates

##### `isBotAccount(login: string): boolean`

Identifies bot accounts by username patterns.

**Usage:**

```typescript
import { isBotAccount } from '../_shared/event-detection.ts';

const username = 'dependabot[bot]';
const isBot = isBotAccount(username);

if (isBot) {
  console.log('Skipping bot account');
  return;
}
```

**Bot Detection Patterns:**

- Ends with `[bot]`
- Ends with `-bot`
- Common bot names (dependabot, renovate, etc.)

#### Types

```typescript
interface GitHubEvent {
  type: string;
  payload: {
    action?: string;
    pull_request?: {
      merged?: boolean;
      number: number;
    };
    issue?: {
      number: number;
    };
    review?: {
      state: string;
    };
    [key: string]: any;
  };
}
```

#### Best Practices

1. **Check for bots early:**
   ```typescript
   if (isBotAccount(author.login)) {
     return; // Skip bot processing
   }
   ```

2. **Use privileged detection for metrics:**
   ```typescript
   const { isPrivileged } = detectPrivilegedEvent(event);
   if (isPrivileged) {
     // Update contributor role with proper metrics
     const metrics = await getContributorMetrics(
       supabase,
       userId,
       repositoryOwner,
       repositoryName,
     );
     const score = calculateConfidenceScore(metrics);
     await updateContributorRole(supabase, metrics, score);
   }
   ```

3. **Log event types for debugging:**
   ```typescript
   console.log('Processing event: %s, action: %s', event.type, event.payload.action);
   ```

---

### confidence-scoring.ts - Contributor Confidence Scoring

Calculate and manage contributor confidence scores based on activity.

#### Purpose

- Assess contributor reliability and engagement
- Categorize contributors by role (viewer, contributor, maintainer)
- Track contributor metrics over time

#### Key Functions

##### `calculateConfidenceScore(metrics: ContributorMetrics): ConfidenceScore`

Calculates a confidence score based on contributor activity metrics.

**Usage:**

```typescript
import { calculateConfidenceScore, getContributorMetrics } from '../_shared/confidence-scoring.ts';

// First get metrics
const metrics = await getContributorMetrics(
  supabase,
  contributorId,
  repositoryOwner,
  repositoryName,
);

// Then calculate score
const score = calculateConfidenceScore(metrics);
console.log('Overall confidence: %d', score.overall);
console.log('Privileged events score: %d', score.components.privilegedEvents);

// Update contributor record
await supabase
  .from('contributors')
  .update({ confidence_score: score.overall })
  .eq('id', contributorId);
```

**Scoring Factors:**

- Number of contributions
- Pull request acceptance rate
- Code review participation
- Issue triage activity
- Account age and activity

##### `getContributorMetrics(supabase, userId: string, repositoryOwner: string, repositoryName: string): Promise<Metrics>`

Retrieves detailed contributor metrics for a specific repository.

**Usage:**

```typescript
import { getContributorMetrics } from '../_shared/confidence-scoring.ts';

const metrics = await getContributorMetrics(
  supabase,
  contributorId,
  repositoryOwner,
  repositoryName,
);

console.log('Contributor stats:', {
  totalPRs: metrics.totalEventCount,
  privilegedEvents: metrics.privilegedEventCount,
  uniqueEventTypes: metrics.uniqueEventTypes,
  daysSinceFirstSeen: metrics.daysSinceFirstSeen,
});
```

##### `updateContributorRole(supabase, metrics: ContributorMetrics, score: ConfidenceScore): Promise<void>`

Updates a contributor's role based on metrics and confidence score.

**Usage:**

```typescript
import {
  calculateConfidenceScore,
  getContributorMetrics,
  updateContributorRole,
} from '../_shared/confidence-scoring.ts';

// Get metrics and calculate score
const metrics = await getContributorMetrics(
  supabase,
  contributorId,
  repositoryOwner,
  repositoryName,
);
const score = calculateConfidenceScore(metrics);

// Update role based on confidence
await updateContributorRole(supabase, metrics, score);
```

// Valid roles: 'viewer', 'contributor', 'maintainer'

````
#### Types

```typescript
interface ContributorMetrics {
  total_prs: number;
  merged_prs: number;
  review_count: number;
  issue_count: number;
  comment_count: number;
  account_age_days: number;
  last_activity: string;
}

type ContributorRole = 'viewer' | 'contributor' | 'maintainer';
````

#### Best Practices

1. **Calculate scores periodically:**
   ```typescript
   // In a scheduled job
   const contributors = await getActiveContributors(supabase);
   for (const contributor of contributors) {
     const score = await calculateConfidenceScore(supabase, contributor.id);
     await updateScore(contributor.id, score);
   }
   ```

2. **Use scores for prioritization:**
   ```typescript
   if (score > 80) {
     // High confidence contributor
     await sendWelcomeEmail(contributor);
   }
   ```

3. **Update roles based on actions:**
   ```typescript
   if (event.type === 'pull_request' && event.payload.merged) {
     await updateContributorRole(supabase, userId, 'maintainer');
   }
   ```

---

### bot-detection.ts - Bot Account Detection

Advanced bot detection beyond simple username patterns.

#### Purpose

- Identify automated accounts
- Prevent bot contributions from skewing metrics
- Distinguish between helpful bots and spam

#### Key Functions

##### `detectBot(profile: GitHubProfile): BotDetectionResult`

Comprehensive bot detection using multiple signals.

**Usage:**

```typescript
import { detectBot } from '../_shared/bot-detection.ts';

const profile = {
  login: 'user123',
  type: 'User',
  created_at: '2024-01-01T00:00:00Z',
  bio: 'Automated dependency updates',
  public_repos: 0,
  followers: 0,
};

const result = detectBot(profile);
if (result.isBot) {
  console.log('Bot detected: %s', result.reasons.join(', '));
  return;
}
```

**Detection Signals:**

- Username patterns (`[bot]`, `-bot`)
- Account type (`Bot`)
- Bio keywords (automated, bot, etc.)
- Activity patterns (no followers, no repos)
- Account age vs activity ratio

#### Types

```typescript
interface GitHubProfile {
  login: string;
  type: 'User' | 'Bot' | 'Organization';
  created_at: string;
  bio?: string;
  public_repos: number;
  followers: number;
  following: number;
}

interface BotDetectionResult {
  isBot: boolean;
  confidence: number; // 0-1
  reasons: string[];
}
```

#### Best Practices

1. **Check early in processing:**
   ```typescript
   const botResult = detectBot(profile);
   if (botResult.isBot && botResult.confidence > 0.8) {
     return; // Skip high-confidence bot detection
   }
   ```

2. **Log bot detection for review:**
   ```typescript
   if (botResult.isBot) {
     console.log(
       'Bot detected - user: %s, confidence: %f, reasons: %s',
       profile.login,
       botResult.confidence,
       botResult.reasons.join(', '),
     );
   }
   ```

3. **Allow trusted bots:**
   ```typescript
   const TRUSTED_BOTS = ['dependabot[bot]', 'renovate[bot]'];
   if (TRUSTED_BOTS.includes(profile.login)) {
     // Process as normal
   }
   ```

---

### spam-detection-integration.ts - Spam Detection Integration

Integration utilities for spam detection across edge functions.

#### Purpose

- Detect spam profiles and contributions
- Integrate spam detection into various workflows
- Maintain spam detection consistency

#### Key Functions

##### `checkForSpam(profile: Profile): Promise<SpamResult>`

Checks if a profile shows spam indicators.

**Usage:**

```typescript
import { checkForSpam } from '../_shared/spam-detection-integration.ts';

const result = await checkForSpam(profile);

if (result.isSpam) {
  console.log('Spam detected: %s (score: %d)', result.reasons.join(', '), result.spamScore);

  await flagProfile(profile.id);
  return;
}
```

**Spam Indicators:**

- Suspicious username patterns
- Profile spam keywords
- Low-quality contributions
- Rapid account creation + activity
- Link spam in bio/repos

#### Types

```typescript
interface SpamResult {
  isSpam: boolean;
  spamScore: number; // 0-100
  confidence: number; // 0-1
  reasons: string[];
  indicators: string[];
}
```

#### Best Practices

1. **Check before processing contributions:**
   ```typescript
   const spamCheck = await checkForSpam(contributor);
   if (spamCheck.isSpam && spamCheck.confidence > 0.9) {
     await markAsSpam(contributor.id);
     return;
   }
   ```

2. **Log spam detection for review:**
   ```typescript
   if (spamCheck.isSpam) {
     await supabase.from('spam_logs').insert({
       profile_id: contributor.id,
       spam_score: spamCheck.spamScore,
       reasons: spamCheck.reasons,
       detected_at: new Date().toISOString(),
     });
   }
   ```

3. **Use thresholds appropriately:**
   ```typescript
   if (spamCheck.spamScore > 75) {
     // Auto-flag
   } else if (spamCheck.spamScore > 50) {
     // Manual review
   }
   ```

---

### database.ts - Database Utilities

Shared database operations including Supabase client creation and contributor management.

#### Purpose

- Provide standardized Supabase client initialization
- Eliminate duplicate contributor upsert logic
- Ensure consistent database error handling

#### Key Functions

##### `createSupabaseClient(): SupabaseClient`

Creates a Supabase client with service role key.

**Usage:**

```typescript
import { createSupabaseClient } from '../_shared/database.ts';

const supabase = createSupabaseClient();
const { data, error } = await supabase.from('contributors').select('*');
```

**Benefits:**

- Centralized client configuration
- Automatic environment variable validation
- Consistent error handling

##### `ensureContributor(supabase: SupabaseClient, userData: GitHubUser): Promise<string | null>`

Ensures a contributor exists in the database, creating or updating as needed.

**Usage:**

```typescript
import { createSupabaseClient, ensureContributor } from '../_shared/database.ts';

const supabase = createSupabaseClient();
const contributorId = await ensureContributor(supabase, {
  id: 12345,
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://github.com/images/error/octocat_happy.gif',
  type: 'User',
});

if (contributorId) {
  console.log('Contributor ID: %s', contributorId);
}
```

**Features:**

- Automatic bot detection
- Upsert with conflict resolution
- Returns database ID for further operations
- Handles missing optional fields gracefully

##### `getContributorByGitHubId(supabase: SupabaseClient, githubId: number): Promise<string | null>`

Gets an existing contributor by GitHub ID.

**Usage:**

```typescript
import { getContributorByGitHubId } from '../_shared/database.ts';

const contributorId = await getContributorByGitHubId(supabase, 12345);
if (contributorId) {
  // Contributor exists
}
```

##### `getOrCreateContributor(supabase: SupabaseClient, userData: GitHubUser): Promise<string | null>`

Gets or creates a contributor (checks if exists first).

**Usage:**

```typescript
import { getOrCreateContributor } from '../_shared/database.ts';

// More efficient than ensureContributor when contributor likely exists
const contributorId = await getOrCreateContributor(supabase, githubUser);
```

#### Types

```typescript
interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  type?: string;
}
```

#### Best Practices

1. **Use ensureContributor for webhook processing:**
   ```typescript
   // In webhook handler
   const contributorId = await ensureContributor(supabase, event.payload.sender);
   ```

2. **Use getOrCreateContributor for batch operations:**
   ```typescript
   // When processing many PRs
   for (const pr of pullRequests) {
     const contributorId = await getOrCreateContributor(supabase, pr.user);
   }
   ```

3. **Always check for null return:**
   ```typescript
   const contributorId = await ensureContributor(supabase, user);
   if (!contributorId) {
     console.error('Failed to ensure contributor: %s', user.login);
     continue;
   }
   ```

---

### responses.ts - Response Utilities

Standardized response formatting and error handling for consistent API responses.

#### Purpose

- Provide consistent response formats across all edge functions
- Simplify error handling with pre-built response helpers
- Automatic CORS header inclusion
- Structured logging for errors

#### Key Functions

##### `successResponse<T>(data?: T, message?: string, status?: number, meta?: Record<string, unknown>): Response`

Creates a standardized success response.

**Usage:**

```typescript
import { successResponse } from '../_shared/responses.ts';

// Simple success
return successResponse({ contributorId: '123' });

// With message and custom status
return successResponse(
  { contributorId: '123' },
  'Contributor created',
  201
);

// With metadata
return successResponse(
  { contributors: [...] },
  'Success',
  200,
  { total: 50, page: 1 }
);
```

**Response Format:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "meta": { "optional": "metadata" }
}
```

##### `errorResponse(error: string, status?: number, details?: string, code?: string, meta?: Record<string, unknown>): Response`

Creates a standardized error response.

**Usage:**

```typescript
import { errorResponse } from '../_shared/responses.ts';

return errorResponse(
  'Repository not found',
  404,
  'The repository owner/name does not exist',
  'REPO_NOT_FOUND',
);
```

**Response Format:**

```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional details",
  "code": "ERROR_CODE",
  "meta": { "optional": "metadata" }
}
```

##### Helper Functions

**`validationError(message: string, details?: string): Response`**

```typescript
return validationError('Missing required fields', 'Both owner and name are required');
```

**`notFoundError(resource: string, details?: string): Response`**

```typescript
return notFoundError('Repository', 'No repository found with owner/name');
```

**`unauthorizedError(message?: string): Response`**

```typescript
return unauthorizedError('GitHub token not configured');
```

**`forbiddenError(message?: string): Response`**

```typescript
return forbiddenError('Insufficient permissions');
```

**`rateLimitError(retryAfter?: number): Response`**

```typescript
return rateLimitError(3600); // Includes Retry-After header
```

**`corsPreflightResponse(): Response`**

```typescript
if (req.method === 'OPTIONS') {
  return corsPreflightResponse();
}
```

**`handleError(error: unknown, context: string, status?: number): Response`**

```typescript
try {
  // ... operation
} catch (error) {
  return handleError(error, 'repository sync');
}
```

#### Migration Example

**Before:**

```typescript
// Old pattern with duplication
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

if (!owner || !name) {
  return new Response(
    JSON.stringify({ error: 'Missing required fields' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

return new Response(
  JSON.stringify({ success: true, data: result }),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);
```

**After:**

```typescript
// New pattern with response utilities
import { corsPreflightResponse, successResponse, validationError } from '../_shared/responses.ts';

if (req.method === 'OPTIONS') {
  return corsPreflightResponse();
}

if (!owner || !name) {
  return validationError('Missing required fields', 'Both owner and name are required');
}

return successResponse({ data: result });
```

#### Best Practices

1. **Always use response utilities:**
   ```typescript
   // ✅ GOOD
   return successResponse(data);

   // ❌ BAD
   return new Response(JSON.stringify({ success: true, data }), { headers: corsHeaders });
   ```

2. **Include error codes for client handling:**
   ```typescript
   return errorResponse('Invalid token', 401, undefined, 'INVALID_TOKEN');
   ```

3. **Use specific error helpers:**
   ```typescript
   // ✅ GOOD
   return notFoundError('Repository');

   // ❌ BAD
   return errorResponse('Not found', 404);
   ```

---

### github.ts - GitHub API Utilities

Shared utilities for interacting with the GitHub API.

#### Purpose

- Standardize GitHub API requests
- Handle rate limiting consistently
- Provide common GitHub operations
- Reduce code duplication for API calls

#### Key Functions

##### `getGitHubHeaders(token?: string, userAgent?: string): HeadersInit`

Creates standard GitHub API headers.

**Usage:**

```typescript
import { getGitHubHeaders, GITHUB_API_BASE } from '../_shared/github.ts';

const headers = getGitHubHeaders();
const response = await fetch(`${GITHUB_API_BASE}/repos/owner/name`, { headers });
```

##### `getRateLimitInfo(response: Response): RateLimitInfo | null`

Extracts rate limit information from GitHub API response.

**Usage:**

```typescript
import { getRateLimitInfo } from '../_shared/github.ts';

const response = await fetch(url, { headers });
const rateLimit = getRateLimitInfo(response);

if (rateLimit) {
  console.log('Rate limit: %s remaining of %s', rateLimit.remaining, rateLimit.limit);
}
```

##### `checkRateLimit(response: Response, threshold?: number): boolean`

Checks if rate limit is low and logs a warning.

**Usage:**

```typescript
import { checkRateLimit } from '../_shared/github.ts';

const response = await fetch(url, { headers });
if (checkRateLimit(response, 50)) {
  // Rate limit is low, consider slowing down
  break;
}
```

##### `fetchGitHubAPI<T>(url: string, token?: string): Promise<T>`

Fetches data from GitHub API with error handling.

**Usage:**

```typescript
import { fetchGitHubAPI, GITHUB_API_BASE } from '../_shared/github.ts';

interface Repository {
  id: number;
  name: string;
  full_name: string;
}

const repo = await fetchGitHubAPI<Repository>(
  `${GITHUB_API_BASE}/repos/owner/name`,
);
```

##### `fetchRepository(owner: string, repo: string, token?: string): Promise<GitHubRepository>`

Fetches repository information from GitHub.

**Usage:**

```typescript
import { fetchRepository } from '../_shared/github.ts';

const repo = await fetchRepository('facebook', 'react');
console.log('Repository: %s, Stars: %s', repo.full_name, repo.stargazers_count);
```

##### `fetchUser(username: string, token?: string): Promise<GitHubUserInfo>`

Fetches user information from GitHub.

**Usage:**

```typescript
import { fetchUser } from '../_shared/github.ts';

const user = await fetchUser('octocat');
console.log('User: %s, Followers: %s', user.login, user.followers);
```

##### `fetchPaginated<T>(baseUrl: string, options?: PaginatedFetchOptions): Promise<T[]>`

Fetches paginated data from GitHub API.

**Usage:**

```typescript
import { fetchPaginated, GITHUB_API_BASE } from '../_shared/github.ts';

const events = await fetchPaginated(
  `${GITHUB_API_BASE}/repos/owner/name/events`,
  {
    perPage: 100,
    maxPages: 3,
  },
);

console.log('Fetched %s events', events.length);
```

##### `isBotUser(login: string, type?: string): boolean`

Checks if a user is a bot account.

**Usage:**

```typescript
import { isBotUser } from '../_shared/github.ts';

if (isBotUser(user.login, user.type)) {
  console.log('Skipping bot account');
  continue;
}
```

#### Types

```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

interface PaginatedFetchOptions {
  token?: string;
  perPage?: number;
  maxPages?: number;
  since?: string;
}
```

#### Migration Example

**Before:**

```typescript
// Duplicated in multiple functions
const token = Deno.env.get('GITHUB_TOKEN');
if (!token) {
  throw new Error('GitHub token not configured');
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'Contributor-Info-Bot',
};

const response = await fetch(url, { headers });
if (!response.ok) {
  throw new Error(`GitHub API error: ${response.status}`);
}

const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
if (remaining < 100) {
  console.warn('Low rate limit: %s remaining', remaining);
}
```

**After:**

```typescript
import { checkRateLimit, fetchGitHubAPI, getGitHubHeaders } from '../_shared/github.ts';

// Simple approach
const data = await fetchGitHubAPI(url);

// Or with rate limit checking
const headers = getGitHubHeaders();
const response = await fetch(url, { headers });
checkRateLimit(response);
```

#### Best Practices

1. **Use fetchGitHubAPI for simple requests:**
   ```typescript
   const data = await fetchGitHubAPI<Repository>(`${GITHUB_API_BASE}/repos/owner/name`);
   ```

2. **Use fetchPaginated for lists:**
   ```typescript
   const events = await fetchPaginated(`${GITHUB_API_BASE}/repos/owner/name/events`);
   ```

3. **Always check rate limits in loops:**
   ```typescript
   for (let page = 1; page <= maxPages; page++) {
     const response = await fetch(url, { headers });
     if (checkRateLimit(response, 100)) {
       break; // Stop if rate limit is low
     }
   }
   ```

4. **Filter bots early:**
   ```typescript
   if (isBotUser(user.login, user.type)) {
     continue;
   }
   ```

---

## Creating New Shared Utilities

When creating new shared utilities:

1. **Create the file in `_shared/`:**
   ```bash
   touch supabase/functions/_shared/my-utility.ts
   ```

2. **Export functions and types:**
   ```typescript
   export interface MyType {
     // Type definition
   }

   export function myUtility(): MyType {
     // Implementation
   }
   ```

3. **Add JSDoc comments:**
   ```typescript
   /**
    * My utility function
    *
    * @param input - Description
    * @returns Description
    * @example
    * const result = myUtility(input);
    */
   ```

4. **Document in this file:**
   - Add usage examples
   - Document types
   - Include best practices

5. **Add tests:**
   ```typescript
   // In __tests__/my-utility.test.ts
   import { myUtility } from '../_shared/my-utility.ts';

   Deno.test('myUtility returns expected result', () => {
     // Test implementation
   });
   ```

## Common Patterns

### Error Handling in Shared Utilities

```typescript
export async function sharedFunction(param: string): Promise<Result> {
  try {
    // Main logic
    return { success: true, data: result };
  } catch (error) {
    console.error('Shared function error: %s', error.message);
    throw new Error(`Failed to process: ${error.message}`);
  }
}
```

### Logging in Shared Utilities

```typescript
// ✅ GOOD: Use format specifiers
console.log('Processing item: %s', itemId);

// ❌ BAD: Template literals
console.log(`Processing item: ${itemId}`);
```

### Type Safety

```typescript
// Define clear interfaces
export interface InputType {
  required: string;
  optional?: number;
}

// Use type guards
export function isValidInput(input: unknown): input is InputType {
  return (
    typeof input === 'object' &&
    input !== null &&
    'required' in input
  );
}
```

## Testing Shared Utilities

```bash
# Run utility tests
deno test supabase/functions/__tests__/

# Test specific utility
deno test supabase/functions/__tests__/cors.test.ts
```

## Best Practices

1. **Keep utilities focused** - Each utility should have a single, clear purpose
2. **Document thoroughly** - Include JSDoc comments and usage examples
3. **Use TypeScript** - Define clear types and interfaces
4. **Test extensively** - Add tests for edge cases
5. **Avoid dependencies** - Keep utilities lightweight
6. **Version carefully** - Breaking changes affect all functions

## Troubleshooting

### Import Errors

```typescript
// ✅ GOOD: Relative imports with .ts extension
import { corsHeaders } from '../_shared/cors.ts';

// ❌ BAD: Missing .ts extension
import { corsHeaders } from '../_shared/cors';
```

### Type Errors

```typescript
// Ensure types are exported
export interface MyType {
  // definition
}

// Import types properly
import type { MyType } from '../_shared/my-utility.ts';
```

## Resources

- [Deno Modules](https://deno.land/manual/linking_to_external_code)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Edge Functions Architecture](../../docs/supabase/edge-functions-architecture.md)
