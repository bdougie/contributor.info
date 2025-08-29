# GitHub Copilot Instructions for contributor.info

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

## Design
All components should match the existing design language.

## Project Planning with PRDs

When working on larger features or multi-step implementations, use Product Requirements Documents (PRDs) to plan and track progress:

### PRD Best Practices

1. **Location**: Store PRDs in the `/tasks/` folder with descriptive names (e.g., `prd-skeleton-loaders.md`)

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

### PRD vs Todo Lists

- **PRDs**: For strategic planning and complex features
- **Todo Lists**: For tactical execution and task tracking during implementation
- Use both together: PRD for overall strategy, todos for daily execution

## Supabase Integration

### Environment Setup

The project uses Supabase for data persistence. Key environment variables:

```bash
VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_TOKEN=your-service-role-key  # For admin operations
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

### Useful Debug Commands

```bash
# Test RLS policies
node test-rls-access.js

# Check Supabase status (requires Docker)
npx supabase status

# Apply migrations via Dashboard
# Copy contents of migration file and run in SQL Editor
```

## Development Memories

- Replaced all require() calls with proper ES module patterns in storybook
- remember to mock external dependencies in tests
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

### TypeScript Environment Variable Warnings

**Problem**: TypeScript compilation shows errors like `Property 'env' does not exist on type 'ImportMeta'` for `import.meta.env` usage.

**Root Cause**: Netlify Functions compile to CommonJS while Vite expects ESM. The `import.meta.env` pattern works at runtime but TypeScript struggles with mixed module contexts.

**Solution**: Use the fallback pattern `import.meta.env?.VAR || process.env.VAR` in environment variable files:

```typescript
// ✅ Correct pattern - works in both ESM and CommonJS
const VITE_GITHUB_TOKEN = import.meta.env?.VITE_GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
```

**Status**: These are build-time warnings that don't affect runtime functionality. The application works correctly despite these TypeScript errors.

**Files affected**: `src/lib/github.ts`, `src/lib/supabase.ts`, `src/lib/inngest/client.ts`

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

## Ephemeral GitHub Markdown Drafts (PRs, Issues, Releases, Discussions)

- When a temporary markdown file is needed, create it under `.github/` (e.g., `pr-review-comment-<number>.md` or `gh-draft-<type>-<id>.md`).
- Use the file only to pass content to tools (e.g., `gh` CLI), then delete it in the same operation—regardless of success or failure.
- Preferred: keep drafts in memory; only write a file if a tool requires a `--body-file` path.
- Never stage, commit, or push these draft files. If one appears in `git status`, delete it immediately instead of committing.
- On interruption (errors/Ctrl+C), clean up the draft before exiting.

Acceptance criteria:
- No `*.md` draft files remain under `.github/` after posting.
- The working tree and CI contain no draft artifacts.