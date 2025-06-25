# Task List: Enhanced Social Sharing Implementation

Based on PRD: `prd-lottery-factor-social-sharing.md`
**Updated**: Expanded to include image export, authentication, and analytics tracking

## Status: In Progress
**Current Phase**: Phase 1 - Image Export and Authentication

---

## Phase 0: Enhanced Requirements (NEW)

### 0. Image Export and Authentication Features
- [ ] **0.1 Install image capture dependencies**
  - [ ] Add html2canvas or dom-to-image-more package
  - [ ] Test browser compatibility
  - [ ] Evaluate performance impact
- [ ] **0.2 Design ShareableCard wrapper component**
  - [ ] Create hover state detection system
  - [ ] Design UI for share/download icons on hover
  - [ ] Plan component API and props
- [ ] **0.3 Authentication integration planning**
  - [ ] Review existing auth flow
  - [ ] Design login-required UX for sharing
  - [ ] Plan auth state management
- [ ] **0.4 Short URL system design**
  - [ ] Evaluate dub.co vs custom Supabase solution
  - [ ] Design URL structure and analytics schema
  - [ ] Plan migration for existing share URLs

## Phase 1: Basic Social Sharing with Authentication

### 1. Research & Analysis
- [ ] **1.1 Analyze existing lottery factor component structure**
  - [ ] Locate and examine current lottery factor card component
  - [ ] Identify where share button should be placed in header
  - [ ] Document current component props and data structure
- [ ] **1.2 Review existing social sharing patterns**
  - [ ] Find existing social card generation system (`generate-social-cards.js`)
  - [ ] Review current Supabase storage setup for social cards
  - [ ] Analyze existing UI components (Button, Dialog, Dropdown)
- [ ] **1.3 Examine repository context and routing**
  - [ ] Understand how repository URLs are structured
  - [ ] Review RepoStatsContext implementation
  - [ ] Identify lottery factor specific URL patterns

### 2. Component Development
- [ ] **2.1 Create SocialShareButton component**
  - [ ] Design component interface and props
  - [ ] Implement share button with appropriate icon
  - [ ] Add tooltip for accessibility
  - [ ] Make component responsive for mobile/desktop
- [ ] **2.2 Implement share options dropdown/modal**
  - [ ] Create share options UI (Twitter/X, LinkedIn, system share)
  - [ ] Implement Web Share API for native sharing
  - [ ] Add fallback for unsupported browsers
  - [ ] Handle platform-specific URL formatting
- [ ] **2.3 Integrate share button into lottery factor card**
  - [ ] Add share button to lottery factor card header
  - [ ] Position next to risk level badge
  - [ ] Ensure proper visual hierarchy
  - [ ] Test responsive behavior

### 3. Share Content Generation
- [ ] **3.1 Create share message generator**
  - [ ] Implement function to generate pre-formatted messages
  - [ ] Include repository name, owner, risk level, top contributors %
  - [ ] Create platform-specific message variants
  - [ ] Add proper URL encoding and character limits
- [ ] **3.2 Generate shareable URLs**
  - [ ] Create URL generation utility for lottery factor views
  - [ ] Include repository context in URLs
  - [ ] Ensure URLs direct to lottery factor section
  - [ ] Test URL validity and navigation

### 4. Analytics Integration
- [ ] **4.1 Implement share tracking**
  - [ ] Set up dub.co integration OR custom short URL system
  - [ ] Create share_events table in Supabase
  - [ ] Track user_id, repository, share type, platform
  - [ ] Implement click tracking for shared URLs
- [ ] **4.2 Setup success metrics tracking**
  - [ ] Implement share rate calculation (target: 5% of views)
  - [ ] Track most shared repositories
  - [ ] Monitor click-through rates
  - [ ] Track performance metrics (button response time)
  - [ ] Add error tracking for failed shares
- [ ] **4.3 Create analytics dashboard**
  - [ ] Design UI for share analytics
  - [ ] Implement repository share rankings
  - [ ] Show share trends over time
  - [ ] Display platform distribution

### 5. Testing & Quality Assurance
- [ ] **5.1 Unit testing**
  - [ ] Test SocialShareButton component
  - [ ] Test share message generation
  - [ ] Test URL generation utilities
  - [ ] Test analytics tracking functions
