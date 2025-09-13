# Feature Flags Quick Reference

Quick guide for using PostHog feature flags with cohort targeting in contributor.info.

## Active Feature Flags

### Workspace Features
```typescript
// Enable workspace creation (Internal Team only)
const canCreateWorkspace = useFeatureFlag('enable_workspace_creation');

// Enable workspace analytics (10% rollout)
const showAnalytics = useFeatureFlag('enable_workspace_analytics');
```

### UI Experiments
```typescript
// New onboarding flow experiment
const useNewOnboarding = useFeatureFlag('new_onboarding_flow');

// Repository card redesign A/B test
const useNewCardDesign = useFeatureFlag('repository_card_redesign');
```

## Implementation Examples

### Basic Feature Flag Check
```tsx
import { useFeatureFlag } from '@/lib/feature-flags';

function MyComponent() {
  const isEnabled = useFeatureFlag('enable_workspace_creation');
  
  if (!isEnabled) {
    return <DisabledState />;
  }
  
  return <EnabledFeature />;
}
```

### With Fallback UI
```tsx
import { FeatureFlag } from '@/lib/feature-flags';

function MyComponent() {
  return (
    <FeatureFlag 
      flag="enable_workspace_creation"
      fallback={<WorkspaceCreationDisabled />}
    >
      <WorkspaceCreateButton />
    </FeatureFlag>
  );
}
```

### A/B Testing
```tsx
import { Experiment } from '@/lib/feature-flags';

function HomePage() {
  return (
    <Experiment
      name="homepage_redesign"
      control={<CurrentHomepage />}
      variants={{
        variant_a: <NewHomepage />,
        variant_b: <AlternativeHomepage />
      }}
    />
  );
}
```

## Managing Feature Flags

### Create New Feature Flag
```bash
# 1. Add to types
# Edit src/lib/feature-flags/types.ts
export const FEATURE_FLAGS = {
  // ... existing flags
  MY_NEW_FEATURE: 'my_new_feature',
};

# 2. Add configuration
# Edit src/lib/feature-flags/posthog-client.ts
[FEATURE_FLAGS.MY_NEW_FEATURE]: {
  name: FEATURE_FLAGS.MY_NEW_FEATURE,
  defaultValue: false,
  description: 'Description of feature',
  rolloutPercentage: 0,
},

# 3. Create in PostHog (via script)
node scripts/create-workspace-feature-flag.js
```

### Target Specific Cohort
```javascript
// In your feature flag script
const FEATURE_FLAG = {
  key: 'my_feature',
  filters: {
    groups: [{
      properties: [{
        key: 'id',
        type: 'cohort',
        value: 180246, // Internal Team cohort ID
        operator: null,
      }],
      rollout_percentage: 100,
    }]
  }
};
```

## Cohort IDs Reference

| Cohort | ID | Use Case |
|--------|-----|----------|
| Internal Team | 180246 | Testing & development |
| New Users | 180240 | Onboarding features |
| Users with Workspaces | 180241 | Workspace features |
| Active Users | 180243 | Premium features |
| Power Users | 180244 | Advanced features |

## Testing Feature Flags

### Local Testing
```typescript
// Force enable a flag locally
localStorage.setItem('posthog_feature_flag_overrides', JSON.stringify({
  'enable_workspace_creation': true
}));

// Clear overrides
localStorage.removeItem('posthog_feature_flag_overrides');
```

### Check Flag Status
```javascript
// In browser console
posthog.isFeatureEnabled('enable_workspace_creation');
posthog.getFeatureFlag('enable_workspace_creation');
```

### Reload Flags
```javascript
// Force refresh from PostHog
posthog.reloadFeatureFlags();
```

## Common Patterns

### Progressive Rollout
```javascript
// Start with internal team
{ cohort: 'Internal Team', percentage: 100 }

// Expand to power users
{ cohort: 'Power Users', percentage: 100 }

// Then percentage rollout
{ all_users: true, percentage: 10 }

// Gradual increase
{ all_users: true, percentage: 50 }
{ all_users: true, percentage: 100 }
```

### Kill Switch Pattern
```typescript
// Quick disable for problematic features
const isEmergencyOff = useFeatureFlag('emergency_kill_switch');

if (isEmergencyOff) {
  return <MaintenanceMode />;
}
```

### Feature Announcement
```typescript
const showNewFeature = useFeatureFlag('announce_new_feature');
const [dismissed, setDismissed] = useState(false);

if (showNewFeature && !dismissed) {
  return <FeatureAnnouncement onDismiss={() => setDismissed(true)} />;
}
```

## Scripts

### Update Internal Team
```bash
# Add new team member
# Edit scripts/create-internal-users-cohort.js
const INTERNAL_USERS = [
  'bdougie',
  'new-member', // Add here
];

# Run update
node scripts/create-internal-users-cohort.js
```

### Create Feature Flag
```bash
# Copy and modify the template
cp scripts/create-workspace-feature-flag.js scripts/create-my-feature-flag.js

# Edit the configuration
# Run creation
node scripts/create-my-feature-flag.js
```

## Monitoring

### Track Feature Usage
```typescript
const feature = useFeatureFlag('my_feature');

useEffect(() => {
  if (feature) {
    trackEvent('feature_flag_exposed', {
      flag: 'my_feature',
      variant: 'enabled'
    });
  }
}, [feature]);
```

### Performance Impact
```typescript
// Measure feature performance
const startTime = performance.now();

// Feature code here

trackEvent('feature_performance', {
  flag: 'my_feature',
  duration: performance.now() - startTime
});
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Flag not updating | `posthog.reloadFeatureFlags()` |
| User not in cohort | Check `posthog.get_property('cohorts')` |
| Flag always false | Verify cohort membership and flag config |
| Network errors | Check PostHog API status |

## Environment Variables

```bash
# Required for feature flags
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://us.i.posthog.com

# For API scripts only
POSTHOG_PERSONAL_API_KEY=phx_xxx
POSTHOG_PROJECT_ID=173101
```