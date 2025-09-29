# PRD: Workspaces Reviewer Suggestions Feature

## Project Overview

### Objective
Integrate reviewer suggestion functionality into the workspaces feature, allowing users to manage CODEOWNERS files and get intelligent reviewer suggestions for their repositories within a unified workspace interface.

### Background
- Issue #448 defines backend API requirements for reviewer suggestions
- Issue #442 is the parent feature request for reviewer suggestion tools
- Decision made to integrate this as a workspaces feature rather than standalone
- Replace workspace settings icon with reviewer suggestions tab/modal

### Success Metrics
- Users can access reviewer suggestions from workspace interface
- CODEOWNERS management integrated into workspace workflow
- API endpoints provide reliable reviewer suggestions
- Modal interface provides intuitive access to all functionality

## Current State Analysis

### Existing Infrastructure
- Workspaces feature already exists with "All repositories" view
- Current workspace settings icon to the right of "All repositories"
- Backend API structure in place via Netlify functions
- Supabase database with contribution data
- GitHub API integration for repository data

### What Needs to Be Built
- Backend API endpoints for CODEOWNERS and reviewer suggestions
- Frontend modal interface for reviewer suggestions
- Integration with existing workspace UI
- Data models for suggestions and CODEOWNERS

## Implementation Plan

### Phase 1: Backend API Development (HIGH Priority)
**Estimated Time**: 2-3 days

#### API Endpoints to Implement
1. **GET /api/repos/:owner/:repo/codeowners**
   - Fetch and parse CODEOWNERS files
   - Return content, location, and parsed entries
   - Implement caching for performance

2. **GET /api/repos/:owner/:repo/suggested-codeowners**
   - Generate CODEOWNERS suggestions based on contribution history
   - Use Supabase data for analysis
   - Return confidence scores and reasoning

3. **POST /api/repos/:owner/:repo/suggest-reviewers**
   - Analyze PR files or provided file list
   - Suggest reviewers based on CODEOWNERS and contribution history
   - Support both PR URLs and manual file lists

4. **GET /api/repos/:owner/:repo/file-tree**
   - Provide repository file structure
   - Support recursive and filtered views
   - Optimize for CODEOWNERS pattern creation

#### Technical Requirements
- Implement proper error handling and rate limiting
- Use existing Supabase client for data queries
- Add authentication for write operations
- Implement caching strategy for frequently accessed data

### Phase 2: Frontend Modal Interface (HIGH Priority)
**Estimated Time**: 2 days

#### UI Components
1. **Replace Workspace Settings Icon**
   - Replace current settings icon with "Reviewer Suggestions" button
   - Maintain same positioning to right of "All repositories"
   - Use appropriate icon (e.g., user-group, review, or suggestion icon)

2. **Reviewer Suggestions Modal**
   - Full-screen or large modal interface
   - Tabs for different functionality:
     - "Suggest Reviewers" - PR analysis and reviewer suggestions
     - "CODEOWNERS" - View/edit CODEOWNERS files
     - "Generate CODEOWNERS" - Auto-generate suggestions
   - Repository selector for workspace repositories

3. **Suggest Reviewers Tab**
   - Input field for PR URL or manual file selection
   - Display suggested reviewers with:
     - Avatar, username, confidence score
     - Reasoning (commits to files, recent reviews, CODEOWNERS match)
   - Copy-to-clipboard functionality for reviewer usernames

4. **CODEOWNERS Tab**
   - Display current CODEOWNERS file (if exists)
   - Show file location and last modified date
   - Basic editing capabilities with syntax highlighting
   - Preview of affected files for each pattern

5. **Generate CODEOWNERS Tab**
   - File tree browser for pattern selection
   - Generated suggestions with confidence scores
   - Editable suggestions before applying
   - Preview mode showing impact of changes

### Phase 3: Integration and Polish (MEDIUM Priority)
**Estimated Time**: 1 day

