# GitHub Copilot Instructions for contributor.info

This document provides guidance for GitHub Copilot when assisting with the contributor.info project.

## Package Management Instructions

### Use npm instead of yarn

This project is primarily configured to use npm for package management. When suggesting commands, please use npm commands instead of yarn equivalents.

| Preferred (npm) | Avoid (yarn) |
|-----------------|--------------|
| `npm install` | `yarn` or `yarn install` |
| `npm run build` | `yarn build` |
| `npm run dev` | `yarn dev` |
| `npm run test` | `yarn test` |
| `npm run lint` | `yarn lint` |
| `npm run preview` | `yarn preview` |

Example: When suggesting how to build the project, use:
```bash
npm run build
```

### Installing dependencies

When adding new dependencies, use npm:

```bash
# Adding production dependencies
npm install package-name

# Adding development dependencies 
npm install --save-dev package-name
```

## Project Structure and Code Style

When generating or modifying code for this project, please follow these guidelines:

1. Use TypeScript for all new files
2. Follow the existing component structure and patterns
3. Use Radix UI components where appropriate
4. Use Tailwind CSS for styling
5. Follow the existing naming conventions throughout the codebase

## Type Definitions

- Place shared interface/type definitions in `src/lib/types.ts`
- Ensure types are properly exported and imported where needed
- Use precise typing and avoid `any` where possible

## Error Handling and Code Cleanup

When fixing build errors or improving code quality:

1. Always check for unused imports, variables, and types first
2. Prioritize removing dead code rather than adding new code to fix type errors
3. When encountering TypeScript errors about unused variables or imports:
   - Remove the unused imports/variables rather than using them artificially
   - Only add back variables/imports if they're truly needed
4. Before implementing new features, check if similar functionality already exists
5. Remove commented-out code that's no longer relevant

Example approach for fixing TypeScript errors:
```typescript
// Instead of this:
import { useState, useEffect } from 'react'; // useEffect is flagged as unused
// Using useEffect artificially to avoid the error
useEffect(() => {}, []); 

// Do this:
import { useState } from 'react'; // Remove the unused import entirely
```

## Error Handling in Catch Blocks
When handling errors in catch blocks, always follow these guidelines:

1. **Properly type-check errors before accessing properties**
   - In TypeScript, caught errors have the type `unknown` by default
   - Always use `instanceof Error` before accessing Error properties:

```typescript
try {
  // code that might throw
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    // Handle AbortError specifically
  } else if (err instanceof Error) {
    // Access standard Error properties safely
    console.error(err.message);
  } else {
    // Handle non-Error objects
    console.error("An unknown error occurred:", err);
  }
}
```

## Testing

When writing tests:

- Use Vitest for testing
- Place test files in `__tests__` directories alongside the code being tested
- Follow the existing testing patterns in the project

## Suggested Commands for Common Tasks

- Start development server: `npm run dev`
- Run tests: `npm run test`
- Run tests in watch mode: `npm run test:watch`
- Build the project: `npm run build`
- Preview the production build: `npm run preview`
- Lint the codebase: `npm run lint`

## Build Commands

When making changes to the codebase, please run the following commands to ensure code quality:

```bash
npm run build
```

This command will:
1. Run all tests
2. Check TypeScript types
3. Build the production bundle

## React Imports Guidelines

**Do not import React** unless you need specific React features (hooks, types, etc.). Modern React with JSX Transform handles JSX automatically.

```typescript
// ❌ Bad - unnecessary React import causes TypeScript errors
import React from "react";
import { cn } from "@/lib/utils";

// ✅ Good - only import what you need
import { cn } from "@/lib/utils";
```

Only import React when you need specific features:
```typescript
// ✅ Good - using React features
import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
```

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

## Task Generation from PRDs

When generating task lists from existing PRDs, follow this structured approach:

### Goal

To create detailed, step-by-step task lists in Markdown format based on existing Product Requirements Documents (PRDs). The task list should guide a developer through implementation.

