# PostHog Cohorts Implementation Guide

## Overview
This guide provides specific cohort definitions for contributor.info to help identify and analyze different user segments in PostHog.

## User Identification Strategy

### Current Implementation
Users are identified in PostHog when they:
1. Successfully authenticate via GitHub OAuth
2. Properties captured:
   - `userId`: GitHub user ID
   - `signup_date`: ISO timestamp of first login
   - `distinct_id`: Generated unique identifier
   - GitHub metadata (avatar_url, user_name, etc.)

### Key Properties Available for Cohort Creation

## Cohort Definitions

### 1. 🔥 Power Users
**Purpose**: Identify highly engaged users who actively use workspace features
```json
{
  "name": "Power Users",
  "filters": {
    "events": [
      {
        "id": "workspace_created",
        "type": "events",
        "operator": "gte",
        "value": 1
      },
      {
        "id": "repository_added_to_workspace",
        "type": "events",
        "operator": "gte",
        "value": 3,
        "time_window": "30d"
      }
    ],
    "behavioral": "performed_event_multiple_times"
  }
}
```

### 2. 🆕 New Users (Onboarding)
**Purpose**: Track users in their first 30 days to optimize onboarding
```json
{
  "name": "New Users - First 30 Days",
  "filters": {
    "properties": [
      {
        "key": "signup_date",
        "type": "person",
        "operator": "date_after",
        "value": "-30d"
      }
    ],
    "events": [
      {
        "id": "login_successful",
        "properties": {
          "is_first_time": true
        }
      }
    ]
  }
}
```

### 3. 🔍 Active Searchers
**Purpose**: Users who frequently search for repositories
```json
{
  "name": "Active Searchers",
  "filters": {
    "events": [
      {
        "id": "repository_searched",
        "operator": "gte",
        "value": 5,
        "time_window": "7d"
      },
      {
        "id": "repository_selected_from_search",
        "operator": "gte",
        "value": 2,
        "time_window": "7d"
      }
    ]
  }
}
```

### 4. 📊 Workspace Power Users
**Purpose**: Users who actively manage multiple repositories in workspaces
```json
{
  "name": "Workspace Power Users",
  "filters": {
    "events": [
      {
        "id": "workspace_created",
        "operator": "gte",
        "value": 1
      },
      {
        "id": "repository_added_to_workspace",
        "operator": "gte",
        "value": 5
      },
      {
        "id": "workspace_settings_modified",
        "operator": "gte",
        "value": 1
      }
    ]
  }
}
```

### 5. 👀 Repository Browsers
**Purpose**: Users who browse repositories but haven't created workspaces
```json
{
  "name": "Repository Browsers (No Workspace)",
  "filters": {
    "events": [
      {
        "id": "repository_page_viewed",
        "operator": "gte",
        "value": 3,
        "time_window": "30d"
      },
      {
        "id": "workspace_created",
        "operator": "eq",
        "value": 0
      }
    ]
  }
}
```

### 6. 📈 Trending Page Users
**Purpose**: Users who discover repositories through trending
```json
{
  "name": "Trending Discovery Users",
  "filters": {
    "events": [
      {
        "id": "trending_page_interaction",
        "properties": {
          "action": "repository_clicked"
        },
        "operator": "gte",
        "value": 2,
        "time_window": "7d"
      }
    ]
  }
}
```

### 7. 🔄 Data Refreshers
**Purpose**: Users who manually refresh repository data
```json
{
  "name": "Manual Data Refreshers",
  "filters": {
    "events": [
      {
        "id": "data_refresh_triggered",
        "properties": {
          "trigger_type": "manual"
        },
        "operator": "gte",
        "value": 3,
        "time_window": "30d"
      }
    ]
  }
}
```

### 8. 📤 Sharers & Advocates
**Purpose**: Users who share content (potential advocates)
```json
{
  "name": "Content Sharers",
  "filters": {
    "events": [
      {
        "id": "share_action",
        "operator": "gte",
        "value": 2
      }
    ]
  }
}
```

### 9. ⚠️ Error Experiencers
**Purpose**: Users who encounter errors (for UX improvement)
```json
{
  "name": "Users With Errors",
  "filters": {
    "events": [
      {
        "id": "error_boundary_triggered",
        "operator": "gte",
        "value": 1,
        "time_window": "7d"
      }
    ]
  }
}
```

### 10. 💤 Dormant Users
**Purpose**: Previously active users who haven't returned
```json
{
  "name": "Dormant Users",
  "filters": {
    "behavioral": "performed_event",
    "time_window": {
      "performed": "more_than_30_days_ago",
      "not_performed": "in_last_30_days"
    }
  }
}
```