#### Integration Tasks
- Ensure modal works seamlessly with workspace data
- Add loading states and error handling
- Implement proper modal state management
- Add keyboard shortcuts and accessibility features

#### Polish and UX
- Add tooltips and help text for complex features
- Implement proper empty states
- Add confirmation dialogs for destructive actions
- Ensure mobile responsiveness

### Phase 4: Advanced Features (LOW Priority)
**Estimated Time**: 2 days

#### Enhanced Functionality
- Bulk reviewer suggestions for multiple PRs
- CODEOWNERS validation and linting
- Integration with GitHub PR review requests
- Historical analysis of reviewer effectiveness
- Team-based suggestion rules

## Technical Guidelines

### Data Models
```typescript
interface ReviewerSuggestion {
  username: string;
  avatar_url: string;
  score: number;
  reasons: string[];
  commits_to_files: number;
  recent_reviews: number;
}

interface CodeOwnersSuggestion {
  pattern: string;
  owners: string[];
  confidence: number;
  based_on_commits: number;
}

interface CodeOwnersEntry {
  pattern: string;
  owners: string[];
  line_number: number;
}
```

### Architecture Decisions
- Use existing Netlify Functions structure for API endpoints
- Leverage Supabase for contribution data analysis
- Implement client-side caching for frequently accessed data
- Use React Query for API state management
- Follow existing modal patterns in the codebase

### Performance Considerations
- Cache CODEOWNERS files for 1 hour
- Implement request deduplication for concurrent requests
- Use GitHub conditional requests to minimize API usage
- Paginate large file trees and suggestion lists

## Acceptance Criteria

### Phase 1 (Backend API)
- ✅ All four API endpoints implemented and functional
- ✅ Proper error handling and status codes
- ✅ Rate limiting implemented
- ✅ Caching strategy in place
- ✅ Integration with existing Supabase data
- ✅ Authentication for protected operations

### Phase 2 (Frontend Modal)
- ✅ Workspace settings icon replaced with reviewer suggestions button
- ✅ Modal opens with three functional tabs
- ✅ Repository selector works with workspace data
- ✅ Reviewer suggestions display with all required information
- ✅ CODEOWNERS viewing and basic editing
- ✅ CODEOWNERS generation with file tree browser

### Phase 3 (Integration)
- ✅ Modal integrates seamlessly with workspace navigation
- ✅ Loading states and error handling throughout
- ✅ Responsive design works on all screen sizes
- ✅ Keyboard navigation and accessibility compliance

### Phase 4 (Advanced Features)
- ✅ At least two advanced features implemented
- ✅ Performance optimization completed
- ✅ User feedback incorporated
- ✅ Documentation updated

## Dependencies

### Technical Dependencies
- Existing workspace infrastructure
- GitHub API access and rate limits
- Supabase database with contribution data
- Netlify Functions deployment pipeline

### Design Dependencies
- Consistent with existing modal patterns
- Follows workspace design language
- Accessibility compliance
- Mobile-responsive design

## Risk Mitigation

### GitHub API Limits
- Implement aggressive caching
- Use conditional requests
- Provide fallback when API limits hit
- Consider GitHub App for higher limits

### Performance Concerns
- Profile API endpoints under load
- Implement request queuing for bulk operations
- Monitor bundle size impact of new modal

### User Experience
- Provide clear error messages
- Implement progressive disclosure for complex features
- Add onboarding for new functionality
- Gather user feedback early and iterate

## Next Steps

1. Begin Phase 1 implementation with backend API endpoints
2. Set up proper testing infrastructure for API endpoints
3. Create basic frontend modal structure
4. Implement core reviewer suggestion functionality
5. Iterate based on initial user testing

## Related Issues
- #448 - Backend API endpoints (this PRD)
- #442 - Parent feature request
- #198 - Enhanced reviewer suggestions with CODEOWNERS
- #221 - Original reviewer suggestions implementation