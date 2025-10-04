# PRD: User Documentation Image Replacement Plan

**Status**: OBSOLETE - Documentation migrated to Mintlify (see feat/mintlify-docs-406)

## Project Overview

### Objective
~~Replace all placeholder images and add necessary visual content to the 16 user documentation files in `/public/docs/` to enhance user understanding and engagement.~~

**UPDATE**: Documentation has been migrated from `/public/docs/` to Mintlify (`mintlify-docs/`). This PRD is no longer applicable. Visual content should now be added to Mintlify documentation following their image standards.

### Background
~~The user documentation currently lacks visual elements that would help users understand features, navigate the interface, and visualize data patterns. This project aims to add screenshots, diagrams, and visual aids following the design language of contributor.info.~~

**UPDATE**: The in-app documentation system has been replaced with Mintlify-hosted documentation. See `mintlify-docs/` directory and https://docs.contributor.info for the new documentation system.

### Success Metrics
- All 16 documentation files have appropriate visual content
- Zero placeholder images remain
- Visual consistency across all documentation
- Improved user comprehension of features

## Current State Analysis

### Documentation Structure
16 markdown files in `/public/docs/`:
- Feature documentation (11 files)
- Insight documentation (4 files)  
- Guide documentation (1 file)

### Visual Needs Assessment
Currently NO images exist in any documentation files. Each feature needs:
- Feature overview screenshots
- Step-by-step workflow images
- Data visualization examples
- UI element highlights

## Implementation Plan

### Phase 1: Core Feature Screenshots (HIGH PRIORITY)
**Timeline**: 1-2 days

#### 1. Repository Search & Navigation
- [ ] Homepage with featured repositories
- [ ] Search bar with example queries
- [ ] Search results display
- [ ] Repository loading states
- [ ] Multi-tab navigation (Contributions, Health, Distribution, Feed)

#### 2. Contribution Analytics
- [ ] Quadrant scatter plot visualization
- [ ] Contributor mapping examples
- [ ] Time series analysis charts
- [ ] Filter controls and options
- [ ] Hover states and tooltips

#### 3. Repository Health Dashboard
- [ ] Lottery factor visualization
- [ ] Risk level indicators (color-coded)
- [ ] YOLO coders section
- [ ] Health trend graphs
- [ ] Key metrics display

#### 4. Distribution Charts
- [ ] Language distribution treemap
- [ ] Contribution pattern graphs
- [ ] Time range comparisons
- [ ] Interactive filtering examples

### Phase 2: Advanced Features & Insights (MEDIUM PRIORITY)
**Timeline**: 1-2 days

#### 5. Contributor Profiles
- [ ] Profile hover cards
- [ ] Detailed profile views
- [ ] Specialization badges
- [ ] Activity timelines
- [ ] Statistics displays

#### 6. Activity Feed
- [ ] Pull request timeline
- [ ] Real-time updates
- [ ] Velocity indicators
- [ ] Contributor highlights
- [ ] Filter options

#### 7. Contributor of the Month
- [ ] Winner announcement display
- [ ] Leaderboard view
- [ ] Ranking transitions
- [ ] Profile integration

#### 8. Time Range Analysis
- [ ] Time selector UI
- [ ] Comparative analysis views
- [ ] Trend indicators
- [ ] Period transition animations

### Phase 3: Supporting Features & Insights (LOW PRIORITY)
**Timeline**: 1 day

#### 9. Authentication Flow
- [ ] GitHub OAuth login button
- [ ] Progressive enhancement examples
- [ ] Public vs authenticated features comparison

#### 10. Social Cards
- [ ] Home page card examples
- [ ] Repository-specific cards
- [ ] Mobile optimization views

#### 11. Insight Dashboards
- [ ] Needs Attention scoring display
- [ ] PR Activity metrics
- [ ] Recommendations panel
- [ ] Repository Health summary

#### 12. Contributor Confidence Guide
- [ ] Confidence level indicators
- [ ] Color-coded examples
- [ ] Algorithm visualization diagram

## Technical Guidelines

### Screenshot Standards
1. **Resolution**: 1440x900 (Retina display, 2x for clarity)
2. **Format**: WebP for web optimization, PNG for fallback
3. **Compression**: Optimize for <200KB per image
4. **Naming**: `feature-name-description.webp` (e.g., `repository-search-homepage.webp`)

### Visual Design Requirements
1. **Browser**: Chrome/Edge in light mode
2. **Data**: Use real repositories (React, VSCode, etc.) for authentic examples
3. **State**: Show populated states with meaningful data
4. **Annotations**: Add arrows/highlights for specific UI elements when needed

### File Organization
```
public/
  docs/
    images/
      features/
        repository-search/
        contribution-analytics/
        repository-health/
        distribution-charts/
        contributor-profiles/
        activity-feed/
        contributor-of-month/
        time-range-analysis/
        authentication/
        social-cards/
      insights/
        needs-attention/
        pr-activity/
        recommendations/
        repository-health/
      guides/
        contributor-confidence/
```

### Markdown Integration
```markdown
![Repository search homepage](/docs/images/features/repository-search/homepage.webp)
*Caption: Featured repositories on the contributor.info homepage*
```

## Acceptance Criteria

### Phase 1 Completion
- [ ] All core feature documentation has at least 3 relevant images
- [ ] Images clearly demonstrate the feature's primary functionality
- [ ] No placeholder or missing images in core features

### Phase 2 Completion  
- [ ] Advanced features have comprehensive visual coverage
- [ ] Complex workflows are illustrated step-by-step
- [ ] Interactive elements are clearly demonstrated

### Phase 3 Completion
- [ ] All 16 documentation files have appropriate images
- [ ] Visual consistency maintained across all docs
- [ ] Image optimization completed (<200KB per image)
- [ ] Alt text provided for accessibility

## Implementation Notes

### Tools Required
1. **Screenshot Tool**: Use browser DevTools for consistent viewport
2. **Image Optimization**: ImageOptim or similar for WebP conversion
3. **Annotation Tool**: For adding arrows/highlights when needed

### Data Requirements
- Active contributor.info instance with real data
- Example repositories loaded (React, VSCode, etcd, etc.)
- Various time ranges of data available
- Test user account for authenticated features

### Quality Checklist
- [ ] Images are clear and readable
- [ ] UI elements are properly visible
- [ ] No sensitive data exposed
- [ ] Consistent visual style maintained
- [ ] File sizes optimized
- [ ] Alt text is descriptive

## Next Steps
1. Set up local environment with production data
2. Create screenshot capture checklist
3. Begin Phase 1 screenshot capture
4. Optimize and integrate images
5. Review and iterate based on feedback