# PRD: App Stats - PR Reviewer Suggestions & Configuration

## Project Overview

### Objective
Enhance the contributor.info GitHub App to automatically suggest reviewers for pull requests based on CODEOWNERS files, git history analysis, and file similarity. Additionally, implement a `.contributor` configuration file to allow repositories to customize the app's behavior.

### Background
The current implementation posts contributor insights when PRs are opened, but doesn't suggest specific reviewers based on code ownership or historical contribution patterns. This feature will make the app more valuable by helping maintainers identify the best reviewers for each PR.

### Success Metrics
- Accurate reviewer suggestions based on code ownership and expertise
- Support for CODEOWNERS file parsing and fallback to git history
- Configurable behavior via `.contributor` file
- Improved comment formatting for better readability

## Current State Analysis

### What Exists
1. **PR Webhook Handler** (`app/webhooks/pull-request.ts`):
   - Triggers on PR opened/ready_for_review
   - Posts contributor insights comment
   - Mock reviewer suggestions (not using real data)

2. **Reviewer Service** (`app/services/reviewers.ts`):
   - Has structure for suggesting reviewers
   - Currently returns mock data
   - Scoring system in place but not connected to real data

3. **Comment Formatting** (`app/services/comments.ts`):
   - Formats PR comments with insights
   - Has sections for reviewer suggestions
   - Already shows contributor stats and similar issues

### What's Missing
1. **CODEOWNERS Integration**:
   - No parsing of CODEOWNERS files
   - No GitHub API integration to fetch file contents

2. **Git History Analysis**:
   - No indexing of file contributors
   - No tracking of who modifies which files

3. **Configuration System**:
   - No `.contributor` file support
   - No way to disable features per repository

4. **Enhanced Comments**:
   - Comments could be more visually appealing
   - Need better formatting for reviewer suggestions

## Implementation Plan

### Phase 1: CODEOWNERS Integration (HIGH Priority)

**Goal**: Parse and use CODEOWNERS files for reviewer suggestions

**Tasks**:
- [x] Create CODEOWNERS parser service
  - Support standard GitHub CODEOWNERS format
  - Handle multiple patterns per line
  - Support team and user mentions
- [x] Integrate with GitHub API to fetch CODEOWNERS
  - Check `.github/CODEOWNERS` and `CODEOWNERS` in root
  - Cache parsed results
- [x] Update reviewer suggestion logic
  - Match changed files against CODEOWNERS patterns
  - Score owners based on ownership percentage
- [x] Add "Create CODEOWNERS" suggestion when missing

**Acceptance Criteria**:
- Correctly parses CODEOWNERS files
- Suggests reviewers based on file ownership
- Handles missing CODEOWNERS gracefully

### Phase 2: Git History Indexing with Embeddings (MEDIUM Priority)

**Goal**: Track file contributors through git history and use embeddings for similarity matching

**Tasks**:
- [x] Design database schema for file contributors and embeddings
  - `file_contributors` table with file paths, contributor IDs, commit counts
  - `file_embeddings` table for storing file content embeddings
  - Indexes for fast lookups and vector similarity search
- [x] Create git history indexing service
  - Process repository commits on first install
  - Update incrementally on new commits
  - Track last N commits per file (e.g., 100)
- [x] Implement file embeddings generation
  - Generate embeddings for file contents using existing embedding service
  - Store embeddings with file paths and update on file changes
  - Use pgvector for similarity search
- [x] Implement semantic file similarity matching
  - Find contributors who've worked on semantically similar files
  - Combine path-based and content-based similarity
  - Weight recent contributions higher
- [x] Update reviewer scoring with history and similarity data

**Database Schema**:
```sql
CREATE TABLE file_contributors (
  id UUID PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id),
  file_path TEXT NOT NULL,
  contributor_id UUID REFERENCES contributors(id),
  commit_count INTEGER DEFAULT 0,
  last_commit_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(repository_id, file_path, contributor_id)
);

CREATE TABLE file_embeddings (
  id UUID PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id),
  file_path TEXT NOT NULL,
  embedding vector(384), -- Using same dimension as issue embeddings
  content_hash TEXT, -- To detect when re-embedding is needed
  last_indexed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(repository_id, file_path)
);

CREATE INDEX idx_file_contributors_repo_path ON file_contributors(repository_id, file_path);
CREATE INDEX idx_file_contributors_contributor ON file_contributors(contributor_id);
CREATE INDEX idx_file_embeddings_repo_path ON file_embeddings(repository_id, file_path);
CREATE INDEX idx_file_embeddings_vector ON file_embeddings USING ivfflat (embedding vector_cosine_ops);
```

**Similarity Matching Algorithm**:
1. For each changed file in PR:
   - Find exact path matches in file_contributors
   - Find semantically similar files using vector similarity (threshold: 0.8)
   - Combine results with weights: exact match (1.0), high similarity (0.7-0.9)
2. Aggregate contributor scores across all matched files
3. Boost scores for recent contributions (decay factor based on age)

**Acceptance Criteria**:
- Indexes git history on app installation
- Generates and stores file embeddings
- Suggests reviewers based on semantic file similarity
- Updates embeddings when files change significantly

### Phase 3: Configuration System (HIGH Priority)

