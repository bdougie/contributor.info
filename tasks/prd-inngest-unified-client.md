# PRD: Inngest Unified Client Architecture

## Project Overview

### Objective
Refactor the Inngest integration to use a unified client architecture that allows functions to be properly registered across different environments (local development, staging, production) without client instance conflicts.

### Background
The current Inngest implementation creates functions with different client instances, causing registration failures in local development. Functions created in `src/lib/inngest/functions/` are bound to one client instance, while Netlify functions create their own instances, preventing proper function discovery in the Inngest dashboard.

### Success Metrics
- [x] All Inngest functions visible in local development dashboard
- [x] Zero client instance conflicts across environments
- [x] Successful event processing in all environments
- [x] Reduced code duplication in Netlify function files
- [x] Type-safe function definitions maintained

## Current State Analysis

### What Exists
- Multiple Inngest client instances across the codebase
- Functions pre-created with import-time client binding
- Separate implementations for local vs production
- Working event sending but inconsistent function registration

### What's Broken
- Functions don't appear in local Inngest dashboard
- Client instance mismatch between function definitions and serve handlers
- Difficult to test functions locally
- Code duplication across Netlify function files

### Technical Debt
- 15+ separate Inngest function files with hardcoded client references
- 10+ Netlify function endpoints with duplicate client creation logic
- No centralized configuration management

## Implementation Plan

### Phase 1: Core Infrastructure (HIGH PRIORITY) ✅
**Status: COMPLETED**

#### Deliverables
- [x] Create factory pattern for function creation (`src/lib/inngest/functions/factory.ts`)
- [x] Implement shared client configuration module (`src/lib/inngest/client-config.ts`)
- [x] Update main client to use shared configuration
- [x] Test factory pattern with sample functions

#### Technical Implementation
```typescript
// Factory pattern example
export function createInngestFunctions(inngest: Inngest) {
  return {
    functionName: inngest.createFunction(...),
    // ... more functions
  };
}
```

### Phase 2: Function Migration (HIGH PRIORITY)
**Status: PENDING**

#### Deliverables
- [ ] Convert all capture functions to factory pattern
- [ ] Convert classification functions to factory pattern
- [ ] Convert update/sync functions to factory pattern
- [ ] Create comprehensive function index with factory exports

#### Functions to Migrate
1. **Capture Functions** (Priority: Critical)
   - [ ] capture-pr-details.ts
   - [ ] capture-pr-details-graphql.ts
   - [ ] capture-pr-reviews.ts
   - [ ] capture-pr-comments.ts
   - [ ] capture-issue-comments.ts
   - [ ] capture-repository-issues.ts
   - [ ] capture-repository-sync.ts
   - [ ] capture-repository-sync-graphql.ts

2. **Classification Functions** (Priority: High)
   - [ ] classify-repository-size.ts
   - [ ] classify-single-repository.ts

3. **Update Functions** (Priority: Medium)
   - [ ] update-pr-activity.ts
   - [ ] discover-new-repository.ts
   - [ ] aggregate-workspace-metrics.ts

#### Migration Pattern
```typescript
// Before: Direct client usage
export const functionName = inngest.createFunction(...);

// After: Factory function
export function createFunctionName(inngest: Inngest) {
  return inngest.createFunction(...);
}
```

### Phase 3: Netlify Function Updates (MEDIUM PRIORITY)
**Status: COMPLETED**

#### Deliverables
- [x] Update inngest-local-full.mts to use factory pattern
- [x] Update inngest-prod.mts to use factory pattern
- [x] Consolidate inngest-sync.mts into inngest-prod.mts
- [x] Remove duplicate inngest-sync.mts file
- [x] Update netlify.toml redirects to point to unified endpoint
- [x] Update all Netlify function endpoints to use unified client
- [x] Consolidate duplicate client creation logic
- [x] Implement environment-specific client selection
- [x] Add comprehensive logging for debugging

#### Netlify Functions Updated
- [x] inngest-local.mts (removed - consolidated)
- [x] inngest-local-full.mts (updated with factory)
- [x] inngest-prod.mts (updated with factory)
- [x] inngest-sync.mts (removed - consolidated into inngest-prod)