### Output Specifications

- **Format:** Markdown (`.md`)
- **Location:** `/tasks/`
- **Filename:** `tasks-[prd-file-name].md` (e.g., `tasks-prd-user-profile-editing.md`)

### Generation Process

1. **Receive PRD Reference:** User points to a specific PRD file
2. **Analyze PRD:** Read and analyze the functional requirements, user stories, and other sections
3. **Phase 1: Generate Parent Tasks:** Create high-level tasks (typically ~5). Present to user and wait for confirmation
4. **Wait for Confirmation:** Pause and wait for user to respond with "Go"
5. **Phase 2: Generate Sub-Tasks:** Break down each parent task into smaller, actionable sub-tasks
6. **Identify Relevant Files:** List potential files that need creation or modification
7. **Generate Final Output:** Combine into structured Markdown format

### Task List Output Format

The generated task list must follow this structure:

```markdown
## Relevant Files

- `path/to/potential/file1.ts` - Brief description of why this file is relevant
- `path/to/file1.test.ts` - Unit tests for `file1.ts`
- `path/to/another/file.tsx` - Brief description
- `path/to/another/file.test.tsx` - Unit tests for `another/file.tsx`

### Notes

- Unit tests should typically be placed alongside the code files they are testing
- Use `npx jest [optional/path/to/test/file]` to run tests

## Tasks

- [ ] 1.0 Parent Task Title
  - [ ] 1.1 [Sub-task description 1.1]
  - [ ] 1.2 [Sub-task description 1.2]
- [ ] 2.0 Parent Task Title
  - [ ] 2.1 [Sub-task description 2.1]
- [ ] 3.0 Parent Task Title
```

### Target Audience

Assume the primary reader of the task list is a **junior developer** who will implement the feature.

## Supabase Integration Guidelines

### Environment Setup

The project uses Supabase for data persistence. Key environment variables:

```bash
VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_TOKEN=your-service-role-key  # For admin operations
```

### Database Schema

The database has 11 core tables for storing GitHub contributor data:
- `contributors`, `repositories`, `pull_requests`, `reviews`, `comments`
- `organizations`, `contributor_organizations`, `tracked_repositories`
- `monthly_rankings`, `daily_activity_snapshots`, `sync_logs`

Plus 3 views: `contributor_stats`, `repository_stats`, `recent_activity`

### Debugging Supabase Issues

#### 1. Check Migration Status
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Count records
SELECT 'contributors' as table_name, COUNT(*) FROM contributors
UNION ALL SELECT 'repositories', COUNT(*) FROM repositories
UNION ALL SELECT 'pull_requests', COUNT(*) FROM pull_requests;
```

#### 2. Test Database Connection
```javascript
// Quick connection test
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('contributors')
  .select('*')
  .limit(1);
  
console.log('Connection test:', { data, error });
```

#### 3. Common Issues & Fixes

**Tables not found after migration:**
- Check UUID extension: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- Run migration via Supabase Dashboard if CLI fails

**RLS blocking all access:**
```sql
-- Check policies
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';

-- Quick fix - ensure public read
CREATE POLICY "public_read" ON table_name 
FOR SELECT USING (true);
```

**Authentication issues:**
```javascript
// Check auth state
const { data: { session } } = await supabase.auth.getSession();
console.log('Auth session:', session);
```

#### 4. Storage Monitoring
```sql
-- Check database size (500MB free limit)
SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb;

-- Table sizes
SELECT tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
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
- mock supabase in tests always
- jest is leveraged in the storybook only
- use the /docs folder for postmortems and /tasks for plans. remove plans when feature is implemented, but write docs when plans are completed
- after visual changes always look for opportunity to improve performance
- no premmature optimizations without testing
- use the supabase mcp server for migrations

FILENAMES should be `this-is-component.tsx` and not `ThisIsComponent.tsx` or `this_is_component.tsx`. Use kebab-case for filenames.