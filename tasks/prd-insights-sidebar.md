# Product Requirements Document: Insights Sidebar Feature

## Project Overview

### Objective
Create an intelligent chat sidebar that provides actionable insights about repository health, pull request management, and contributor activity. This feature will transform raw GitHub data into meaningful observations and recommendations to help maintainers and contributors make informed decisions.

### Background
Repository maintainers need quick access to key insights about their project's health without manually analyzing multiple data points. The current insights-drawer.tsx provides basic PR analysis, but we need a more comprehensive, always-accessible sidebar that surfaces critical information proactively.

### Success Metrics
- **Engagement**: 40% of repository page visitors interact with the insights sidebar
- **Actionability**: 25% of insights lead to observable maintainer actions (PR reviews, issue creation, process changes)
- **User Satisfaction**: 85% positive feedback score from power users
- **Performance**: Insights load within 2 seconds
- **Usage**: 60% of logged-in users access insights at least once per session

## Current State Analysis

### What Exists
- **InsightsDrawer**: Fixed-position button with basic PR analysis (merge times, contributor distribution, health assessment)
- **PR Activity Feed**: Comprehensive activity tracking with filtering capabilities 
- **Supabase Integration**: Complete schema for contributors, PRs, reviews, comments, and analytics
- **GitHub API Integration**: Pull requests, reviews, comments, direct commits, and YOLO coders data
- **Contributor Analytics**: Monthly rankings, daily activity snapshots

### What's Missing
- **Proactive Insights**: No automated detection of PRs needing attention or guideline violations
- **Release-Based Analysis**: No tracking of new PRs since last release
- **Contextual Health Assessment**: Basic health metrics exist but need deeper analysis
- **Always-Visible Interface**: Current drawer is hidden by default

### Current Pain Points
- Users must manually trigger insights generation
- No real-time alerts for critical issues
- Limited historical context
- No integration with contributing guidelines
- Insights are not contextual to current repository state

## Implementation Plan

### Phase 1: Core Sidebar Infrastructure (HIGH PRIORITY)
**Timeline**: Days 1-3

**Deliverables**:
- Replace floating insights button with persistent sidebar
- Implement collapsible/expandable interface
- Add loading states and error handling
- Integrate with existing time range controls
- Mobile-responsive design

**Acceptance Criteria**:
- ✅ Sidebar visible on all repository pages
- ✅ Smooth expand/collapse animations
- ✅ Responsive design (mobile: overlay, desktop: sidebar)
- ✅ Consistent with existing design system
- ✅ Accessibility compliant (keyboard navigation, screen reader support)

### Phase 2: PR Attention Detection (HIGH PRIORITY)
**Timeline**: Days 4-6

**Deliverables**:
- Awaiting review detection algorithm
- Contributing.md guideline compliance checker
- PR urgency scoring system
- Real-time notifications for critical PRs

**Technical Requirements**:
- Parse CONTRIBUTING.md for title/description patterns
- Implement PR age-based urgency scoring
- Create review request tracking
- Add urgency indicators (red/yellow/green)

**Acceptance Criteria**:
- ✅ Identifies PRs awaiting review > 48 hours
- ✅ Detects non-compliant PR titles/descriptions
- ✅ Scores PR urgency based on age, size, and author history
- ✅ Provides actionable recommendations for each PR

### Phase 3: Release-Based Timeline Analysis (MEDIUM PRIORITY)
**Timeline**: Days 7-9

**Deliverables**:
- Last release detection via GitHub API
- Time-range comparison logic
- New PR highlighting since release
- Release velocity insights

**Technical Requirements**:
- Integrate GitHub Releases API
- Implement date range comparison algorithms
- Create release timeline visualization
- Calculate release velocity metrics

**Acceptance Criteria**:
- ✅ Automatically detects last release date
- ✅ Shows PRs created since last release
- ✅ Compares current period to historical release cycles
- ✅ Recommends optimal release timing

### Phase 4: Enhanced Health Assessment (MEDIUM PRIORITY)
**Timeline**: Days 10-12

**Deliverables**:
- Advanced contributor health metrics
- Bus factor analysis improvements
- Review velocity tracking
- Code quality indicators

**Technical Requirements**:
- Enhance existing health assessment with more metrics
- Add trend analysis (improving/declining)
- Implement predictive health scoring
- Create actionable health improvement recommendations

**Acceptance Criteria**:
- ✅ Comprehensive health scoring (0-100 scale)
- ✅ Trend indicators (↗️ improving, ↘️ declining, ➡️ stable)
- ✅ Specific improvement recommendations
- ✅ Comparison to similar repositories (if data available)

### Phase 5: Intelligent Observations & Recommendations (LOW PRIORITY)
**Timeline**: Days 13-15

