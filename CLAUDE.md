# Claude Development Guidelines

<critical>
    Never write env variables inline into scripts. Especially SUPABASE tokens keys and urls.
    Delete scripts when they are not reference anywhere and one time use.
</critical>

## Build Commands

When making changes to the codebase, please run the following commands to ensure code quality:

```bash
npm run build
```

This command will:
2. Check TypeScript types
3. Build the production bundle

## Project Overview

This is a React + TypeScript application that visualizes GitHub contributors and their contributions.

### Repository Tracking System (Updated Jan 2025)

The application now uses a **manual, user-initiated repository tracking system**:
- Users explicitly choose which repositories to track via "Track This Repository" button
- No automatic discovery or tracking happens without user action
- Untracked repositories show a tracking card instead of errors
- See `docs/data-fetching/manual-repository-tracking.md` for full details

## Design
All components should match the existing design language.
Storybook should be leverage to build and validate ui first

## Project Planning

When working on larger features or multi-step implementations, use Product Requirements Documents (PRDs) to plan and track progress:

### PRD Best Practices

1. **Location**: Store PRDs in the `/tasks/` folder with descriptive names (e.g., `prd-skeleton-loaders.md`) and gh issues when neccessary

2. **Structure**: Include these sections:
   - **Project Overview**: Objective, background, success metrics
   - **Current State Analysis**: What exists, what's broken, what needs improvement
   - **Implementation Plan**: Break work into phases with clear priorities
   - **Technical Guidelines**: Architecture decisions, patterns to follow
   - **Acceptance Criteria**: Specific, measurable outcomes for each phase

3. **Phase-Based Implementation**:
   - Break large features into 2-4 phases based on priority and dependencies
   - Each phase should be completable in 1-3 days
   - Mark phases as completed with ✅ as work progresses
   - Use clear priority levels: HIGH, MEDIUM, LOW

4. **Progress Tracking**:
   - Update the PRD as you complete tasks, marking items with ✅
   - Add implementation summaries after each phase
   - Include test coverage and impact metrics
   - Document architectural decisions and patterns established

5. **Examples**:
   - See `/tasks/prd-skeleton-loaders.md` for a well-structured PRD example
   - Notice how it breaks skeleton implementation into logical phases
   - Each phase has clear deliverables and acceptance criteria

### When to Create a PRD

Create a PRD when:
- The feature spans multiple components or files
- Implementation will take more than 1-2 days
- The work involves architectural decisions
- You need to coordinate multiple related changes
- The user requests comprehensive planning before implementation

## Supabase Integration

### Environment Setup

The project uses Supabase for data persistence. Key environment variables:

```bash
VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Key Files for Supabase

- `supabase/migrations/20240614000000_initial_contributor_schema.sql` - Database schema
- `supabase/apply-rls-policies.sql` - Row Level Security policies
- `supabase/IMPLEMENTATION_GUIDE.md` - Complete setup documentation
- `supabase/QUICK_REFERENCE.md` - Common commands and queries
- `src/lib/supabase.ts` - Supabase client configuration

### Important Notes

1. **Progressive Onboarding**: RLS allows public read access, so first search works without login
2. **MCP Server**: Configured in `.mcp.json` for direct database access
3. **Docker Issues**: Use Supabase Dashboard SQL Editor when Docker isn't running
4. **Storage**: Each large repo uses ~400MB/year. Plan archival for old data.

## Development Memories

- Replaced all require() calls with proper ES module patterns in storybook
- remember to use bulletproof testing practices, only when absolutely need in e2e tests
- never use jest. only vitest
- jest is leveraged in the storybook only
- use the /docs folder for postmortems and /tasks for plans. remove plans when feature is implemented, but write docs when plans are completed
- after visual changes always look for opportunity to improve performance
- no premmature optimizations without testing
- use the supabase mcp server for migrations
- `console.log(\`${owner}\`)` is a security vulnerability. We need to do `console.log(%s, owner)`
- optimized for user experience with modern tooling and excellent dependency management. prioritize immediate value delivery over pure performance metrics.
- never use "any" types in typescript
- script need to be documented and organized into folders/readmes

## Known Issues

### Repository Tracking Changes (Jan 2025)

**Update**: The automatic repository tracking system has been replaced with manual, user-initiated tracking.
- Old auto-tracking hooks (`useAutoTrackRepository`) have been removed
- Discovery now happens via explicit user action through UI buttons
- This change improves transparency and user control over data collection

## User Experience Standards

This project follows an **invisible, Netflix-like user experience** where data loading and processing happens automatically in the background. Key principles:

1. **Database-first**: Always query cached data before API calls
2. **Auto-detection**: Automatically detect and fix data quality issues
3. **Subtle notifications**: Keep users informed without interrupting workflow
4. **Progressive enhancement**: Core functionality works immediately, enhanced features load in background
5. **No manual intervention**: Users never need to click "Load Data" or understand technical details

### Implementation Guidelines

- **New Features**: Follow `/docs/user-experience/feature-template.md` for consistent UX patterns
- **Data Loading**: Use `/docs/user-experience/implementation-checklist.md` for proper auto-detection integration
- **User Notifications**: Reference `/docs/user-experience/invisible-data-loading.md` for notification standards
- **Bullet proof testing**: `/docs/testing/BULLETPROOF_TESTING_GUIDELINES.md` for keeping tests maintainable. e2e tests only when necessary

### Key Files for UX Consistency
- `src/lib/progressive-capture/smart-notifications.ts` - Auto-detection on page load
- `src/lib/progressive-capture/background-processor.ts` - Invisible background work
- `src/lib/progressive-capture/ui-notifications.ts` - User-friendly notifications

When implementing features that load data or process information in the background, always ensure:
- Immediate value with cached data
- Automatic detection and improvement of data quality
- Subtle, helpful notifications (not technical jargon)
- Graceful error handling and fallbacks
- check the bulletproof testing doc before fixing tests
