# PostHog Cohorts Setup Guide

## Quick Start

### 1. Get Your PostHog Credentials

1. **Personal API Key**: 
   - Go to https://app.posthog.com/me/settings/personal-api-keys
   - Click "Create personal API key"
   - Give it a name like "contributor.info cohorts"
   - **IMPORTANT**: Select these scopes:
     - `cohort:read` - To list existing cohorts
     - `cohort:write` - To create new cohorts
   - Copy the key (starts with `phx_`)

2. **Project ID**:
   - Go to https://app.posthog.com/project/settings
   - Copy your Project ID (it's in the URL or settings page)

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy from .env.posthog.example
cp .env.posthog.example .env.local
```

Edit `.env.local` and add your credentials:
```bash
POSTHOG_PERSONAL_API_KEY=phx_your_key_here
POSTHOG_PROJECT_ID=your_project_id_here
```

### 3. Run the Setup Script

```bash
# Install dependencies if needed
npm install

# Run the cohort setup
npm run setup-cohorts
```

This will create 12 cohorts in your PostHog project:
- 🔥 Power Users
- 🆕 New Users (First 30 Days)
- 🔍 Active Searchers
- 📊 Workspace Power Users
- 👀 Repository Browsers (No Workspace)
- 📈 Trending Discovery Users
- 🔄 Manual Data Refreshers
- 📤 Content Sharers
- 🎯 High Intent (No Workspace)
- ⚠️ Error Experiencers
- 🔐 Authenticated Users
- 💤 Dormant Users

## Using Cohorts in PostHog

### 1. View Your Cohorts
Visit: https://app.posthog.com/project/[YOUR_PROJECT_ID]/cohorts

### 2. Create Insights by Cohort

1. Go to Insights → New Insight
2. Add your metric (e.g., "repository_page_viewed")
3. Click "Add filter" → "Cohort"
4. Select your cohort (e.g., "Power Users")
5. Compare different cohorts' behavior

### 3. Set Up Feature Flags by Cohort

1. Go to Feature Flags → New Feature Flag
2. Name your flag (e.g., "advanced-features")
3. Under "Release conditions", click "Add condition"
4. Select "User is in cohort"
5. Choose your cohort (e.g., "Power Users")
6. Set rollout percentage

### 4. Create Cohort Dashboards

1. Go to Dashboards → New Dashboard
2. Name it "Cohort Analysis"
3. Add insights:
   - Cohort size over time
   - Conversion funnel by cohort
   - Feature adoption by cohort
   - Retention curves by cohort

## Implementation in Code

### Enhanced User Identification

Update your user identification to include more properties:

```typescript
// In src/lib/posthog-lazy.ts
import { identifyUser } from '@/lib/posthog-lazy';

// When user logs in
await identifyUser(user.id, {
  email: user.email,
  github_username: user.user_metadata.user_name,
  github_company: user.user_metadata.company,
  github_followers: user.user_metadata.followers,
  github_public_repos: user.user_metadata.public_repos,
  signup_date: user.created_at,
  has_workspace: workspaces.length > 0,
  workspace_count: workspaces.length,
  repository_count: repositories.length,
});
```

### Track Events with Context

```typescript
// In your components
import { trackEvent } from '@/lib/posthog-lazy';

// Track with additional context
trackEvent('repository_page_viewed', {
  repo_category: repo.is_private ? 'private' : 'public',
  star_count: repo.stargazers_count,
  contributor_count: contributors.length,
  has_workspace: userHasWorkspace,
  user_workspace_count: workspaces.length,
});
```

### Using Cohorts for Feature Flags

```typescript
// Check if user is in a cohort via feature flag
import { usePostHog } from 'posthog-js/react';

function MyComponent() {
  const posthog = usePostHog();
  
  // Feature flag that targets a cohort
  const showAdvancedFeatures = posthog?.isFeatureEnabled('advanced-features');
  
  if (showAdvancedFeatures) {
    return <AdvancedFeatures />;
  }
  
  return <StandardFeatures />;
}
```

## Monitoring Cohorts

### Key Metrics to Track

1. **Cohort Growth Rate**
   - How fast each cohort is growing
   - Which cohorts are shrinking

2. **Cohort Conversion**
   - Browser → Power User conversion rate
   - New User → Workspace Creator conversion

3. **Feature Adoption by Cohort**
   - Which cohorts adopt new features fastest
   - Which features resonate with which cohorts

4. **Retention by Cohort**
   - 7-day, 30-day retention per cohort
   - Churn risk identification

### SQL Queries for Advanced Analysis

In PostHog, you can use HogQL for advanced queries:

```sql
-- Users who moved from browsers to power users
SELECT 
  person_id,
  min(timestamp) as first_browse,
  max(timestamp) as became_power_user
FROM events
WHERE event IN ('repository_page_viewed', 'workspace_created')
GROUP BY person_id
HAVING 
  count(CASE WHEN event = 'workspace_created' THEN 1 END) > 0
  AND min(CASE WHEN event = 'repository_page_viewed' THEN timestamp END) 
    < min(CASE WHEN event = 'workspace_created' THEN timestamp END)
```

## Automation & Alerts

### Set Up Alerts

1. Go to https://app.posthog.com/project/[PROJECT_ID]/alerts
2. Create alerts for:
   - Sudden changes in cohort sizes
   - Drop in power user activity
   - Increase in error experiencers

### Export Cohorts

You can export cohort data via API:

```typescript
// Get cohort members
const response = await fetch(
  `https://app.posthog.com/api/projects/${PROJECT_ID}/cohorts/${COHORT_ID}/persons/`,
  {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  }
);
const members = await response.json();
```

## Troubleshooting

### Common Issues

1. **"Cohort already exists"**
   - The script skips existing cohorts
   - Delete from PostHog UI if you want to recreate

2. **"API key invalid"**
   - Ensure you're using a Personal API key, not Project API key
   - Check the key starts with `phx_`

3. **"No users in cohort"**
   - Events need to be tracked first
   - Cohorts update every ~15 minutes
   - Check your event names match exactly

### Verify Events Are Tracked

Check if events are being received:
1. Go to https://app.posthog.com/project/[PROJECT_ID]/events
2. Filter by event name
3. Verify properties are included

## Next Steps

1. **Create Custom Cohorts** based on your specific needs
2. **Build Dashboards** for weekly cohort reviews
3. **Set Up Experiments** targeting specific cohorts
4. **Integrate with CRM** for targeted outreach
5. **Automate Reports** using PostHog API

## Resources

- [PostHog Cohorts Documentation](https://posthog.com/docs/data/cohorts)
- [PostHog API Reference](https://posthog.com/docs/api)
- [HogQL Reference](https://posthog.com/docs/hogql)
- [Feature Flags Guide](https://posthog.com/docs/feature-flags)