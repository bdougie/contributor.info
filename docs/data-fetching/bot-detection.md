# Bot Detection System

## Overview

The bot detection system provides a centralized, consistent approach to identifying bot accounts across the application. This ensures accurate contributor metrics by properly categorizing automated accounts versus human contributors.

## Implementation

### Core Detection Utility

**Location**: `src/lib/utils/bot-detection.ts`

The main bot detection function uses a priority-based approach:

1. **GitHub API Type** (Highest Priority)
   - Checks if the GitHub API returns `type: 'Bot'`
   - Most reliable method as it's directly from GitHub's classification

2. **Username Pattern Matching** (Fallback)
   - Matches against known bot patterns
   - Includes suffixes like `[bot]` and `-bot`
   - Covers common bot services (dependabot, renovate, github-actions)

### Edge Function Support

**Location**: `supabase/functions/_shared/bot-detection.ts`

A lightweight version for Supabase Edge Functions that maintains the same detection logic while being optimized for the Edge runtime environment.

## Usage

### In Components

```typescript
import { detectBot } from '@/lib/utils/bot-detection';

// With GitHub user object
const isBot = detectBot({ githubUser: pr.user }).isBot;

// With username only
const isBot = detectBot({ username: 'dependabot[bot]' }).isBot;
```

### In Edge Functions

```typescript
import { detectBot } from '../_shared/bot-detection';

const isBot = detectBot(user).isBot;
```

## Bot Patterns Detected

The system recognizes various bot patterns:

- **GitHub Apps**: `[bot]` suffix (e.g., `dependabot[bot]`)
- **Common Suffixes**: `-bot` (e.g., `release-bot`)
- **Known Services** (exact matches with optional `[bot]` suffix):
  - Dependabot
  - Renovate
  - GitHub Actions

## Components Using Bot Detection

The following components utilize the centralized bot detection:

1. **Activity Feed** (`pr-activity-filtered.tsx`)
   - Filters bot activities from the PR feed
   - Provides toggle to show/hide bot contributions

2. **Contributions View** (`contributions.tsx`)
   - Excludes bots from contributor metrics
   - Accurate human contributor counts

3. **Health Metrics** (`lottery-factor.tsx`, `repository-health-card.tsx`)
   - Calculates health scores based on human contributors only
   - Optional bot inclusion for comprehensive analysis

4. **Social Cards** (`repo-card-with-data.tsx`)
   - Shows accurate contributor statistics
   - Filters bot contributions from top contributors

5. **PR Activity Hook** (`use-pr-activity.ts`)
   - Marks activities as bot-generated
   - Enables UI to display bot indicators

6. **Review/Comment Processor** (`review-comment-processor.ts`)
   - Stores bot status in database
   - Enables historical bot activity analysis

## Database Integration

Bot status is stored in the `contributors` table:

```sql
contributors.is_bot -- Boolean flag indicating bot status
```

This allows for:
- Efficient filtering in database queries
- Historical tracking of bot contributions
- Accurate metrics calculation

## Migration from Legacy Detection

Previously, bot detection was inconsistent across the codebase:
- Some components checked `user.type === 'Bot'`
- Others used `username.includes('[bot]')`
- No centralized pattern matching

The new system:
1. Provides consistent detection logic everywhere
2. Maintains backward compatibility
3. Improves accuracy with comprehensive patterns
4. Reduces code duplication

## Testing Bot Detection

To test bot detection locally:

1. **Known Bot Accounts**: Test with accounts like `dependabot[bot]`, `renovate[bot]`
2. **GitHub API Type**: Verify accounts with `type: 'Bot'` are properly detected
3. **Pattern Matching**: Test various bot naming patterns
4. **Toggle Functionality**: Ensure "Show bots" toggle works in UI components

## Performance Considerations

- Bot detection is performed client-side for real-time filtering
- Database stores pre-computed bot status to avoid repeated detection
- Lightweight regex patterns for minimal performance impact
- Edge function version optimized for Supabase runtime

## Future Improvements

Potential enhancements to consider:

1. **Machine Learning**: Use ML to detect sophisticated bots
2. **Custom Patterns**: Allow organizations to define custom bot patterns
3. **Bot Allowlist**: Ability to mark certain bots as "contributors"
4. **Analytics**: Track bot contribution patterns over time
5. **API Caching**: Cache GitHub API bot status locally

## Related Documentation

- [Manual Repository Tracking](./manual-repository-tracking.md) - How repositories are tracked
- [Progressive Data Capture](./progressive-data-capture-implementation.md) - Data fetching strategy
- [Database Schema](../database-schema.md) - Contributors table structure