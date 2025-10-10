---
globs: "**/*"
description: Verification Requirements Before Making Claims
alwaysApply: true
---

# Verification Requirements Before Making Claims

**CRITICAL**: Before claiming something is missing, incorrect, or needs improvement, you MUST verify your claims.

## Mandatory Verification Steps

### 1. Database Constraints and Foreign Keys
**Before claiming missing database constraints:**
- ✅ **MUST CHECK**: Read actual Supabase migration files in `supabase/migrations/*.sql`
- ✅ **MUST VERIFY**: Look for `REFERENCES`, `ON DELETE`, `ON UPDATE` clauses
- ✅ **UNDERSTAND**: Database constraints are defined in SQL, not TypeScript interfaces

**Example of INCORRECT review**:
> "Missing foreign key constraint for user_id"

**Example of CORRECT review**:
> "Foreign key constraint properly implemented in `supabase/migrations/20251009_add_responded_tracking.sql:6` with `REFERENCES auth.users(id) ON DELETE SET NULL`"

### 2. UUID Type Patterns
**Before claiming UUID/string type mismatches:**
- ✅ **UNDERSTAND**: In Supabase/PostgreSQL, UUIDs are represented as strings in TypeScript/JavaScript
- ✅ **PATTERN**: `string` type for UUID columns is CORRECT, not a type mismatch
- ❌ **NEVER claim**: "UUID should be UUID type instead of string"

### 3. UI Refresh and State Management
**Before claiming missing refresh functionality:**
- ✅ **SEARCH FOR**: Optimistic update patterns like `onItemMarkedAsResponded?.()`
- ✅ **SEARCH FOR**: State updates that happen before API calls
- ✅ **UNDERSTAND**: Optimistic updates are better UX than post-update refreshes

**Pattern to recognize**:
```typescript
// Optimistic update (BETTER UX)
onItemMarkedAsResponded?.(); // Updates UI immediately
await markAsResponded(id);   // Then updates database
```

### 4. Implementation Verification
**Before claiming functionality doesn't exist:**
- ✅ **SEARCH**: Use grep/search for function names, patterns, imports
- ✅ **CHECK**: Look in related files, components, hooks
- ✅ **VERIFY**: Check if suggested code already exists

## High-Priority Verification Areas

### Supabase Projects
- Database constraints are in `.sql` files, not TypeScript
- UUIDs are strings in JavaScript/TypeScript (this is correct)
- RLS policies may handle security instead of application code

### React Projects
- Optimistic updates are preferred over post-action refreshes
- State management may use custom hooks
- Error handling may use toast notifications or context

### TypeScript Projects
- Interfaces describe shapes, not database constraints
- `any` types are forbidden - check for proper typing
- Import patterns should follow project conventions

## Review Quality Standards

### ✅ Evidence-Based Claims
- Include file paths and line numbers
- Reference actual code patterns found in the codebase
- Cite specific migration files or implementation details

### ❌ Assumption-Based Claims
- Don't claim something is missing without searching
- Don't suggest patterns that already exist
- Don't misunderstand framework-specific conventions

## Example Reviews

### BAD Review (No Verification)
> "Missing foreign key constraints and UUID type mismatch. Need to add refresh after update."

### GOOD Review (Verified Claims)
> "Foreign key constraints properly implemented in `supabase/migrations/20251009_add_tracking.sql:6`. UUID handling follows correct Supabase pattern (string type). Optimistic UI updates implemented via `onItemMarkedAsResponded` callback in `ResponseModal.tsx:135` provide better UX than post-update refresh."

## Remember
The goal is **accuracy and helpfulness**, not showing knowledge. Verify before claiming, and acknowledge when patterns are correctly implemented.