**Deliverables**:
- Pattern recognition for common issues
- Proactive maintenance recommendations
- Contributor onboarding insights
- Process optimization suggestions

**Technical Requirements**:
- Implement pattern matching algorithms
- Create recommendation engine
- Add historical trend analysis
- Build predictive modeling for common issues

**Acceptance Criteria**:
- ✅ Detects recurring patterns (stale PRs, review bottlenecks)
- ✅ Recommends process improvements
- ✅ Identifies opportunities for contributor growth
- ✅ Suggests optimal review assignments

## Technical Guidelines

### Architecture Decisions
- **Component Structure**: Create modular insight components that can be easily extended
- **Data Management**: Leverage existing GitHub API integration and Supabase storage
- **Real-time Updates**: Implement polling or webhook integration for live insights
- **Performance**: Cache insights data to minimize API calls
- **Extensibility**: Design plugin-like architecture for adding new insight types

### Integration Points
- **Existing InsightsDrawer**: Refactor to use new sidebar infrastructure
- **PR Activity System**: Integrate with existing activity tracking
- **Time Range Controls**: Respect user-selected time ranges
- **Authentication**: Use existing GitHub auth for enhanced API limits
- **Supabase**: Leverage stored analytics data for historical insights

### Data Sources
- **GitHub API**: Pull requests, reviews, comments, releases, commits
- **Supabase**: Historical analytics, contributor rankings, sync logs
- **Repository Files**: CONTRIBUTING.md, README.md for guideline parsing
- **Time Series Data**: Daily activity snapshots for trend analysis

## User Experience Design

### Interface Layout
- **Desktop**: Right-side collapsible sidebar (300-400px width)
- **Mobile**: Bottom sheet overlay with swipe gestures
- **Loading States**: Skeleton loaders for each insight section
- **Empty States**: Helpful messages when no insights are available

### Interaction Patterns
- **Progressive Disclosure**: Show summary first, expand for details
- **Contextual Actions**: Direct links to problematic PRs or issues
- **Filtering**: Allow users to focus on specific insight categories
- **Personalization**: Remember user preferences for insight priority

### Visual Design
- **Icons**: Consistent iconography for different insight types
- **Colors**: Traffic light system (red/yellow/green) for urgency
- **Typography**: Clear hierarchy with scannable content
- **Animations**: Subtle transitions to maintain attention without distraction

## Non-Goals (Out of Scope)

- **Multi-Repository Insights**: Focus on single repository analysis only
- **Advanced Analytics Dashboard**: Keep insights actionable, not comprehensive
- **External Integrations**: No Slack, Discord, or other third-party notifications
- **Historical Data Visualization**: Limit to current trends, not detailed charts
- **User Management**: No admin controls or permission systems
- **AI/ML Predictions**: Use rule-based logic, not machine learning models

## Open Questions & Considerations

### Technical Questions
1. **API Rate Limits**: How frequently should we refresh insights without hitting GitHub limits?
2. **Data Storage**: Should we cache insights in Supabase or use client-side caching?
3. **Real-time Updates**: WebSockets vs polling for live insights updates?
4. **Performance**: What's the acceptable loading time for complex insights?

### Product Questions
1. **Notification System**: Should insights proactively notify users of critical issues?
2. **Customization**: How much control should users have over which insights to display?
3. **Privacy**: Should we track which insights users interact with for improvement?
4. **Onboarding**: How do we introduce new users to the insights sidebar effectively?

### Business Questions
1. **Success Metrics**: How do we measure if insights are actually improving repository health?
2. **User Feedback**: What feedback mechanisms should we implement?
3. **Iteration Strategy**: How do we prioritize new insight types based on user needs?

## Risk Assessment & Mitigation

### Technical Risks
- **API Rate Limiting**: Mitigate with intelligent caching and user token prioritization
- **Performance Impact**: Use lazy loading and background processing for complex insights
- **Data Accuracy**: Implement validation and fallback mechanisms for API data

### Product Risks
- **Information Overload**: Use progressive disclosure and smart filtering
- **Low Adoption**: Implement onboarding tooltips and clear value propositions
- **Maintenance Burden**: Design modular architecture for easy updates

### User Experience Risks
- **Mobile Experience**: Ensure sidebar doesn't interfere with core functionality
- **Accessibility**: Test with screen readers and keyboard-only navigation
- **Performance on Slow Connections**: Implement graceful degradation

---

**Filename:** `prd-insights-sidebar.md`  
**Location:** `/tasks/`  
**Created:** 2025-06-14  
**Target Audience:** Full-Stack Implementation  
**Estimated Effort:** 15 development days across 5 phases