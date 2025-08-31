# Rising Stars Chart

## Overview

The Rising Stars Chart is a bubble visualization designed to identify and recognize high-velocity contributors who deserve recognition. Created specifically for the Vercel AI SDK team's needs, it provides a single place to find contributors with growing momentum.

## Visual Design

- **X-axis**: Number of commits (code velocity)
- **Y-axis**: Pull Requests + Issues (engagement level)  
- **Bubble Size**: Velocity score (activity momentum over time)
- **Avatar Display**: Contributors shown as profile pictures, not abstract dots

## Visual Indicators

- **🟢 Green Bubbles**: New contributors (<90 days)
- **🔵 Blue Bubbles**: Active contributors
- **✨ Pulsing Orange Ring**: Rising stars (>50% growth rate)
- **🔴 Red Dot**: High velocity indicator (>5 contributions/week)

## Usage

```tsx
import { RisingStarsChart } from '@/components/features/analytics/RisingStarsChart';
import { calculateRisingStars } from '@/lib/analytics/rising-stars-data';

// Transform your contributor data
const chartData = calculateRisingStars(contributorMetrics, {
  timeWindowDays: 30,    // Analysis period
  minActivity: 3,        // Minimum activity threshold
  newContributorDays: 90 // Days to consider "new"
});

// Render the chart
<RisingStarsChart 
  data={chartData}
  height={500}
  maxBubbles={50}
/>
```

## Data Structure

```typescript
interface RisingStarContributor {
  login: string;
  avatar_url: string;
  commits: number;           // X-axis position
  pullRequests: number;       // Y-axis component
  issues: number;            // Y-axis component
  velocityScore: number;     // Bubble size
  growthRate: number;        // % increase
  isNewContributor: boolean; // Green indicator
  isRisingStar: boolean;     // Pulsing ring
}
```

## Interactive Features

### Hover Cards
Hovering over a contributor bubble shows:
- Username and avatar
- Activity badges (Rising Star, New)
- Growth rate percentage
- Activity breakdown (PRs, Commits, Issues)
- Velocity score (contributions/week)
- Contributing duration

## Integration Points

### With Workspace Dashboard
The chart can be integrated into the workspace page to show rising stars across all tracked repositories:

```tsx
// In workspace-page.tsx
import { RisingStarsChart } from '@/components/features/analytics/RisingStarsChart';

// Use with workspace contributor data
const risingStars = calculateRisingStars(workspaceContributors);
```

### With Repository View
Can also be used at the repository level to identify rising stars within a single project.

## Performance Considerations

- **Max Bubbles**: Limited to 50 by default to maintain performance
- **Data Transformation**: Cached using `useMemo` 
- **Avatar Loading**: Uses GitHub CDN for fast avatar delivery

## Storybook Stories

View examples in Storybook:
- **Default**: Standard view with mixed contributors
- **ManyContributors**: High-density visualization
- **HighActivity**: Power users with large velocity scores
- **NewContributorsWave**: Emphasis on new contributors
- **CompactView**: Smaller height for dashboards

## Use Cases

1. **Weekly Recognition**: Identify contributors to thank publicly
2. **Mentorship Targeting**: Find rising stars who could benefit from guidance
3. **Community Health**: Track new contributor onboarding success
4. **Engagement Metrics**: Visualize overall community velocity

## Future Enhancements

- Time range selector (7/30/90 days)
- Export list of rising stars
- Click-through to contributor profile
- Trend lines showing velocity changes
- Filtering by contribution type