# PRD: Workspace Navigation & UX Integration

**Issue**: #400  
**Author**: Claude  
**Date**: 2025-08-25  
**Status**: In Progress - Phase 1 Complete

## Executive Summary

This PRD outlines the implementation of comprehensive workspace navigation and UX integration features for contributor.info. The goal is to create a seamless, intuitive workspace management experience that allows users to efficiently switch between workspaces, navigate repositories, and leverage keyboard shortcuts for power users.

## Project Overview

### Objective
Enhance the contributor.info application with advanced workspace navigation capabilities, including a workspace switcher, command palette with repository navigation, breadcrumb navigation, onboarding tour, and pre-built workspace templates.

### Background
The workspace feature has been implemented with core functionality (database schema, basic UI components), but lacks sophisticated navigation and user experience features that would make workspace management intuitive and efficient. Users need quick ways to switch between workspaces and repositories without multiple clicks.

### Success Metrics
- User can switch workspaces in < 2 seconds
- Command palette accessible within 200ms of keyboard shortcut
- 80% of new users complete onboarding tour
- Zero-navigation repository switching via command palette
- Mobile navigation works smoothly on 375px+ screens

## Current State Analysis

### What Exists
- **Database Infrastructure**: 
  - `workspaces`, `workspace_repositories`, `workspace_members` tables
  - `workspace_tracked_repositories` for data fetching
- **React Hooks**: 
  - `useWorkspace`, `useUserWorkspaces`, `usePrimaryWorkspace`
- **UI Components**: 
  - `WorkspaceDashboard`, `WorkspaceOnboarding`, `WorkspaceCreateModal`
  - Command UI primitives from `cmdk` library
- **Routing**: 
  - Workspace page at `/i/:workspaceId`
  - Basic workspace display in header

### What's Missing
- No workspace switcher in navigation
- No command palette for quick navigation
- Limited breadcrumb support for workspace context
- No onboarding tour for new users
- No pre-built templates for common use cases
- No keyboard shortcuts for power users
- Repository switching requires full page navigation

## Implementation Status

### Phase 1: Core Navigation Components ✅ COMPLETE (2025-08-25)

**Components Implemented:**
1. **WorkspaceContext** (`src/contexts/WorkspaceContext.tsx`)
   - Global workspace state management
   - Persists active workspace in localStorage
   - Tracks recent workspaces (last 5)
   - Cross-tab synchronization via storage events
   - Integrates with existing `useUserWorkspaces` hook

2. **WorkspaceSwitcher** (`src/components/navigation/WorkspaceSwitcher.tsx`)
   - Dropdown interface in main navigation
   - Shows current workspace with icon
   - Recent workspaces section with activity timestamps
   - All workspaces list with repository counts
   - Workspace tier badges (Free/Pro/Enterprise)
   - "Create new workspace" action
   - Keyboard navigation support

3. **App Integration**
   - WorkspaceProvider wrapped around entire app in `App.tsx`
   - WorkspaceSwitcher integrated into main navigation header
   - Removed legacy workspace button and modal from Layout

**Technical Decisions:**
- Used existing `WorkspacePreviewData` type from workspace cards
- Leveraged `@/components/ui/icon` sprite system (Package icon instead of Building2)
- Maintained compatibility with existing workspace hooks
- Implemented optimistic UI updates for smooth switching

## Implementation Plan

### Phase 1: Core Navigation Components (Priority: HIGH)

#### 1.1 Workspace Switcher
**Component**: `src/components/navigation/WorkspaceSwitcher.tsx`

**Features**:
- Dropdown button in main navigation showing current workspace
- List of all user workspaces with:
  - Workspace name and description preview
  - Repository count badge
  - Tier indicator (Free/Pro/Enterprise)
  - Last accessed timestamp
- Recent workspaces section (last 5)
- "Create new workspace" action at bottom
- Keyboard navigation support (arrow keys)

**Implementation**:
```typescript
interface WorkspaceSwitcherProps {
  currentWorkspaceId?: string;
  onWorkspaceChange: (workspaceId: string) => void;
}

// Features to implement:
- Use useUserWorkspaces() hook for data
- Store recent workspaces in localStorage
- Optimistic UI updates on selection
- Preload workspace data on hover
```

#### 1.2 Workspace Context Provider
**File**: `src/contexts/WorkspaceContext.tsx`

**Features**:
- Global workspace state management
- Persist active workspace in localStorage
- Workspace switching without page reload
- Preload workspace data for instant switching
- Broadcast workspace changes across tabs

