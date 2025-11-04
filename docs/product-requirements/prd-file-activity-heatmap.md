# PRD: File Activity Heatmap Visualization

## Overview
We need to explore different heatmap chart implementations to visualize file activity patterns (files touched, modification frequency, etc.) in the Continue codebase. This will help identify hotspots and patterns in our development workflow.

## Requirements
- Create Storybook stories for comparing heatmap implementations
- Support showing file paths on Y-axis and time periods (days/weeks) on X-axis
- Color intensity should represent frequency of changes
- Must handle 100+ files efficiently
- Interactive tooltips showing exact counts
- Responsive design

## Libraries to Evaluate

### 1. @nivo/heatmap
- **Pros**: Built-in animations, rich interactivity, professional appearance
- **Cons**: Larger bundle size
- **Story variants needed**: basic, with custom colors, with legends, dense data (100+ files)

### 2. Recharts (already in dependencies)
- **Pros**: Lightweight, flexible, already in use for other charts
- **Cons**: No native heatmap component (needs custom implementation)
- **Story variants needed**: ScatterChart approach, custom grid component

### 3. visx/heatmap (optional)
- **Pros**: D3-based, highly customizable
- **Consider if**: The above don't meet needs

## Data Structure Examples

```javascript
// Example data structure for file activity
const fileActivityData = {
  weekly: [
    { file: 'src/index.ts', week1: 12, week2: 8, week3: 15, week4: 23 },
    { file: 'src/components/Button.tsx', week1: 5, week2: 18, week3: 7, week4: 9 }
  ],
  daily: [
    { file: 'src/index.ts', mon: 3, tue: 8, wed: 12, thu: 4, fri: 9 },
    { file: 'src/utils/api.ts', mon: 15, tue: 2, wed: 7, thu: 11, fri: 6 }
  ]
}
```

## Storybook Structure

```
src/stories/
  visualizations/
    FileHeatmap/
      NivoHeatmap.stories.tsx
      RechartsHeatmap.stories.tsx
      FileHeatmap.utils.ts (shared utilities)
      mockData.ts
```

## Acceptance Criteria
- [ ] Create at least 3 story variants per library showing different data densities
- [ ] Include performance comparison with 100+ files
- [ ] Document pros/cons of each approach in story descriptions
- [ ] Add controls for color schemes, time ranges, and data density
- [ ] Include example of real file activity data from git history
- [ ] Provide recommendations for production use

## Implementation Tasks
- [ ] Set up new Storybook category for data visualizations
- [ ] Install required dependencies (@nivo/heatmap, etc.)
- [ ] Create mock data generator for different scenarios
- [ ] Implement Nivo heatmap stories
- [ ] Implement Recharts heatmap stories
- [ ] Add performance monitoring/comparison
- [ ] Document findings in story descriptions
- [ ] Create utils for transforming git data to heatmap format

## Questions to Answer
1. Which library performs best with 100+ files?
2. Which provides the best mobile experience?
3. Bundle size impact of each option?
4. Which is easiest to integrate with our existing design system?
5. Accessibility considerations for each?

## References
- [Nivo Heatmap docs](https://nivo.rocks/heatmap/)
- [Recharts examples](https://recharts.org/en-US/examples)
- [GitHub's contribution graph](https://github.com) (inspiration)

## Next Steps
Once the exploration is complete, we'll use the findings to implement a production-ready heatmap visualization for tracking file activity patterns in the codebase.

---
**Issue Labels**: `enhancement`, `storybook`, `components`, `frontend`

**Issue Title**: Explore heatmap visualizations for file activity tracking
