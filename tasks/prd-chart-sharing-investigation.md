# PRD: Chart Sharing Functionality Investigation

## Project Overview

**Objective**: Investigate and implement a robust chart sharing system that allows users to capture and share various charts from the contributor.info platform.

**Background**: Initial attempts to add ShareableCard to PR contributions charts revealed technical challenges with dark mode theming and avatar rendering in Nivo charts. This PRD outlines a systematic approach to solve these issues and implement comprehensive chart sharing.

**Success Metrics**:
- Charts render correctly in both light and dark themes when shared
- Avatar images display properly in captured charts
- Clean capture mode (no UI controls visible in shared images)
- Cross-browser compatibility for image capture
- Mobile-responsive sharing functionality

## Current State Analysis

### ✅ What Works
- **ShareableCard Component**: Exists and functional for other components
- **Theme System**: Comprehensive theme provider with light/dark/system modes
- **Nivo Chart Theming**: Basic Nivo theme implementation created (kept from investigation)
- **Avatar Improvements**: Enhanced avatar rendering in SVG foreignObject context

### ❌ What's Broken/Missing
- **Nivo Theme Integration**: Charts don't automatically respond to theme changes
- **Avatar Rendering Issues**: Images may not load properly in html2canvas captures
- **Capture Mode Detection**: No reliable way to hide UI controls during capture
- **Cross-Chart Consistency**: Different chart libraries (Recharts vs Nivo) have different theming approaches

### 🔍 Areas Needing Investigation
1. **html2canvas Compatibility**: How well does it work with Nivo charts and foreignObject elements?
2. **Theme Synchronization**: Best approach for real-time theme updates across chart libraries
3. **Image Loading**: CORS and crossOrigin handling for GitHub avatars in captures
4. **Performance Impact**: Effect of sharing functionality on chart rendering performance
5. **Mobile Sharing**: Native share API integration and mobile-specific considerations

## Implementation Plan

### Phase 1: Technical Investigation (HIGH Priority)
**Goal**: Understand and document technical constraints and solutions

**Tasks**:
- [ ] Create test environment for html2canvas with Nivo charts
- [ ] Document avatar loading issues and CORS requirements
- [ ] Test different theme synchronization approaches
- [ ] Evaluate alternative capture libraries (dom-to-image, etc.)
- [ ] Create compatibility matrix for different chart types

**Deliverables**:
- Technical investigation report
- Recommended capture approach
- Performance benchmarks
- Browser compatibility findings

### Phase 2: Proof of Concept (HIGH Priority)  
**Goal**: Build working prototype with one chart type

**Tasks**:
- [ ] Implement reliable capture mode detection system
- [ ] Create unified theme system for all chart libraries
- [ ] Fix avatar rendering in capture context
- [ ] Add proper error handling and fallbacks
- [ ] Test on multiple devices and browsers

**Deliverables**:
- Working ShareableCard integration for contributions chart
- Theme-aware capture system
- Avatar rendering solution

### Phase 3: System-Wide Implementation (MEDIUM Priority)
**Goal**: Roll out sharing to all chart types

**Tasks**:
- [ ] Extend sharing to distribution charts (Recharts-based)
- [ ] Add sharing to activity metrics cards
- [ ] Implement sharing for contributor rankings
- [ ] Create unified sharing experience across platform
- [ ] Add analytics tracking for sharing usage

**Deliverables**:
- Sharing available on all major charts
- Consistent UX patterns
- Usage analytics dashboard

### Phase 4: Enhancement & Optimization (LOW Priority)
**Goal**: Polish and optimize the sharing experience

**Tasks**:
- [ ] Add custom watermarking options
- [ ] Implement batch sharing for multiple charts
- [ ] Create shareable dashboard snapshots
- [ ] Add social media optimization (OG tags)
- [ ] Performance optimizations for large charts

**Deliverables**:
- Enhanced sharing features
- Social media integration
- Performance improvements

## Technical Guidelines

### Chart Library Considerations
- **Nivo Charts**: Require manual theme objects, complex foreignObject handling
- **Recharts**: Better theme integration via ChartContainer component
- **Custom Charts**: Tailwind-based, simplest to theme and capture

### Theme Implementation Requirements
- Real-time theme switching without page reload
- CSS variable mapping for consistent colors
- Proper contrast ratios for accessibility
- Print/capture friendly color schemes

### Capture System Requirements
- Hide interactive controls (buttons, switches) during capture
- Maintain chart interactivity for normal use
- Handle loading states gracefully
- Support high-DPI displays

### Performance Considerations
- Lazy load capture functionality
- Optimize image compression for sharing
- Cache theme calculations
- Minimize impact on chart rendering

## Risk Assessment

### High Risk
- **Browser Compatibility**: html2canvas may not work consistently across browsers
- **Avatar Loading**: CORS issues with GitHub images
- **Theme Synchronization**: Complex state management for real-time updates

### Medium Risk  
- **Performance Impact**: Large charts may be slow to capture
- **Mobile Experience**: Sharing UX may need mobile-specific adaptations
- **Maintenance Overhead**: Multiple chart libraries increase complexity

### Mitigation Strategies
- Create fallback capture methods
- Implement progressive enhancement
- Add comprehensive error handling
- Use feature detection for capabilities

## Acceptance Criteria

### Phase 1 (Investigation)
- [ ] Technical report documenting all findings
- [ ] Recommended implementation approach
- [ ] Performance benchmarks for different approaches
- [ ] Risk assessment with mitigation strategies

### Phase 2 (Proof of Concept)
- [ ] ShareableCard works with contributions chart
- [ ] Charts render correctly in both light and dark themes
- [ ] Avatars display properly in captured images
- [ ] UI controls are hidden during capture
- [ ] Cross-browser testing completed

### Phase 3 (System-wide)
- [ ] All major charts support sharing
- [ ] Consistent UX patterns across platform
- [ ] Analytics tracking implemented
- [ ] Mobile sharing tested and optimized

### Phase 4 (Enhancement)
- [ ] Advanced sharing features implemented
- [ ] Performance optimized
- [ ] Social media integration complete
- [ ] User feedback incorporated

## Future Considerations

- **API-Based Sharing**: Server-side chart rendering for better consistency
- **Real-time Collaboration**: Share live updating charts
- **Custom Branding**: Allow users to customize watermarks
- **Integration APIs**: Allow other platforms to embed shared charts
- **A/B Testing**: Optimize sharing conversion rates

---

**Created**: 2025-01-25  
**Status**: Planning  
**Priority**: Medium  
**Estimated Effort**: 3-4 weeks across all phases  
**Dependencies**: Theme system, chart libraries, sharing infrastructure