**Implementation**:
```typescript
interface WorkspaceContextValue {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (id: string) => Promise<void>;
  isLoading: boolean;
}
```

### Phase 2: Command Palette (Priority: HIGH)

#### 2.1 Command Palette Component
**Component**: `src/components/navigation/CommandPalette.tsx`

**Features**:
- Global keyboard shortcut (Cmd+K / Ctrl+K)
- Multi-mode search:
  - Workspaces (prefix: "workspace:" or "w:")
  - Repositories (prefix: "repo:" or "r:")
  - Actions (prefix: ">" or no prefix)
- Repository view switching:
  - Navigate to any repository (workspace or global)
  - Format: `owner/repo` for quick access
  - Show repository metadata (stars, language, last activity)
- Recent items section
- Keyboard navigation (up/down arrows, enter, escape)
- Fuzzy search matching
- Action shortcuts displayed

**Commands Structure**:
```typescript
interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'workspace' | 'repository' | 'action' | 'navigation';
}

// Example commands:
- Switch to Workspace: [workspace name]
- View Repository: [owner/repo]
- Create New Workspace (Cmd+Shift+W)
- Add Repository to Workspace
- View Trending Repositories
- Open Settings
```

#### 2.2 Keyboard Shortcuts Hook
**File**: `src/hooks/useKeyboardShortcuts.ts`

**Shortcuts Map**:
- `Cmd+K`: Open command palette
- `Cmd+Shift+W`: Create new workspace
- `Cmd+[1-9]`: Quick switch to workspace by index
- `Cmd+/`: Toggle command palette help
- `Escape`: Close any modal/palette

### Phase 3: Enhanced Navigation (Priority: MEDIUM)

#### 3.1 Workspace Breadcrumbs
**Component**: `src/components/navigation/WorkspaceBreadcrumbs.tsx`

**Structure**:
```
Home > [Workspace Name] > [View/Tab] > [Sub-view]
```

**Features**:
- Clickable navigation to each level
- Workspace tier badge inline
- Truncate long names with tooltip
- Mobile-responsive (collapse to "..." on small screens)

#### 3.2 Mobile Navigation Enhancement
**Updates to**: `src/components/common/layout/lazy-navigation-sheet.tsx`

**Features**:
- Workspace section in hamburger menu
- Current workspace highlighted
- Collapsible workspace list
- Touch-optimized spacing
- Swipe gestures for workspace switching

### Phase 4: Onboarding & Templates (Priority: MEDIUM)

#### 4.1 Onboarding Tour
**Component**: `src/components/workspace/OnboardingTour.tsx`

**Tour Steps**:
1. Welcome to Workspaces (overview)
2. Workspace Switcher location and usage
3. Command Palette introduction (try Cmd+K)
4. Dashboard overview (metrics, repositories, activity)
5. Adding repositories to workspace
6. Inviting team members
7. Customizing workspace settings

**Implementation**:
- Use `react-joyride` or similar library
- Store completion state in localStorage
- Skip option available
- Progress indicator
- Tooltips with action buttons

#### 4.2 Workspace Templates
**File**: `src/data/workspace-templates.ts`

**Templates** (2 repositories each):

1. **Open Source Project**
   - microsoft/vscode (TypeScript, 173k stars)
   - continuedev/continue (TypeScript, 27k stars)
   - *Use case*: Managing open source projects

2. **Development Tools**
   - vitejs/vite (TypeScript, 73k stars)
   - better-auth/better-auth (TypeScript, 15k stars)
   - *Use case*: Frontend development ecosystem

3. **Infrastructure & DevOps**
   - kubernetes/kubernetes (Go, 115k stars)
   - argoproj/argo-cd (Go, 19k stars)
   - *Use case*: Cloud native infrastructure

4. **AI/ML Tools**
   - ollama/ollama (Go, 149k stars)
   - pgvector/pgvector (C, 16k stars)
   - *Use case*: AI/ML development stack

5. **Documentation & Community**
   - github/docs (JavaScript, 15k stars)
   - vercel/ai (TypeScript, 16k stars)
   - *Use case*: Documentation and developer resources

**Template Structure**:
```typescript
interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  repositories: Array<{
    tracked_repository_id: string;
    full_name: string;
    description: string;
    is_pinned: boolean;
  }>;
  suggested_settings: {
    is_public: boolean;
    default_view: 'dashboard' | 'activity' | 'repositories';
  };
}
```

## Technical Architecture

