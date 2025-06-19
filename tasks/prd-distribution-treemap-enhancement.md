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

### What Exists ✅ (Implemented)
- Treemap showing four quadrants (New Features, Maintenance, Refactoring, Refinement)
- Color-coded sections with PR counts
- Click to filter PR list functionality
- Smooth transitions and hover effects
- **NEW**: Clean overview state with just quadrant names/counts
- **NEW**: Drill-down functionality with breadcrumb navigation
- **NEW**: Avatar-only contributor nodes on drill-down
- **NEW**: Hover tooltips showing contributor names and PR counts
- **NEW**: Hierarchical data structure (Quadrant → Contributors → PRs)

### Current Issues & Feedback 🔄 NEEDS REFINEMENT
- **User Experience**: Need to clarify the exact user experience vision
- **Drill-down Animation**: May need refinement of the animation/transition style
- **Avatar Layout**: Avatar sizing and layout might need adjustment based on feedback
- **PR Preview**: Functionality works but may need enhancement
- **Visual Polish**: Overall visual design and spacing might need refinement

### What's Working Well ✅
1. **Clean Overview**: Shows just quadrant names and PR counts (not busy)
2. **Smooth Drill-down**: Click quadrant → expands to full space with contributors
3. **Space-efficient**: Avatar-only nodes save space effectively
4. **Hover Information**: Tooltips reveal names and PR counts on hover
5. **Breadcrumb Navigation**: Easy return to overview state
6. **Error Handling**: Fixed undefined property access issues

### Potential Areas for Improvement 🤔
1. **Animation Style**: Current 400ms scale animation - may need different approach
2. **Avatar Sizing**: Currently 24-60px responsive - may need adjustment
3. **Contributor Density**: How many contributors to show before grouping "Others"
4. **PR List Integration**: "View all" functionality not yet connected to main PR list
5. **Visual Hierarchy**: May need better visual distinction between states

## Implementation Plan

### Phase 1: Data Structure Enhancement (HIGH PRIORITY) ✅ COMPLETED
- [x] Create hierarchical data structure: Quadrant → Contributors → PRs
- [x] Add contributor aggregation within each quadrant
- [x] Calculate contributor percentages within quadrants
- [x] Maintain existing quadrant colors for consistency

**Acceptance Criteria:** ✅ COMPLETED
- Data structure supports two levels: quadrant and contributor
- Each contributor node includes avatar URL, username, PR count for that quadrant
- Percentages calculated correctly at both levels

### Phase 2: Drill-Down Navigation (HIGH PRIORITY) ✅ COMPLETED
- [x] Implement zoom-in animation when clicking a quadrant
- [x] Show contributor nodes within the selected quadrant
- [x] Add breadcrumb navigation (e.g., "All Contributions > New Features")
- [x] Implement zoom-out functionality to return to overview
- [x] Maintain smooth transitions during navigation

**Acceptance Criteria:** ✅ COMPLETED
- Clicking a quadrant smoothly zooms to show only that quadrant
- Contributor nodes display with proper sizing based on contribution count
- Breadcrumb allows one-click return to overview
- Animations are smooth and performant

### Phase 3: Contributor Nodes (MEDIUM PRIORITY) ✅ PARTIALLY COMPLETED
- [x] Create custom contributor node component
- [x] Display avatar (responsive sizing 24-60px with white border)
- [x] ~~Show username and PR count~~ **CHANGED**: Avatar-only for space efficiency
- [x] Apply quadrant color as background with proper contrast
- [x] Handle text overflow - **CHANGED**: No text shown, avatars only
- [x] Hide labels for nodes too small to display text

**Acceptance Criteria:** ✅ COMPLETED (Modified)
- Avatars load with proper fallback
- ~~Text is readable on colored backgrounds~~ **N/A**: No text displayed
- Small nodes gracefully hide avatars when too small
- Hover states work correctly

### Phase 4: Inline PR Preview (MEDIUM PRIORITY) ✅ PARTIALLY COMPLETED
- [x] Add hover interaction to contributor nodes
- [x] Display floating PR list on hover
- [x] Show PR title, number, and additions/deletions
- [x] Limit to 5 most recent PRs with "view all" option
- [x] Position tooltip to avoid viewport edges

**Acceptance Criteria:** ✅ COMPLETED
- PR preview appears on hover without blocking other interactions
- Preview shows relevant PRs for that contributor + quadrant combination
- ~~Clicking "view all" updates the main PR list~~ **PENDING**: Not yet implemented
- Tooltip positioning works correctly

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
  Overview State:
  ┌─────────────────────────────────┐
  │ Refinement       │ New Feat   │
  │   85 PRs          │  120 PRs       │
  ├─────────────────────┼─────────────────┤
  │ Maintenance    │ Refactor     │
  │   45 PRs          │   95 PRs       │
  └─────────────────────────────────────┘
  ```

   click on refinement I should see this

    Overview State:
  ┌─────────────────────────────────┐
  │ Refinement    👤👤               |
  │   85 PRs      👤                |
  ├┤
  │                                 │
  │                                 │   
     ─────────────────────┼──────────
**Drilled-Down State (New Features):**
```
Breadcrumb: All > New Features

┌─────────────────────────────────┐
│  👤                │ 👤          │
│  54                │ 36         │
├───────────────────┼─────────────┤
│  👤                │ 👥          │
│  18               │ 12 │
└─────────────────────────────────┘
```
on hover

bob 
54 prs
pr 1 description
pr 2 description



## Implementation Notes

- Build on existing distribution-charts.tsx component
- Reuse existing color constants and transitions
- Integrate with current selectedQuadrant state
- Ensure mobile responsiveness (stack vertically on small screens)
- Add loading states during data transformation
- Handle edge cases (no contributors, single contributor dominance)