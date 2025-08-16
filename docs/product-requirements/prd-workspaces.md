# Product Requirements Document: Workspaces Feature

## Project Overview

### Objective
Implement a workspaces feature that allows users to group multiple repositories together for aggregated insights and team collaboration, similar to OpenSauced workspaces.

### Background
Users currently can only view one repository at a time. Teams and organizations need to track metrics across multiple repositories to understand their overall project health and contributor engagement.

### Success Metrics
- Users can create and manage workspaces with multiple repositories
- Aggregated metrics display correctly across all workspace repositories
- Team collaboration features enable sharing insights
- Performance remains optimal with up to 50 repositories per workspace

## Current State Analysis

### What Exists
- Single repository analysis and metrics
- Individual contributor tracking
- GitHub authentication and data fetching
- Supabase database for persistence

### What's Missing
- Multi-repository grouping capability
- Aggregated metrics across repositories
- Team collaboration features
- Persistent workspace configurations

## Implementation Plan

### Phase 1: Core Infrastructure (HIGH PRIORITY)
- [ ] Database schema for workspaces
  - workspaces table
  - workspace_repositories junction table
  - workspace_members table
- [ ] Basic CRUD API endpoints
- [ ] Repository association logic

### Phase 2: Dashboard & Metrics (HIGH PRIORITY)
- [ ] Workspace dashboard UI
- [ ] Aggregated metrics calculation
  - Total PRs (opened/merged)
  - Total issues (opened/closed)
  - Combined stars/forks
  - Activity velocity metrics
- [ ] Repository list within workspace

### Phase 3: Repository Management (MEDIUM PRIORITY)
- [ ] Search and add repositories
- [ ] Bulk import from organizations
- [ ] URL list paste functionality
- [ ] Repository removal interface

### Phase 4: Team Features (MEDIUM PRIORITY)
- [ ] Member invitation system
- [ ] Role-based permissions (owner, editor, viewer)
- [ ] Public/private workspace settings
- [ ] Activity feed

### Phase 5: Enhanced Analytics (LOW PRIORITY)
- [ ] Detailed activity tables
- [ ] Cross-repository contributor leaderboard
- [ ] Time-series trend charts
- [ ] Export functionality

## Technical Guidelines

### Architecture Decisions
- Use existing Supabase infrastructure for data persistence
- Leverage React Query for caching workspace data
- Background jobs for metric aggregation using existing patterns
- Reuse existing components where possible

### Data Model
```sql
-- Core workspace table
CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES contributors(id),
    visibility TEXT DEFAULT 'public',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Repository associations
CREATE TABLE workspace_repositories (
    workspace_id UUID REFERENCES workspaces(id),
    repository_id UUID REFERENCES repositories(id),
    added_at TIMESTAMPTZ,
    added_by UUID REFERENCES contributors(id),
    PRIMARY KEY (workspace_id, repository_id)
);

-- Team members
CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id),
    user_id UUID REFERENCES contributors(id),
    role TEXT NOT NULL,
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    PRIMARY KEY (workspace_id, user_id)
);
```

### API Design
```typescript
// Workspace operations
POST   /api/workspaces                          // Create workspace
GET    /api/workspaces                          // List user's workspaces
GET    /api/workspaces/:id                      // Get workspace details
PUT    /api/workspaces/:id                      // Update workspace
DELETE /api/workspaces/:id                      // Delete workspace

// Repository management
POST   /api/workspaces/:id/repositories         // Add repositories
DELETE /api/workspaces/:id/repositories/:repoId // Remove repository

// Team management
POST   /api/workspaces/:id/members              // Invite member
PUT    /api/workspaces/:id/members/:userId      // Update member role
DELETE /api/workspaces/:id/members/:userId      // Remove member

// Analytics
GET    /api/workspaces/:id/metrics              // Get aggregated metrics
GET    /api/workspaces/:id/activity             // Get activity feed
```

## Acceptance Criteria

### Phase 1 Complete When:
- Database migrations successfully applied
- Users can create, read, update, delete workspaces via API
- Repositories can be associated with workspaces

### Phase 2 Complete When:
- Workspace dashboard displays aggregated metrics
- Metrics update within 5 minutes of changes
- UI responsive on mobile devices

### Phase 3 Complete When:
- Users can add repositories via search, org import, or URL list
- Duplicate repositories prevented
- Smooth UX for managing large lists

### Phase 4 Complete When:
- Team members can be invited and managed
- Role permissions properly enforced
- Activity feed shows workspace changes

### Phase 5 Complete When:
- Analytics provide actionable insights
- Data can be exported for reporting
- Performance optimized for large datasets

## Related Issues
- Main Issue: #98 - Workspace Implementation
- Sub-issues to be created based on phases above

## Notes
- Consider rate limiting for API endpoints
- Plan for data archival for workspaces with many repositories
- Ensure backwards compatibility with existing single-repo features
- Follow existing UI/UX patterns from contributor.info