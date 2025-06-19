# PRD: Contributor Activity Treemap

## Project Overview

### Objective
Create a new treemap visualization on the Activity page that shows contributor activity levels, allowing users to quickly identify the most active contributors and explore their contributions.

### Background
While the Distribution tab focuses on PR types, the Activity page needs a way to visualize WHO is contributing and HOW MUCH. This treemap will complement existing activity charts by providing a space-efficient view of contributor engagement.

### Success Metrics
- Users can identify top contributors at a glance
- Improved understanding of contributor distribution (80/20 rule visualization)
- Faster navigation to individual contributor details
- Increased engagement with contributor data

## Current State Analysis

### What Exists
- Activity page with contribution timelines
- Contributor cards with basic stats
- PR activity lists
- Time range filters

### What's Missing
- Visual representation of contributor volume
- Quick comparison of contributor activity levels
- Grouped view of smaller contributors
- Space-efficient contributor overview

## Implementation Plan

### Phase 1: Component Architecture (HIGH PRIORITY)
- [ ] Create new ContributorTreemap component
- [ ] Add treemap as option to Activity page alongside existing views
- [ ] Set up data fetching and transformation pipeline
- [ ] Integrate with existing time range filters

**Acceptance Criteria:**
- New component follows existing patterns
- Treemap appears as selectable view option
- Data updates with time range changes
- Loading states match existing components

### Phase 2: Data Transformation (HIGH PRIORITY)
- [ ] Transform contributor data for treemap format
- [ ] Calculate relative sizes based on PR count
- [ ] Sort and limit to top contributors
- [ ] Group remaining contributors as "Others"
- [ ] Include necessary metadata (avatar, username, stats)

**Acceptance Criteria:**
- Top 30 contributors shown individually
- Remaining grouped as "Others" with count
- Sizes accurately reflect contribution volume
- Data includes all needed display fields

### Phase 3: Contributor Node Design (HIGH PRIORITY)
- [ ] Create ContributorNode component
- [ ] Display circular avatar (42px) with white border
- [ ] Show username with proper truncation
- [ ] Display contribution count
- [ ] Apply consistent color scheme
- [ ] Handle various node sizes gracefully

**Acceptance Criteria:**
- Avatars load with letter-based fallbacks
- Text remains readable at different sizes
- Small nodes hide text appropriately
- Consistent visual style with app design

### Phase 4: Interactivity (MEDIUM PRIORITY)
- [ ] Implement click to view contributor details
- [ ] Add hover effects and tooltips
- [ ] Create smooth transitions
- [ ] Connect to existing contributor detail views
- [ ] Add contribution breakdown in tooltip

**Acceptance Criteria:**
- Clicking opens contributor profile/details
- Hover shows extended information
- Transitions are smooth (300ms)
- Navigation feels intuitive

### Phase 5: Visual Polish (MEDIUM PRIORITY)
- [ ] Implement gradient color scheme
- [ ] Add subtle shadows and borders
- [ ] Create loading skeleton specific to treemap
- [ ] Add empty state for no contributors
- [ ] Ensure mobile responsiveness

**Acceptance Criteria:**
- Consistent color palette (consider using contribution heat)
- Professional appearance matching app aesthetic
- Smooth loading experience
- Graceful handling of edge cases

### Phase 6: Advanced Features (LOW PRIORITY)
- [ ] Add animation on initial load
- [ ] Implement contribution type badges
- [ ] Add search/filter within treemap
- [ ] Create export functionality
- [ ] Add comparison mode (period over period)

**Acceptance Criteria:**
- Animations enhance not distract
- Badges provide additional context
- Search highlights matching nodes
- Export includes current view state

## Technical Guidelines

### Architecture Decisions
- Use Recharts ResponsiveTreemap for consistency
- Create as separate component from distribution treemap
- Reuse existing avatar components
- Leverage existing data fetching patterns

### Component Structure
```
ActivityPage
  └── ViewToggle (List | Timeline | Treemap)
  └── ContributorTreemap
       ├── TreemapContainer
       ├── ContributorNode
       ├── OthersNode
       └── TreemapTooltip
```

### Data Structure
```typescript
interface TreemapData {
  name: string;
  value: number; // PR count
  contributor: {
    login: string;
    avatar_url: string;
    id: number;
    recentActivity: Date;
    prCount: number;
    additions: number;
    deletions: number;
  };
  color?: string;
}
```

### Performance Considerations
- Virtualize if more than 50 nodes
- Lazy load avatars with intersection observer
- Memoize data transformations
- Limit "Others" expansion to prevent overload

### Styling Guidelines
- Use CSS-in-JS pattern consistent with codebase
- Apply existing spacing variables
- Maintain existing breakpoints for responsiveness
- Follow current shadow and border radius patterns

## Example User Flow

1. User navigates to Activity page
2. User clicks "Treemap" view option
3. Treemap loads showing contributor boxes sized by activity
4. User sees "alice" has the largest box with "245 PRs"
5. User hovers over "alice" to see tooltip with recent activity
6. User clicks on "alice" to navigate to her contributor page
7. User clicks "Others (45 contributors)" to see grouped contributors

## Visual Mockup Description

```
┌─────────────────────────────────────────┐
│ ┌─────────────┐ ┌───────┐ ┌───────────┐ │
│ │ 👤 alice    │ │👤 bob │ │ 👤 charlie │ │
│ │ 245 PRs     │ │120 PRs│ │ 98 PRs    │ │
│ │             │ └───────┘ └───────────┘ │
│ │             │ ┌───────────────────────┐│
│ └─────────────┘ │ 👤 david - 67 PRs    ││
│ ┌─────────────┐ └───────────────────────┘│
│ │👤 eve-45 PRs│ ┌────────┐┌────────────┐ │
│ └─────────────┘ │👥Others││👤 frank-22 ││
│                 │45 users││            ││
│                 └────────┘└────────────┘ │
└─────────────────────────────────────────┘
```

## Mobile Considerations

- Stack view toggle buttons vertically
- Reduce avatar size to 32px on mobile
- Show only username (hide PR count) on small nodes
- Consider vertical scroll for many contributors
- Tap to show tooltip instead of hover

## Integration Points

- Reuse existing contributor data fetching
- Connect to existing contributor profile routes
- Integrate with time range selector
- Use existing loading/error states
- Maintain consistent navigation patterns

## Comparison with Distribution Treemap

| Feature | Distribution Treemap | Contributor Treemap |
|---------|---------------------|-------------------|
| Focus | PR Types | Contributors |
| Location | Distribution Tab | Activity Page |
| Hierarchy | Type → Contributor | Contributor only |
| Colors | Quadrant-based | Gradient/uniform |
| Primary Question | "What type of work?" | "Who's contributing?" |

## Future Enhancements

- Organization-based grouping
- Time-based animation (show growth)
- Contribution quality metrics (not just quantity)
- Team comparison mode
- AI-suggested contributor groupings