### Phase 4: Testing & Documentation (MEDIUM PRIORITY)
**Status: PENDING**

#### Deliverables
- [ ] Create unit tests for factory functions
- [ ] Add integration tests for client configuration
- [ ] Document new architecture in `/docs/data-fetching/inngest-unified-architecture.md`
- [ ] Update existing Inngest documentation
- [ ] Create migration guide for future functions

#### Test Coverage Requirements
- Factory function creation
- Client configuration per environment
- Event sending and receiving
- Function registration verification
- Environment variable handling

## Technical Guidelines

### Architecture Decisions
1. **Factory Pattern**: All functions must be created via factories that accept client instances
2. **Centralized Configuration**: Single source of truth for client configuration
3. **Environment Detection**: Automatic environment detection with override capabilities
4. **Type Safety**: Maintain full TypeScript type safety throughout

### Code Organization
```
src/lib/inngest/
├── client-config.ts       # Shared configuration
├── client.ts              # Default client instance
├── functions/
│   ├── factory.ts         # Main factory module
│   ├── factories/         # Individual function factories
│   │   ├── capture.ts
│   │   ├── classify.ts
│   │   └── update.ts
│   └── index.ts          # Unified exports
```

### Best Practices
- Never create functions at module import time
- Always use factory functions for flexibility
- Log client configuration in development
- Validate environment variables at startup
- Use consistent naming conventions

## Acceptance Criteria

### Phase 1 ✅
- [x] Factory pattern implemented and tested
- [x] Client configuration module created
- [x] Sample functions working with factory

### Phase 2
- [ ] All 15+ functions converted to factory pattern
- [ ] No hardcoded client references remain
- [ ] Functions properly grouped by type
- [ ] Comprehensive factory exports available

### Phase 3 ✅
- [x] All Netlify functions use unified client
- [x] Environment-specific configuration working
- [x] Proper function registration in all environments
- [x] Dashboard shows all functions correctly

### Phase 4
- [ ] 80% test coverage for new modules
- [ ] Complete documentation available
- [ ] Migration guide created
- [ ] No regression in existing functionality

## Risk Mitigation

### Potential Risks
1. **Breaking Changes**: Existing function references may break
   - Mitigation: Maintain backward compatibility during migration

2. **Environment Variable Issues**: Missing or incorrect env vars
   - Mitigation: Add validation and clear error messages

3. **Performance Impact**: Factory pattern overhead
   - Mitigation: Lazy initialization and caching

4. **Type Safety Loss**: Dynamic function creation may lose types
   - Mitigation: Careful TypeScript generic usage

## Timeline

- **Phase 1**: ✅ Completed
- **Phase 2**: 2-3 days (High complexity due to number of functions) - PENDING
- **Phase 3**: ✅ Completed
- **Phase 4**: 1 day (Documentation and testing) - PENDING

**Total Estimated Time**: 3-4 days remaining (Phase 2 & 4)

## Dependencies

- Inngest SDK version compatibility
- Environment variable availability
- Netlify function runtime support
- TypeScript 4.x+ for advanced type features

## Open Questions

1. Should we maintain backward compatibility or force migration?
2. How to handle functions that require special configuration?
3. Should we implement function versioning for gradual rollout?
4. Do we need a feature flag for the new architecture?

## Next Steps

1. Review and approve this PRD
2. Begin Phase 2 function migration
3. Set up testing environment
4. Schedule review checkpoint after Phase 2

---

**Document Status**: Active
**Last Updated**: 2025-09-23
**Author**: Claude
**Reviewers**: Pending

## Implementation Summary (Added 2025-09-23)

### Completed Work
1. **Phase 1 & 3**: Successfully implemented unified client architecture with factory pattern
2. **Critical Bug Fixes**:
   - Fixed Supabase validation schemas for nested reviews
   - Deployed missing edge function with CORS support
   - Added missing database fields (repository_full_name, html_url) to all sync functions
3. **Production Deployment**: All changes tested with Kubernetes repository (large repo test case)

### Remaining Work
- **Phase 2**: Migrate individual functions to factory pattern (not blocking production)
- **Phase 4**: Documentation and testing coverage