- [ ] **5.2 Integration testing**
  - [ ] Test integration with lottery factor card
  - [ ] Test share functionality across platforms
  - [ ] Test responsive behavior on mobile/desktop
  - [ ] Test error handling and fallbacks
- [ ] **5.3 Manual testing**
  - [ ] Test actual sharing to social platforms
  - [ ] Verify shared URLs work correctly
  - [ ] Test accessibility features
  - [ ] Validate visual design and placement

---

## Phase 1.5: Image Export Features (NEW)

### Image Capture Implementation
- [ ] **1.5.1 Create ShareableCard component**
  - [ ] Implement hover detection with useHover hook
  - [ ] Add floating action buttons (share, download, copy)
  - [ ] Support wrapping any chart/metric component
  - [ ] Handle responsive behavior
- [ ] **1.5.2 Implement image capture**
  - [ ] Integrate html2canvas for DOM to image conversion
  - [ ] Add watermark with contributor.info branding
  - [ ] Include context (repo name, date, metric name)
  - [ ] Support both PNG and clipboard formats
- [ ] **1.5.3 Rich clipboard support**
  - [ ] Copy image to clipboard using Canvas API
  - [ ] Include URL with image for rich paste
  - [ ] Show success toast: "Chart copied with link!"
  - [ ] Handle browser compatibility
- [ ] **1.5.4 Authentication gate**
  - [ ] Require login for image export features
  - [ ] Show "Login to Share" for unauthenticated users
  - [ ] Preserve action after login redirect
  - [ ] Track authenticated share events

---

## Phase 2: Enhanced Sharing (Stretch Goal)

### 6. Social Card System Extension
- [ ] **6.1 Extend social card generation**
  - [ ] Modify existing `generate-social-cards.js` for lottery factor
  - [ ] Create lottery factor social card template (1200x630px)
  - [ ] Implement risk level color coding
  - [ ] Add repository avatar and branding
- [ ] **6.2 Social card content integration**
  - [ ] Include repository name and owner
  - [ ] Show risk level with visual indicators
  - [ ] Display top contributors percentage visualization
  - [ ] Add YOLO coders indicator when applicable
  - [ ] Include contributor.info branding

### 7. Caching & Performance
- [ ] **7.1 Implement social card caching**
  - [ ] Setup 24-hour cache for generated cards
  - [ ] Implement cache invalidation logic
  - [ ] Add cache hit/miss tracking
  - [ ] Handle cache storage in Supabase
- [ ] **7.2 Asynchronous generation**
  - [ ] Implement async social card generation
  - [ ] Add loading states and fallbacks
  - [ ] Handle generation failures gracefully
  - [ ] Optimize performance for card generation

### 8. Advanced Integration
- [ ] **8.1 Auto-attach social cards to shares**
  - [ ] Integrate generated cards with share URLs
  - [ ] Implement meta tags for social platforms
  - [ ] Test card preview on various platforms
  - [ ] Handle card availability states
- [ ] **8.2 Enhanced analytics**
  - [ ] Track social card generation success rate (target: 95%)
  - [ ] Monitor card usage in shares
  - [ ] Track platform-specific engagement
  - [ ] Add performance monitoring

---


## Relevant Files

*This section will be updated as files are created or modified during implementation*

### Created Files:
- `tasks/lottery-factor-social-sharing-tasks.md` - This task list document

### Modified Files:
*To be updated as implementation progresses*

---

## Implementation Notes

- **Priority**: Focus on Phase 1 first, get basic sharing working before moving to enhanced features
- **Testing Strategy**: Implement comprehensive testing at each phase before proceeding
- **Performance**: Ensure share button doesn't impact lottery factor card load times
- **Accessibility**: Follow existing accessibility patterns in the codebase
- **Mobile First**: Ensure all features work well on mobile devices

## Success Criteria

- [ ] Share button appears on lottery factor cards
- [ ] Users can share to Twitter/X, LinkedIn, and system share
- [ ] Share messages include proper repository context
- [ ] URLs direct users to the correct lottery factor view
- [ ] 5% of lottery factor views result in share actions
- [ ] Share interactions respond within 200ms