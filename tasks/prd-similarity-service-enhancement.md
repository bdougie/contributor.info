# Product Requirements Document: Similarity Service Enhancement

## Project Overview

**Objective**: Create a comprehensive similarity service for contributor.info that works both as a GitHub Action (without installation) and as an enhanced GitHub App feature.

**Background**: contributor.info already has excellent similarity capabilities with ML embeddings and pgvector. We need to extend this to work via GitHub Actions for broader reach and add cross-repository functionality.

**Success Metrics**:
- GitHub Actions workflow processes 100+ repositories monthly
- 30% increase in app installations from action users
- Cross-repo similarity detection reduces duplicate issues by 20%

## Current State Analysis

### ✅ Existing Strengths
- **MiniLM Embeddings**: 384-dimensional vectors with high accuracy
- **pgvector Integration**: Efficient PostgreSQL similarity search
- **Webhook Processing**: Complete GitHub App with auto-commenting
- **Database Schema**: Well-designed with proper indexing
- **ML Pipeline**: Production-ready embedding generation

### 🔧 Gaps to Address
- **No GitHub Actions Integration**: Can't help non-installed repos
- **Single Repository Scope**: No cross-repo duplicate detection
- **PR Similarity**: Uses rule-based vs ML-based approach
- **Limited Reach**: Requires app installation

## Implementation Plan

### Phase 1: GitHub Actions MVP (Priority: HIGH)
**Timeline**: 2 weeks
**Goal**: Enable similarity without installation

#### Deliverables
- [ ] GitHub Actions workflow `.github/workflows/similarity-check.yml`
- [ ] Script `scripts/actions-similarity.ts` for standalone processing
- [ ] Unified ML-based similarity for issues and PRs
- [ ] Installation encouragement in comments
- [ ] Support for 50 issues + 50 PRs processing

#### Technical Approach
```typescript
// Reuse existing similarity logic
import { processNewIssue, generateIssueEmbedding } from '../app/services/issue-similarity';

// New GitHub Actions entry point
async function processSimilarity(owner: string, repo: string) {
  // Fetch 50 latest issues + 50 latest PRs
  // Generate embeddings
  // Find similarities
  // Post comments with installation CTA
}
```

#### Acceptance Criteria
- ✅ Works on any public repository
- ✅ Processes 100 latest items efficiently
- ✅ Uses same ML model as main app
- ✅ Includes gentle installation prompts
- ✅ Handles rate limits gracefully

### Phase 2: Chroma Integration & Full Indexing (Priority: HIGH)
**Timeline**: 3 weeks
**Goal**: Enhanced vector database with complete repository indexing

#### Deliverables
- [ ] Chroma vector database integration
- [ ] Full repository indexing (all open/closed items)
- [ ] Enhanced similarity algorithms
- [ ] Batch processing capabilities
- [ ] Migration from pgvector to hybrid approach

#### Technical Approach
- Install Chroma as additional vector store
- Migrate existing embeddings to Chroma
- Implement incremental updates
- Add batch processing for large repositories

### Phase 3: Cross-Repository Similarity (Priority: MEDIUM)
**Timeline**: 2 weeks
**Goal**: Detect duplicates across different repositories

#### Deliverables
- [ ] Cross-repo similarity search
- [ ] Organization-wide duplicate detection
- [ ] Enhanced comment formatting
- [ ] Privacy controls for cross-repo access

### Phase 4: AI-Powered Learning (Priority: LOW)
**Timeline**: 3 weeks
**Goal**: Adaptive thresholds and feedback learning

#### Deliverables
- [ ] Feedback collection on similarity suggestions
- [ ] Dynamic threshold adjustment
- [ ] ML model fine-tuning pipeline
- [ ] Analytics dashboard

## Technical Architecture

### Database Schema Enhancements
```sql
-- New table for cross-repo similarities
CREATE TABLE cross_repo_similarities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_issue_id UUID REFERENCES issues(id),
    target_issue_id UUID REFERENCES issues(id),
    similarity_score FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_cross_repo_similarities_score 
ON cross_repo_similarities(similarity_score DESC);
```

### API Endpoints
```typescript
// New GitHub Actions API endpoint
POST /api/actions/similarity-check
{
  "owner": "username",
  "repo": "repository",
  "installation_id": "optional"
}

// Enhanced similarity endpoint
GET /api/similarity/cross-repo/:issueId
{
  "similar_issues": [...],
  "cross_repo_matches": [...]
}
```

### GitHub Actions Workflow
```yaml
name: Similarity Check
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]
  workflow_dispatch:

jobs:
  similarity-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check for similar issues
        uses: bdougie/contributor-similarity-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          max-items: 100
          similarity-threshold: 0.85
```

## Implementation Guidelines

### Code Quality Standards
- Follow existing TypeScript patterns
- Use existing MiniLM pipeline
- Implement proper error handling
- Add comprehensive tests
- Security: Never log sensitive data

### Performance Requirements
- Process 100 items in <2 minutes
- API response time <3 seconds
- Similarity search <1 second
- Memory usage <512MB for actions

### Security Considerations
- GitHub token validation
- Rate limit handling
- Private repository access controls
- Cross-origin request protection

## Risk Mitigation

### High Risk: Rate Limits
- **Mitigation**: Implement exponential backoff
- **Fallback**: Cache GitHub API responses

### Medium Risk: Embedding Generation Performance
- **Mitigation**: Batch processing with queues
- **Fallback**: Use lighter model for actions

### Low Risk: Storage Costs
- **Mitigation**: Archive old embeddings
- **Monitor**: Set up cost alerts

## Success Metrics & KPIs

### Phase 1 Success Criteria
- [ ] 10+ repositories using GitHub Actions
- [ ] <2 minute processing time
- [ ] 5% conversion to app installation
- [ ] Zero security incidents

### Overall Success Metrics
- **Adoption**: 50+ repositories using actions monthly
- **Performance**: 95% similarity accuracy
- **Conversion**: 30% action users install app
- **Impact**: 20% reduction in duplicate issues

## Future Considerations

### Enterprise Features
- Private repository support
- Organization-wide analytics
- Custom similarity thresholds
- Integration with issue templates

### Advanced ML Features
- Multi-language code similarity
- Intent classification
- Automated labeling suggestions
- Sentiment analysis

---

*This PRD will be updated as phases are completed. ✅ marks completed items.*