### State Management
```
┌─────────────────┐
│  WorkspaceContext│
│   (Global State) │
└────────┬─────────┘
         │
    ┌────▼────┐
    │localStorage│
    │(Persistence)│
    └────┬─────┘
         │
┌────────▼─────────┐
│ Component Tree   │
├──────────────────┤
│ - Layout         │
│ - WorkspaceSwitcher│
│ - CommandPalette │
│ - Breadcrumbs    │
└──────────────────┘
```

### Data Flow
1. User triggers action (keyboard shortcut, click)
2. Component dispatches to WorkspaceContext
3. Context updates state and localStorage
4. Supabase hooks fetch new data if needed
5. UI updates optimistically, then reconciles

### Performance Optimizations
- Preload workspace data on hover (50ms delay)
- Cache workspace metadata for 5 minutes
- Use React.lazy for command palette
- Virtual scrolling for long lists
- Debounce search input (200ms)
- Use CSS transitions for smooth switching

## Acceptance Criteria

### Phase 1 Complete When:
- [✅] Workspace switcher visible in navigation
- [✅] Can switch between workspaces without page reload
- [✅] Recent workspaces tracked and displayed
- [✅] Workspace context persists across sessions
- [✅] Loading states are smooth and non-blocking

### Phase 2 Complete When:
- [x] Command palette opens with Cmd+K
- [x] Can search and navigate to any repository
- [x] Can switch workspaces via command palette
- [x] Repository metadata displayed in results
- [x] Keyboard navigation fully functional
- [x] Recent items section populated

### Phase 3 Complete When:
- [x] Breadcrumbs show full navigation path
- [x] Mobile navigation includes workspace section
- [x] All navigation elements responsive
- [x] Touch gestures work on mobile
- [x] Workspace tier badges displayed

### Phase 4 Complete When:
- [x] Onboarding tour covers all key features
- [x] Templates available during workspace creation
- [x] Each template has exactly 2 repositories
- [x] Template repositories are pre-configured
- [x] Tour completion tracked in analytics

## Risk Mitigation

### Performance Risks
- **Risk**: Command palette slow with many repositories
- **Mitigation**: Implement virtual scrolling, limit initial results to 20

### UX Risks
- **Risk**: Too many keyboard shortcuts confuse users
- **Mitigation**: Show shortcuts in UI, provide help modal

### Technical Risks
- **Risk**: State sync issues across tabs
- **Mitigation**: Use BroadcastChannel API for cross-tab communication

## Testing Strategy

### Unit Tests
- WorkspaceSwitcher component logic
- Command palette search algorithm
- Keyboard shortcut handlers
- Template data validation

### Integration Tests
- Workspace switching flow
- Command palette navigation
- Breadcrumb navigation
- Mobile navigation gestures

### E2E Tests
- Complete onboarding tour
- Create workspace from template
- Switch workspaces via all methods
- Repository navigation via command palette

## Success Metrics (Post-Launch)

### Quantitative
- Command palette usage: >30% of daily active users
- Workspace switching time: <2 seconds average
- Onboarding completion rate: >80%
- Mobile navigation usage: >40% of mobile users
- Template usage: >60% of new workspaces

### Qualitative
- User feedback on navigation ease
- Feature discovery rate
- Power user adoption of shortcuts
- Mobile user satisfaction scores

## Timeline

**Week 1**:
- Day 1-2: Core navigation components (WorkspaceSwitcher, Context)
- Day 3-4: Command palette implementation
- Day 5: Integration testing

**Week 2**:
- Day 1-2: Enhanced navigation (breadcrumbs, mobile)
- Day 3-4: Onboarding tour and templates
- Day 5: Final testing and polish

## Dependencies

### External Libraries
- `cmdk`: Already installed for command palette
- `react-joyride`: For onboarding tour (to be added)
- No other external dependencies required

### Internal Dependencies
- Existing workspace hooks and components
- Supabase client and authentication
- React Router for navigation
- Existing UI component library

## Future Enhancements (Out of Scope)

- Workspace search within command palette
- Custom keyboard shortcut configuration
- Workspace activity feed in switcher
- AI-powered command suggestions
- Workspace sharing via command palette
- Multi-workspace view (split screen)
- Workspace groups/folders
- Command palette extensions/plugins

## Conclusion

This implementation will transform the workspace navigation experience from basic to professional-grade, making contributor.info more efficient for power users while remaining intuitive for newcomers. The phased approach ensures we can deliver value incrementally while maintaining system stability.