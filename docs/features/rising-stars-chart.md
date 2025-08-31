# Rising Stars Chart

## Overview

The Rising Stars Chart is a bubble visualization designed to identify and recognize high-velocity contributors who deserve recognition. Created specifically for the Vercel AI SDK team's needs, it provides a single place to find contributors with growing momentum.

## Visual Design

- **X-axis**: Code Contributions (PRs + Commits)
- **Y-axis**: Non-Code Contributions (Issues + Comments + Reviews + Discussions)  
- **Bubble Size**: Velocity score (activity momentum over time)
- **Avatar Display**: Contributors shown as profile pictures, not abstract dots

## Visual Indicators

- **🟢 Green Border**: New contributors (<90 days)
- **🔵 Blue Border**: Active contributors
- **✨ Pulsing Orange Ring**: Rising stars (velocity >10/week AND contributor age <180 days)
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
  github_id: number;
  commits: number;           // X-axis component
  pullRequests: number;       // X-axis component  
  issues: number;            // Y-axis component
  comments?: number;         // Y-axis component
  reviews?: number;          // Y-axis component
  discussions?: number;      // Y-axis component
  totalActivity: number;     // Sum of all GitHub events (PRs + commits + issues + comments + reviews + discussions)
  velocityScore: number;     // Bubble size & rising star criteria
  growthRate: number;        // % increase shown in hover
  isNewContributor: boolean; // Green border (<90 days)
  isRisingStar: boolean;     // Orange pulsing ring
  firstContributionDate: string;
  lastContributionDate: string;
  contributionSpan: number;
}
```

## Interactive Features

### Hover Cards
Hovering over a contributor bubble shows:
- Username and avatar
- Activity badges (Rising Star, New)
- Growth rate percentage (if positive)
- Activity breakdown (PRs, Commits, Issues)
- Activity Score (sum of all GitHub events: PRs + commits + issues + comments + reviews + discussions)
- Velocity (contributions/week)
- Contributing duration (in days)

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
- **Z-index Management**: Uses Radix UI Portal for proper hover card layering
- **No External Chart Library**: Custom implementation avoids heavy dependencies

## Storybook Stories

View examples in Storybook:
- **Default**: Standard view with mixed contributors
- **ManyContributors**: High-density visualization (50 contributors)
- **FewContributors**: Low-density visualization (10 contributors)
- **EmptyState**: Handles no data gracefully

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