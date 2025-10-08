# Shared Utilities Documentation

This directory contains reusable utilities shared across edge functions. These utilities help maintain consistency and reduce code duplication.

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
      'Content-Type': 'application/json' 
    }
  }
);
```

#### Configuration

The `corsHeaders` object includes:
- `Access-Control-Allow-Origin: *` - Allow all origins
- `Access-Control-Allow-Headers` - Supported request headers
- `Access-Control-Allow-Methods` - Supported HTTP methods

**Note:** The header names include both cases (e.g., `x-inngest-signature` and `X-Inngest-Signature`) as a workaround for a Deno/Supabase case-sensitivity bug in CORS preflight. See [issue #732](https://github.com/bdougie/contributor.info/issues/732).

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
     status: 500 
   });
   ```

3. **Merge with other headers:**
   ```typescript
   return new Response(data, {
     headers: {
       ...corsHeaders,
       'Content-Type': 'application/json',
       'Cache-Control': 'no-cache',
     }
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

##### `detectPrivilegedEvent(event: GitHubEvent): boolean`

Determines if an event represents a privileged action (e.g., merge, review approval).

**Usage:**
```typescript
import { detectPrivilegedEvent, GitHubEvent } from '../_shared/event-detection.ts';

const event: GitHubEvent = {
  type: 'pull_request',
  payload: {
    action: 'closed',
    pull_request: { merged: true }
  }
};

const isPrivileged = detectPrivilegedEvent(event);
if (isPrivileged) {
  // Update contributor metrics
  await updateContributorRole(supabase, authorId, 'maintainer');
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

2. **Use privileged detection for role updates:**
   ```typescript
   if (detectPrivilegedEvent(event)) {
     await updateContributorRole(supabase, userId, 'maintainer');
   }
   ```

3. **Log event types for debugging:**
   ```typescript
   console.log('Processing event: %s, action: %s', 
     event.type, 
     event.payload.action
   );
   ```

---

### confidence-scoring.ts - Contributor Confidence Scoring

Calculate and manage contributor confidence scores based on activity.

#### Purpose
- Assess contributor reliability and engagement
- Categorize contributors by role (viewer, contributor, maintainer)
- Track contributor metrics over time

#### Key Functions

##### `calculateConfidenceScore(supabase, contributorId: string): Promise<number>`

Calculates a confidence score (0-100) based on contributor activity.

**Usage:**
```typescript
import { calculateConfidenceScore } from '../_shared/confidence-scoring.ts';

const score = await calculateConfidenceScore(supabase, contributorId);
console.log('Confidence score: %d', score);

// Update contributor record
await supabase
  .from('contributors')
  .update({ confidence_score: score })
  .eq('id', contributorId);
```

**Scoring Factors:**
- Number of contributions
- Pull request acceptance rate
- Code review participation
- Issue triage activity
- Account age and activity

##### `getContributorMetrics(supabase, contributorId: string): Promise<Metrics>`

Retrieves detailed contributor metrics.

**Usage:**
```typescript
import { getContributorMetrics } from '../_shared/confidence-scoring.ts';

const metrics = await getContributorMetrics(supabase, contributorId);
console.log('Contributor stats:', {
  totalPRs: metrics.total_prs,
  mergedPRs: metrics.merged_prs,
  reviews: metrics.review_count,
  issues: metrics.issue_count,
});
```

##### `updateContributorRole(supabase, contributorId: string, role: string): Promise<void>`

Updates a contributor's role based on activity.

**Usage:**
```typescript
import { updateContributorRole } from '../_shared/confidence-scoring.ts';

// Promote to maintainer after merge
if (detectPrivilegedEvent(event)) {
  await updateContributorRole(supabase, contributorId, 'maintainer');
}

// Valid roles: 'viewer', 'contributor', 'maintainer'
```

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
```

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
     console.log('Bot detected - user: %s, confidence: %f, reasons: %s',
       profile.login,
       botResult.confidence,
       botResult.reasons.join(', ')
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
  console.log('Spam detected: %s (score: %d)',
    result.reasons.join(', '),
    result.spamScore
  );
  
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
