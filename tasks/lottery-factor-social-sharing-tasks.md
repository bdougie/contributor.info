# Task List: Enhanced Social Sharing Implementation

Based on PRD: `prd-lottery-factor-social-sharing.md`
**Updated**: Expanded to include image export, authentication, and analytics tracking

## Status: Phase 2 Implementation Complete ✅
**Current Phase**: Ready for testing and verification

---

## Phase 0: Enhanced Requirements (NEW)

### 0. Image Export and Authentication Features
- [x] **0.1 Install image capture dependencies**
  - [x] Add html2canvas or dom-to-image-more package
  - [x] Test browser compatibility
  - [x] Evaluate performance impact
- [x] **0.2 Design ShareableCard wrapper component**
  - [x] Create hover state detection system
  - [x] Design UI for share/download icons on hover
  - [x] Plan component API and props
- [x] **0.3 Authentication integration planning**
  - [x] Review existing auth flow
  - [x] Design login-required UX for sharing
  - [x] Plan auth state management
- [x] **0.4 Short URL system design**
  - [x] Evaluate dub.co vs custom Supabase solution
  - [x] Design URL structure and analytics schema
  - [x] Plan migration for existing share URLs

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

### 4. Analytics Integration ✅ COMPLETED
- [x] **4.1 Implement share tracking**
  - [x] Set up dub.co integration with environment-specific domains
  - [x] Create share_events table in Supabase
  - [x] Track user_id, repository, share type, platform
  - [x] Implement click tracking for shared URLs
- [x] **4.2 Setup success metrics tracking**
  - [x] Implement share rate calculation (target: 5% of views)
  - [x] Track most shared repositories
  - [x] Monitor click-through rates
  - [x] Track performance metrics (button response time)
  - [x] Add error tracking for failed shares
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

## Phase 1.5: Image Export Features (NEW) ✅ COMPLETED

### Image Capture Implementation
- [x] **1.5.1 Create ShareableCard component**
  - [x] Implement hover detection with useHover hook
  - [x] Add floating action buttons (share, download, copy)
  - [x] Support wrapping any chart/metric component
  - [x] Handle responsive behavior
- [x] **1.5.2 Implement image capture**
  - [x] Integrate html2canvas for DOM to image conversion
  - [x] Add watermark with contributor.info branding
  - [x] Include context (repo name, date, metric name)
  - [x] Support both PNG and clipboard formats
- [x] **1.5.3 Rich clipboard support**
  - [x] Copy image to clipboard using Canvas API
  - [x] Include URL with image for rich paste
  - [x] Show success toast: "Chart copied with link!"
  - [x] Handle browser compatibility
- [x] **1.5.4 Authentication gate**
  - [x] Require login for image export features
  - [x] Show "Login to Share" for unauthenticated users
  - [x] Preserve action after login redirect
  - [x] Track authenticated share events

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
- `src/components/features/sharing/shareable-card.tsx` - Main ShareableCard wrapper component
- `src/components/features/sharing/index.ts` - Export file for sharing components
- `src/hooks/use-auth.ts` - Auth hook alias for consistency
- `src/lib/dub.ts` - dub.co API service wrapper for short URL generation
- `src/lib/analytics.ts` - Analytics tracking service for share events
- `supabase/migrations/20241225000000_add_share_analytics.sql` - Database schema for analytics
- `.env` - Updated with dub.co configuration

### Modified Files:
- `src/components/features/distribution/distribution-charts.tsx` - Wrapped charts with ShareableCard
- `src/components/features/repository/repo-view.tsx` - Updated Share2 to Link icon
- `src/components/features/distribution/__tests__/distribution-charts.test.tsx` - Added mocks for new dependencies
- `package.json` - Added html2canvas dependency

### Implementation Summary:
✅ **COMPLETED**: ShareableCard component with hover-to-share functionality
✅ **COMPLETED**: Image capture using html2canvas
✅ **COMPLETED**: Copy/Download/Share actions with authentication gates
✅ **COMPLETED**: Applied to all distribution charts (treemap, donut, bar)
✅ **COMPLETED**: Rich clipboard support (image + URL)
✅ **COMPLETED**: Watermark with repository context
✅ **COMPLETED**: Login dialog integration
✅ **COMPLETED**: Test coverage with proper mocking

### Phase 2 - Short URLs & Analytics (NEW):
✅ **COMPLETED**: dub.co SDK integration with environment-specific domains
✅ **COMPLETED**: Short URL generation for chart sharing (dub.co for dev, oss.fyi for prod)
✅ **COMPLETED**: Supabase analytics schema with share_events and share_click_analytics tables
✅ **COMPLETED**: Full analytics tracking service (trackShareEvent, getShareMetrics, etc.)
✅ **COMPLETED**: Updated ShareableCard with short URL support and new Link button
✅ **COMPLETED**: TypeScript types and error handling for dub.co API
✅ **COMPLETED**: Database migration applied successfully
✅ **COMPLETED**: Build verification passed

---

## Implementation Notes

- **Priority**: Focus on Phase 1 first, get basic sharing working before moving to enhanced features
- **Testing Strategy**: Implement comprehensive testing at each phase before proceeding
- **Performance**: Ensure share button doesn't impact lottery factor card load times
- **Accessibility**: Follow existing accessibility patterns in the codebase
- **Mobile First**: Ensure all features work well on mobile devices

## Success Criteria

### ✅ Phase 1.5 Completed:
- [x] **Image sharing appears on charts**: Hover-to-share buttons on all distribution charts
- [x] **Multiple sharing options**: Copy image, download PNG, native share with image+URL
- [x] **Repository context included**: Watermark with repo name and contributor.info branding
- [x] **Authentication required**: Login gate for all sharing features
- [x] **Fast interactions**: Share buttons appear on hover within 200ms

### 🔄 Phase 2 Remaining:
- [ ] Share button appears on lottery factor cards specifically
- [ ] Short URL generation with analytics tracking
- [ ] Share rate analytics (target: 5% of views)
- [ ] Most shared repositories ranking
- [ ] Social platform integration (Twitter/X, LinkedIn)

### 📊 Next Priority Items:
1. **Short URL System**: dub.co or custom Supabase implementation
2. **Analytics Dashboard**: Track share events and popular repositories  
3. **Lottery Factor Cards**: Apply ShareableCard to health/lottery factor components
4. **Social Card Generation**: Auto-generated 1200x630 social preview images