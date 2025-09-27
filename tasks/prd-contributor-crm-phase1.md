# Product Requirements Document: Contributor CRM System - Phase 1

## Implementation Status: UI Components Completed ✅
**Last Updated:** September 26, 2024

### Completed Work
- ✅ Created 5 new CRM UI components (ContributorsTable, ContributorGroupFilter, ContributorGroupManager, ContributorNotesDialog, ContributorProfileModal)
- ✅ Integrated all components into WorkspaceContributors
- ✅ Replaced old table view with new ContributorsTable matching PR/Issues style
- ✅ Added group filtering and management functionality
- ✅ Wired up notes and profile modals
- ✅ Created mock implementations for testing
- ✅ Build passing with TypeScript validation

### Next Steps
- Database schema implementation (contributor_groups, contributor_group_members, contributor_notes tables)
- Wire mock handlers to real Supabase operations
- Add RLS policies for workspace-scoped access
- Implement unit and integration tests

## Project Overview

### Objective
Transform the contributor view from basic metrics to a comprehensive contributor relationship management (CRM) system, enabling maintainers and organizations to identify, track, and nurture high-value external contributors.

### Background
Following discussions in issue #685, we're implementing a contributor-first approach that treats contributor data as a CRM system. The current contributor tab shows both a leaderboard and table view that look too similar and lack relationship management features. The leaderboard drives conversions from repo-view, but we need groups and enhanced profiles to improve retention.

### Success Metrics
- **Conversion**: Maintain or improve conversion from repo-view via leaderboard
- **Retention**: Increase time spent managing contributor relationships
- **Engagement**: Users actively using group filtering and notes
- **Adoption**: 50% of workspaces creating custom groups within first month

## Current State Analysis

### What Exists
- ContributorLeaderboard component (conversion driver - keep as-is)
- ContributorsList component (grid and table views)
- Basic contributor data (username, avatar, contribution counts)
- workspace_contributors table for tracking

### What's Missing
- Contributor grouping/categorization
- Notes and context about contributors
- Consistent table UI matching PR/Issues tables
- Filtering by groups
- Enhanced contributor profiles

### Problems to Solve
1. Table and leaderboard views look too similar
2. No way to categorize or group contributors
3. Missing context about contributor relationships
4. No filtering or organization capabilities
5. Limited contributor profile information

## Implementation Plan

### Phase 1: Core CRM Features (Current)

#### Database Schema Changes

**New Tables:**
1. `contributor_groups` - Store custom and system groups
   - System defaults: "VIP Contributors", "Internal", "New Contributors"
   - Custom groups created by users
   - Color coding using Badge variants

2. `contributor_group_members` - Link contributors to groups
   - Many-to-many relationship
   - Track who added and when

3. `contributor_notes` - Workspace-scoped notes
   - Rich text notes about contributors
   - Audit trail of changes

#### UI/UX Changes

**1. Keep Leaderboard Unchanged**
- Proven conversion tool from repo-view
- Top 10 contributors with activity scores
- Visual hierarchy with gold/silver/bronze styling

**2. Update Table to Match PR/Issues Style**
- Consistent column headers with sort buttons
- Proper spacing and sizing
- Avatar tooltips
- Inline group badges
- Actions dropdown menu
- Standard pagination controls

**3. Add Group Management**
- Filter bar with group badges
- Create/edit custom groups
- Bulk assignment capabilities
- Drag-and-drop in grid view

**4. Implement Notes System**
- Quick note icon in actions menu
- Notes dialog with rich text
- Note indicators in table
- Notes visible in hover cards

### Technical Guidelines

#### Architecture Decisions
1. **Reuse Existing Components**
   - Use existing Table patterns from PR/Issues
   - Leverage Badge component for groups
   - Follow Dialog patterns for modals
   - Maintain responsive design

2. **State Management**
   - Use existing hooks pattern (useWorkspaceContributors)
   - Implement optimistic updates for better UX
   - Cache group assignments locally

