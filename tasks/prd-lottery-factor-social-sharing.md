# Product Requirements Document: Lottery Factor Social Sharing

## Introduction/Overview

This feature adds social sharing capabilities to the Lottery Factor component, allowing users to easily share repository health insights with their network. The feature includes a social sharing button on the lottery factor card and, as a stretch goal, auto-generated social cards that visually represent the lottery factor data.

**Problem it solves**: Currently, users who discover interesting lottery factor insights about repositories have no easy way to share this valuable information with their team or community. This creates friction in knowledge sharing and reduces the viral potential of the contributor.info platform.

**Goal**: Enable seamless sharing of lottery factor insights to increase platform engagement and help teams discuss repository health more effectively.

## Goals

1. **Primary**: Add intuitive social sharing functionality to the lottery factor card
2. **Secondary**: Increase user engagement and platform visibility through social sharing
3. **Stretch**: Generate dynamic social cards that visually represent lottery factor data
4. **Metrics**: Achieve at least 5% of lottery factor views resulting in a share action

## User Stories

- **As a team lead**, I want to share concerning lottery factor results with my team so that we can discuss knowledge distribution risks
- **As a developer**, I want to share interesting repository health insights on social media to contribute to community discussions
- **As a project manager**, I want to quickly generate a visual summary of our repository's lottery factor to include in status reports
- **As an open source maintainer**, I want to share positive lottery factor results to showcase healthy contributor distribution

## Functional Requirements

### Phase 1: Basic Social Sharing
1. **Share Button**: The system must display a share button on the lottery factor card in the header area next to the risk level badge
2. **Share Options**: The share button must provide options for Twitter/X, LinkedIn, and generic system share
3. **Share Content**: The system must generate pre-formatted share messages including:
   - Repository name and owner
   - Risk level (Low/Medium/High)
   - Top contributors percentage
   - Link back to the specific repository page
4. **Share URL**: The system must generate shareable URLs that include repository context and direct users to the lottery factor view
5. **Analytics**: The system must track share button clicks by platform for analytics

### Phase 2: Enhanced Sharing (Stretch Goal)
6. **Social Card Generation**: The system must generate dynamic social cards (1200x630px) for lottery factor data
7. **Card Content**: Social cards must include:
   - Repository name and avatar
   - Risk level with color coding
   - Top contributors percentage visualization
   - YOLO coders indicator (if applicable)
   - contributor.info branding
8. **Card Caching**: The system must cache generated social cards to avoid regeneration overhead
9. **Card Integration**: Generated cards must be automatically attached to share links when available

### Phase 3: Advanced Features (Future)
10. **Custom Messages**: Users must be able to edit share messages before posting
11. **Team Sharing**: The system must support sharing to team communication tools (Slack, Discord)
12. **Share Analytics**: The system must provide insights on which repositories are most shared

## Non-Goals (Out of Scope)

- **Not included**: Integration with proprietary team tools beyond standard social platforms
- **Not included**: Real-time collaborative features or commenting on shared content
- **Not included**: Email sharing functionality
- **Not included**: Sharing of individual contributor data (privacy protection)
- **Not included**: Bulk sharing of multiple repositories

## Design Considerations

### UI/UX Requirements
- **Share Button**: Use a subtle share icon (Share, External Link, or Upload icons from Lucide)
- **Button Placement**: Position in the lottery factor card header, aligned right after the risk badge
- **Share Modal**: If needed, use existing UI components (Dialog, Dropdown) for share options
- **Visual Hierarchy**: Ensure share button doesn't compete with primary lottery factor content
- **Responsive**: Share functionality must work on both desktop and mobile viewports

### Social Card Design
- **Dimensions**: 1200x630px (Twitter/Facebook optimal)
- **Template**: Follow existing social card design patterns from `generate-social-cards.js`
- **Color Scheme**: Use risk level colors (green/yellow/red) prominently
- **Typography**: Ensure readability at small sizes when shared
- **Branding**: Include contributor.info logo and URL

## Technical Considerations

### Integration Points
- **Existing Components**: Leverage existing UI components (Button, Tooltip, Dialog from shadcn/ui)
- **Social Card System**: Extend the current `generate-social-cards.js` script to support lottery factor cards
- **Supabase Storage**: Use existing Supabase storage bucket for social card hosting
- **Context Integration**: Work with existing `RepoStatsContext` and lottery factor data

### Performance Requirements
- **Share Button**: Must not impact lottery factor card load time
- **Social Cards**: Generate asynchronously, show fallback while generating
- **Caching**: Cache social cards for 24 hours to balance freshness and performance
- **Error Handling**: Graceful degradation if social card generation fails

### Dependencies
- **Web Share API**: For native sharing on supported devices
- **Playwright**: For social card screenshot generation (already available)
- **Supabase**: For social card storage (already configured)

## Success Metrics

### Primary Metrics
- **Share Rate**: 5% of lottery factor card views result in share action
- **Social Card Generation**: 95% success rate for social card generation
- **Performance**: Share button interaction responds within 200ms

### Secondary Metrics
- **Platform Distribution**: Track which platforms are most popular for sharing
- **Engagement**: Monitor click-through rate on shared links
- **Social Card Usage**: Percentage of shares that include generated social cards

## Open Questions

1. **Analytics Integration**: Should we integrate with existing analytics tools or use custom tracking?
2. **Share Message Templates**: Do we need different message templates for different risk levels? 
3. **Rate Limiting**: Should we implement rate limiting for social card generation to prevent abuse?
4. **Internationalization**: Should share messages support multiple languages?
5. **A/B Testing**: Should we test different share button placements or designs?

## Implementation Notes

- **Phase 1** should integrate with existing lottery factor component without major architectural changes
- **Phase 2** can reuse existing social card infrastructure with lottery factor-specific templates  
- Consider creating a reusable `SocialShareButton` component for potential use in other features
- Ensure compliance with social media platform sharing guidelines and best practices