# PRD: Enhanced Distribution Treemap with Drill-Down

## Project Overview

### Objective
Enhance the existing Distribution treemap to provide drill-down capability, allowing users to explore which contributors are responsible for different types of contributions (New Features, Maintenance, Refactoring, Refinement).

### Background
The current distribution treemap shows PR types as colored quadrants but lacks the ability to see which contributors are making these contributions. Users need to understand not just the distribution of work types, but WHO is doing each type of work.

### Success Metrics
- Users can drill into any quadrant to see contributor breakdown
- Reduced clicks needed to understand contributor patterns within PR types
- Improved insights into team specialization and work distribution

## Current State Analysis

### What Exists
- Treemap showing four quadrants (New Features, Maintenance, Refactoring, Refinement)
- Color-coded sections with PR counts
- Click to filter PR list functionality
- Smooth transitions and hover effects

### What's Missing
- No way to see contributors within each quadrant
- No drill-down navigation
- No inline preview of PRs
- No breadcrumb navigation

## Implementation Plan

### Phase 1: Data Structure Enhancement (HIGH PRIORITY)
- [ ] Create hierarchical data structure: Quadrant → Contributors → PRs
- [ ] Add contributor aggregation within each quadrant
- [ ] Calculate contributor percentages within quadrants
- [ ] Maintain existing quadrant colors for consistency

**Acceptance Criteria:**
- Data structure supports two levels: quadrant and contributor
- Each contributor node includes avatar URL, username, PR count for that quadrant
- Percentages calculated correctly at both levels

### Phase 2: Drill-Down Navigation (HIGH PRIORITY)
- [ ] Implement zoom-in animation when clicking a quadrant
- [ ] Show contributor nodes within the selected quadrant
- [ ] Add breadcrumb navigation (e.g., "All Contributions > New Features")
- [ ] Implement zoom-out functionality to return to overview
- [ ] Maintain smooth transitions during navigation

**Acceptance Criteria:**
- Clicking a quadrant smoothly zooms to show only that quadrant
- Contributor nodes display with proper sizing based on contribution count
- Breadcrumb allows one-click return to overview
- Animations are smooth and performant

### Phase 3: Contributor Nodes (MEDIUM PRIORITY)
- [ ] Create custom contributor node component
- [ ] Display avatar (circular, 32px with white border)
- [ ] Show username and PR count
- [ ] Apply quadrant color as background with proper contrast
- [ ] Handle text overflow for long usernames
- [ ] Hide labels for nodes too small to display text

**Acceptance Criteria:**
- Avatars load with proper fallback
- Text is readable on colored backgrounds
- Small nodes gracefully hide text
- Hover states work correctly

### Phase 4: Inline PR Preview (MEDIUM PRIORITY)
- [ ] Add hover interaction to contributor nodes
- [ ] Display floating PR list on hover
- [ ] Show PR title, number, and additions/deletions
- [ ] Limit to 5 most recent PRs with "view all" option
- [ ] Position tooltip to avoid viewport edges

**Acceptance Criteria:**
- PR preview appears on hover without blocking other interactions
- Preview shows relevant PRs for that contributor + quadrant combination
- Clicking "view all" updates the main PR list
- Tooltip positioning is intelligent

### Phase 5: Enhanced Interactivity (LOW PRIORITY)
- [ ] Add keyboard navigation support
- [ ] Implement search within treemap
- [ ] Add export functionality for current view
- [ ] Remember last viewed state in session

**Acceptance Criteria:**
- Arrow keys navigate between nodes
- Search highlights matching contributors
- Export generates image or data of current view
- Refreshing page maintains drill-down state

## Technical Guidelines

### Architecture Decisions
- Extend existing treemap component rather than replacing
- Use Recharts' built-in treemap with custom content renderer
- Leverage existing ContributionAnalyzer for categorization
- Maintain compatibility with existing filters and time ranges

### Data Flow
```
PullRequests → ContributionAnalyzer → Quadrants → Contributors → Treemap
                                          ↓
                                    Drill-down State
                                          ↓
                                    Filtered View
```

### Performance Considerations
- Limit contributors shown to top 20 per quadrant
- Group remaining as "Others" node
- Lazy load avatars
- Memoize hierarchical data transformation

### UI/UX Patterns
- Consistent with existing distribution charts
- Maintain color scheme: Green (Refinement), Blue (New Features), Orange (Refactoring), Purple (Maintenance)
- Use existing animation timing (300ms transitions)
- Follow current hover/selection patterns

## Example User Flow

1. User views Distribution tab treemap showing four quadrants
2. User clicks "New Features" quadrant (Blue)
3. Treemap zooms to show only New Features with contributor breakdown
4. User sees that Alice has 45% of new features, Bob has 30%, Others 25%
5. User hovers over Alice's node
6. Inline preview shows Alice's 5 most recent "New Feature" PRs
7. User clicks breadcrumb to return to overview
8. All transitions are smooth and data updates accordingly

## Visual Mockup Description

**Overview State:**
```
┌─────────────────────────────────┐
│ Refinement (Green) │ New (Blue) │
│     85 PRs        │   120 PRs   │
├───────────────────┼─────────────┤
│ Maintenance (Purp)│ Refact (Org)│
│     45 PRs        │   95 PRs    │
└─────────────────────────────────┘
```

**Drilled-Down State (New Features):**
```
Breadcrumb: All > New Features

┌─────────────────────────────────┐
│  👤 Alice         │ 👤 Bob      │
│  54 PRs (45%)     │ 36 PRs (30%)│
├───────────────────┼─────────────┤
│  👤 Charlie       │ 👥 Others   │
│  18 PRs (15%)     │ 12 PRs (10%)│
└─────────────────────────────────┘
```

## Implementation Notes

- Build on existing distribution-charts.tsx component
- Reuse existing color constants and transitions
- Integrate with current selectedQuadrant state
- Ensure mobile responsiveness (stack vertically on small screens)
- Add loading states during data transformation
- Handle edge cases (no contributors, single contributor dominance)