**Goal**: Allow repositories to configure app behavior via `.contributor` file

**Tasks**:
- [x] Define `.contributor` file schema (YAML/JSON)
  ```yaml
  version: 1
  features:
    reviewer_suggestions: true
    similar_issues: true
    auto_comment: true
  comment_style: "detailed" # or "minimal"
  exclude_authors: []
  exclude_reviewers: []
  ```
- [x] Create configuration parser service
- [x] Check for `.contributor` file on each webhook
- [x] Update webhook handlers to respect configuration
- [x] Initialize default `.contributor` file on first install

**Acceptance Criteria**:
- Reads and respects `.contributor` configuration
- Features can be toggled on/off
- Gracefully handles missing or invalid config

### Phase 4: Enhanced Comment Formatting (MEDIUM Priority)

**Goal**: Make comments more visually appealing and easier to read

**Tasks**:
- [x] Redesign reviewer suggestions section
  - Show reviewer avatars
  - Display expertise badges
  - Include response time metrics
- [x] Add visual indicators
  - Use emojis and icons effectively
  - Create clear visual hierarchy
  - Add collapsible sections for long content
- [x] Implement comment templates
  - Different styles based on configuration
  - Minimal vs detailed views
- [x] Add interactive elements
  - Links to reviewer profiles
  - Quick actions (assign reviewer, etc.)

**Acceptance Criteria**:
- Comments are visually appealing
- Information is easy to scan
- Supports both detailed and minimal styles

## Technical Guidelines

### Architecture Decisions
1. **Caching Strategy**:
   - Cache CODEOWNERS parsing results for 5 minutes
   - Cache file contributor data for 1 hour
   - Invalidate on repository updates

2. **Performance Considerations**:
   - Limit git history processing to last 6 months
   - Process large repositories in background jobs
   - Use database indexes for fast lookups

3. **Error Handling**:
   - Gracefully handle missing CODEOWNERS
   - Fall back to git history when needed
   - Never block PR creation on errors

### API Integration
1. **GitHub API Endpoints**:
   - `GET /repos/{owner}/{repo}/contents/{path}` - Fetch CODEOWNERS
   - `GET /repos/{owner}/{repo}/commits` - Get commit history
   - `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` - Get PR files

2. **Rate Limiting**:
   - Use conditional requests where possible
   - Implement exponential backoff
   - Track rate limit usage

## Migration Strategy

1. **Database Migration**:
   - Add new tables without breaking existing functionality
   - Run migrations via Supabase MCP

2. **Feature Rollout**:
   - Deploy behind feature flags initially
   - Test on contributor.info repository first
   - Gradual rollout to other installations

3. **Backward Compatibility**:
   - Maintain existing comment format
   - Add new features progressively
   - Don't break existing integrations

## Testing Strategy

1. **Unit Tests**:
   - CODEOWNERS parser with various formats
   - Configuration file validation
   - Reviewer scoring algorithm

2. **Integration Tests**:
   - GitHub API integration
   - Database queries and updates
   - End-to-end webhook processing

3. **Manual Testing**:
   - Test on repositories with/without CODEOWNERS
   - Verify comment formatting
   - Test configuration options

## Success Criteria

1. **Functionality**:
   - ✅ Accurately suggests reviewers from CODEOWNERS
   - ✅ Falls back to git history when needed
   - ✅ Respects `.contributor` configuration
   - ✅ Provides helpful CODEOWNERS creation prompt

2. **Performance**:
   - ✅ Comments posted within 5 seconds
   - ✅ No impact on PR creation time
   - ✅ Efficient database queries

3. **User Experience**:
   - ✅ Comments are visually appealing
   - ✅ Information is actionable
   - ✅ Configuration is intuitive

## Implementation Summary

All phases have been successfully implemented:

### Phase 1: CODEOWNERS Integration ✅
- Created `app/services/codeowners.ts` with full CODEOWNERS parsing support
- Integrated with GitHub API to fetch and cache CODEOWNERS files
- Updated reviewer suggestion logic to prioritize code owners
- Added helpful prompts when CODEOWNERS is missing

### Phase 2: Git History Indexing with Embeddings ✅
- Created `app/services/git-history.ts` for indexing repository commits
- Created `app/services/file-embeddings.ts` for generating and matching file embeddings
- Database migrations applied for `file_contributors` and `file_embeddings` tables
- Integrated semantic similarity matching into reviewer suggestions
- Added automatic indexing on repository installation

### Phase 3: Configuration System ✅
- Created `app/services/contributor-config.ts` for parsing `.contributor` files
- Updated webhook handlers to respect configuration settings
- Supports toggling features and comment styles
- Documentation created at `docs/configuration/contributor-file.md`

### Phase 4: Enhanced Comment Formatting ✅
- Redesigned comments with reviewer avatars in tables
- Added expertise badges based on actual file contributions
- Implemented collapsible sections for better readability
- Enhanced visual hierarchy with emojis and icons
- Added interactive links to profiles and analytics

### Additional Improvements
- Updated contributor insights to show PR count, reviews, and comments (similar to contributor of the month)
- Removed speculative features like "active hours" 
- Real expertise detection based on file contribution history
- Improved error handling and fallbacks throughout