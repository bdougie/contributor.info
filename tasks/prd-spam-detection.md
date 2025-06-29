# PRD: Spam Detection System for PR Feed

## Project Overview

**Objective**: Implement a comprehensive spam detection system to filter low-quality PRs from the contributor feed, improving content quality and user experience.

**Background**: Current PR feed lacks filtering mechanisms, allowing spam and low-quality content to appear alongside legitimate contributions, degrading the overall user experience.

**Success Metrics**:
- 80% decrease in low-quality PRs appearing in feed
- <5% false positive rate for legitimate PRs
- <100ms processing time per PR analysis
- Improved user engagement with feed content

## Current State Analysis

### What Exists
- PR ingestion pipeline that fetches GitHub data
- Basic PR data storage in `pull_requests` table
- Feed display functionality showing all PRs

### What's Missing
- Spam detection logic and scoring system
- Database fields for spam metrics
- Filtering mechanisms in feed queries
- Admin tools for spam management

### Key Problems
1. Template-matched PRs (100% duplicate descriptions)
2. Empty or minimal PR descriptions
3. New accounts creating low-quality PRs
4. Large PRs with poor documentation
5. Small PRs with no meaningful context

## Implementation Plan

### Phase 1: Evaluation Framework (HIGH Priority) ✅
**Duration**: 3-4 days
**Dependencies**: Database migration

**Deliverables**:
- Database schema updates for spam scoring
- Core spam detection algorithms
- Basic scoring framework
- Unit tests for detection logic

**Acceptance Criteria**:
- `pull_requests` table has spam-related fields
- SpamDetectionService can analyze PR content
- Template matching algorithm detects 100% duplicates
- Account age analysis identifies new contributor patterns
- All detection methods have >85% accuracy in tests

### Phase 2: Real-time Detection (HIGH Priority)
**Duration**: 4-5 days
**Dependencies**: Phase 1 complete, PR ingestion pipeline

**Deliverables**:
- Integration with PR ingestion pipeline
- Real-time spam analysis during data fetch
- Batch processing for existing PRs
- Performance optimization (<100ms per PR)

**Acceptance Criteria**:
- New PRs automatically analyzed for spam
- Existing PRs can be reprocessed with spam scores
- System maintains <100ms processing time
- Spam scores stored correctly in database

### Phase 3: Feed Integration (MEDIUM Priority)
**Duration**: 2-3 days
**Dependencies**: Phase 2 complete

**Deliverables**:
- Feed filtering based on spam scores
- User preferences for spam tolerance
- API endpoints for filtered feeds
- Frontend integration

**Acceptance Criteria**:
- Feed excludes PRs above spam threshold
- Users can adjust spam filtering sensitivity
- API responses include spam metadata
- Frontend displays filtered results

### Phase 4: Admin Dashboard (LOW Priority)
**Duration**: 3-4 days
**Dependencies**: Phase 3 complete

**Deliverables**:
- Admin interface for reviewing flagged PRs
- Manual spam marking/unmarking
- False positive reporting system
- Spam detection metrics dashboard

**Acceptance Criteria**:
- Admins can review and modify spam flags
- Dashboard shows detection accuracy metrics
- False positive feedback improves detection
- Comprehensive spam analytics available

## Technical Architecture

### Database Schema Changes
```sql
-- Add to pull_requests table
ALTER TABLE pull_requests ADD COLUMN spam_score INTEGER DEFAULT 0;
ALTER TABLE pull_requests ADD COLUMN spam_flags JSONB DEFAULT '{}';
ALTER TABLE pull_requests ADD COLUMN is_spam BOOLEAN DEFAULT FALSE;
ALTER TABLE pull_requests ADD COLUMN reviewed_by_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE pull_requests ADD COLUMN spam_detected_at TIMESTAMP;
```

### Core Services

**SpamDetectionService**
- Main orchestrator for spam analysis
- Coordinates all detection methods
- Calculates final spam score

**PRAnalysisService**
- Template matching detection
- Content quality analysis
- PR size vs documentation ratio

**AccountAnalysisService**
- New account pattern detection
- Contributor history analysis
- GitHub account metadata evaluation

### Spam Detection Algorithms

1. **Template Matching (Weight: 40%)**
   - Exact description matching
   - Common spam template detection
   - Threshold: 100% match = high spam score

2. **Content Quality (Weight: 30%)**
   - Description length analysis
   - Meaningful content detection
   - Documentation quality assessment

3. **Account Patterns (Weight: 20%)**
   - Account age analysis
   - Previous contribution quality
   - GitHub profile completeness

4. **PR Characteristics (Weight: 10%)**
   - Size vs documentation ratio
   - File change patterns
   - Commit message quality

### Scoring System
- Score range: 0-100 (0 = likely legitimate, 100 = likely spam)
- Thresholds:
  - 0-25: Show in feed (green)
  - 26-50: Show with warning (yellow)
  - 51-75: Hide by default, admin review (orange)
  - 76-100: Auto-hide, flag for review (red)

## Technical Guidelines

### Performance Requirements
- <100ms processing time per PR
- Batch processing capability for historical data
- Efficient database queries with proper indexing
- Caching for repeated template matching

### Code Organization
```
src/
  services/
    spam/
      SpamDetectionService.ts
      PRAnalysisService.ts
      AccountAnalysisService.ts
      templates/
        TemplateDetector.ts
        CommonTemplates.ts
```

### Error Handling
- Graceful degradation when detection fails
- Comprehensive logging for debugging
- Fallback to "unknown" spam status
- Retry mechanisms for external API calls

## Testing Strategy

### Unit Tests
- Each detection algorithm independently
- Edge cases and boundary conditions
- Performance benchmarks
- Mock GitHub API responses

### Integration Tests
- End-to-end PR analysis workflow
- Database integration
- API endpoint functionality
- Feed filtering accuracy

### Performance Tests
- 100ms processing time validation
- Batch processing efficiency
- Database query optimization
- Memory usage monitoring

## Future Enhancements

### Machine Learning Integration
- Training data collection from manual reviews
- Pattern recognition improvements
- Adaptive threshold adjustment
- Community feedback integration

### Advanced Features
- Community reporting system
- GitHub API spam detection integration
- Multi-language template detection
- Collaborative filtering mechanisms

## Implementation Timeline

**Week 1**: Phase 1 - Evaluation Framework
**Week 2**: Phase 2 - Real-time Detection  
**Week 3**: Phase 3 - Feed Integration
**Week 4**: Phase 4 - Admin Dashboard

**Total Estimated Effort**: 3-4 weeks
**Team Size**: 1-2 developers
**Priority Level**: HIGH