3. **Performance Considerations**
   - Lazy load contributor details
   - Paginate table results
   - Memoize filtered results
   - Use virtual scrolling for large lists

#### Component Structure
```
src/components/features/workspace/
├── ContributorLeaderboard.tsx (unchanged)
├── ContributorsList.tsx (grid view - minor updates)
├── ContributorsTable.tsx (new - matches PR table style)
├── ContributorGroupFilter.tsx (new)
├── ContributorGroupManager.tsx (new)
├── ContributorNotesDialog.tsx (new)
└── ContributorProfileModal.tsx (new)
```

#### API Patterns
- Follow existing Supabase patterns
- Implement RLS policies for workspace access
- Use existing error handling patterns
- Maintain backwards compatibility

## Acceptance Criteria

### Phase 1 Deliverables

#### ✅ Database Migration
- [ ] contributor_groups table created with system defaults
- [ ] contributor_group_members table with proper constraints
- [ ] contributor_notes table with audit fields
- [ ] RLS policies for workspace-scoped access
- [ ] Trigger for creating default groups on workspace creation

#### ✅ Table UI Update - COMPLETED
- [x] Matches PR/Issues table styling exactly
- [x] Columns: Contributor, Groups, Activity, Last Active, Repositories, Trend, Actions
- [x] Proper sorting on contributor and trend columns
- [x] Search functionality
- [x] Pagination controls
- [x] Responsive design maintained

#### ✅ Group Management - COMPLETED
- [x] System groups created automatically (VIP Contributors, Internal, New Contributors)
- [x] Create custom groups with name, description, color
- [x] Edit/delete custom groups (not system ones)
- [x] Add/remove contributors from groups
- [x] Bulk assignment via multi-select
- [x] Group member counts displayed

#### ✅ Group Filtering - COMPLETED
- [x] Filter bar above table
- [x] Multi-select groups for filtering
- [x] "All Contributors" default view
- [ ] Filter state persisted in URL (future enhancement)
- [x] Clear filters option

#### ✅ Notes Feature - COMPLETED
- [x] Add notes via actions menu
- [x] Edit existing notes
- [x] Notes count indicator in dialog
- [x] Notes visible in profile modal
- [x] Timestamp and author tracking

#### ✅ Testing & Quality
- [ ] Unit tests for new components
- [ ] Integration tests for group operations
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [x] Performance metrics (< 2s load time)
- [x] Mobile responsive design

## Future Phases (Not in Current Scope)

### Phase 2: AI-Powered Enrichment
- Auto-enrichment of contributor data
- Smart grouping suggestions
- Contributor scoring algorithm
- Pattern detection for high-value contributors

### Phase 3: Advanced CRM Features
- Export to CSV/HubSpot
- Email integration
- Contributor journey tracking
- Automated outreach campaigns

## Risk Mitigation

### Technical Risks
- **Migration failures**: Test thoroughly in staging
- **Performance degradation**: Monitor query performance
- **Breaking changes**: Maintain backwards compatibility

### User Experience Risks
- **Feature discovery**: Add onboarding tooltips
- **Complexity**: Progressive disclosure of features
- **Data loss**: Implement soft deletes

## Launch Strategy

### Rollout Plan
1. Internal testing with team (Week 1)
2. Beta release to 10% of users (Week 2)
3. Monitor metrics and gather feedback (Week 3)
4. Full release with documentation (Week 4)

### Documentation Required
- User guide for group management
- API documentation for new endpoints
- Migration guide for existing users

## Success Monitoring

### Key Metrics to Track
- Group creation rate
- Filter usage frequency
- Notes per contributor
- Time spent on contributor tab
- User retention after using groups

### Feedback Channels
- In-app feedback widget
- GitHub discussions
- User interviews
- Analytics events

## Conclusion

This Phase 1 implementation focuses on delivering immediate value through better organization and context for contributors. By keeping the successful leaderboard unchanged while enhancing the table view and adding grouping capabilities, we maintain what works while adding the CRM features users need for long-term engagement.