### 11. 🔐 Authenticated vs Anonymous
**Purpose**: Distinguish between logged-in and anonymous users
```json
{
  "name": "Authenticated Users",
  "filters": {
    "events": [
      {
        "id": "login_successful",
        "operator": "gte",
        "value": 1
      }
    ]
  }
}
```

### 12. 🎯 High-Intent Users
**Purpose**: Users showing strong product interest but haven't converted to workspace creation
```json
{
  "name": "High Intent - No Workspace",
  "filters": {
    "events": [
      {
        "id": "repository_page_viewed",
        "operator": "gte",
        "value": 10,
        "time_window": "30d"
      },
      {
        "id": "repository_tab_switched",
        "operator": "gte",
        "value": 5,
        "time_window": "30d"
      },
      {
        "id": "workspace_created",
        "operator": "eq",
        "value": 0
      }
    ]
  }
}
```

## Implementation Steps

### Step 1: Create Cohorts in PostHog UI
1. Navigate to **Data Management** → **Cohorts** in PostHog
2. Click **New Cohort**
3. For each cohort above:
   - Enter the cohort name
   - Configure filters using the matching criteria
   - Save the cohort

### Step 2: Use SQL for Advanced Cohorts
For complex segmentation, use PostHog's SQL interface:

```sql
-- Weekly Active Workspace Users
SELECT DISTINCT person_id
FROM events
WHERE event = 'workspace_created' 
   OR event = 'repository_added_to_workspace'
   OR event = 'workspace_settings_modified'
AND timestamp > now() - INTERVAL 7 DAY

-- Users with Multiple Workspaces
SELECT person_id, COUNT(DISTINCT properties->>'workspace_id') as workspace_count
FROM events
WHERE event = 'workspace_created'
GROUP BY person_id
HAVING workspace_count > 1
```

### Step 3: Track Additional Properties for Better Segmentation

Add these properties to your tracking calls:

```typescript
// Enhanced workspace tracking
trackWorkspaceCreated(source, {
  repository_count: repositories.length,
  is_public: workspace.is_public,
  team_size: members.length,
  has_github_app: hasGitHubApp
});

// Enhanced repository tracking
trackRepositoryPageViewed(repoCategory, {
  star_count: repo.stargazers_count,
  contributor_count: contributors.length,
  is_tracked: isTracked,
  has_workspace: userHasWorkspace
});

// Enhanced user properties on login
identifyUser(userId, {
  signup_date: new Date().toISOString(),
  github_repos: user.public_repos,
  github_followers: user.followers,
  github_company: user.company,
  github_created_at: user.created_at,
  has_workspace: workspaces.length > 0
});
```

## Analysis Use Cases

### 1. Funnel Analysis by Cohort
- Compare conversion rates from "Repository Browsers" to "Workspace Power Users"
- Analyze drop-off points for "New Users"

### 2. Feature Adoption
- Track which cohorts adopt new features fastest
- Identify power user behaviors to guide product development

### 3. Retention Analysis
- Compare retention between "Active Searchers" vs "Trending Discovery Users"
- Identify what keeps "Power Users" engaged

### 4. Error Impact
- Analyze if "Error Experiencers" have lower retention
- Prioritize fixes based on cohort value

### 5. Growth Opportunities
- Target "High-Intent Users" for workspace creation campaigns
- Re-engage "Dormant Users" with new features

## Monitoring & Iteration

### Weekly Review Metrics
1. Cohort sizes and growth rates
2. Conversion between cohorts
3. Feature usage by cohort
4. Retention curves per cohort

### Monthly Deep Dives
1. Cohort overlap analysis
2. Behavioral pattern changes
3. New cohort opportunities
4. Cohort-based A/B test results

## API Integration

To programmatically manage cohorts:

```typescript
// Using PostHog API to create cohorts
const createCohort = async (definition: CohortDefinition) => {
  const response = await fetch('https://app.posthog.com/api/projects/{project_id}/cohorts/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${POSTHOG_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: definition.name,
      filters: definition.filters,
      is_static: false
    })
  });
  return response.json();
};
```

## Best Practices

1. **Start Simple**: Begin with 3-5 core cohorts and expand based on insights
2. **Regular Updates**: Review cohort definitions monthly
3. **Document Changes**: Track why cohorts were created/modified
4. **Cross-reference**: Compare cohort behaviors across different features
5. **Action-Oriented**: Each cohort should inform specific product decisions

## Next Steps

1. Implement the first 5 cohorts
2. Set up dashboards for each cohort
3. Create alerts for significant cohort changes
4. Plan cohort-specific features or communications
5. Schedule monthly cohort review meetings