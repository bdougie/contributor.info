# Inngest Migration to GitHub Actions Plan

## Executive Summary

This task outlines the complete migration from the current Inngest-based progressive data capture system to the GitHub Actions approach detailed in `GITHUB_ACTIONS.md`. This migration will eliminate external dependencies, reduce costs by 40-88%, and provide better observability while maintaining all current functionality.

## Context

### Current State
The Inngest system has been optimized with rate limiting fixes (see `RATE_LIMITING_FIXES.md`) but still has fundamental limitations:
- External service dependency on Inngest
- Limited debugging capabilities
- Scaling costs with usage
- Complex local development setup

### Target State
GitHub Actions-based system following the hearts/jobs pattern:
- No external dependencies
- Native GitHub integration
- Cost-effective ($0-24/month vs $40-200/month)
- Excellent observability through GitHub UI

## Migration Plan

### Phase 1: Infrastructure Setup (Week 1)

#### 1.1 Create GitHub App
- [ ] Register new GitHub App for contributor.info
- [ ] Set permissions: Repository (read), Issues (read), Pull requests (read), Actions (write)
- [ ] Install on contributor-info organization
- [ ] Store App ID and private key in GitHub secrets

#### 1.2 Create Jobs Repository
- [ ] Create `contributor-info/progressive-capture-jobs` repository
- [ ] Set up basic workflow structure from `GITHUB_ACTIONS.md`
- [ ] Configure repository secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `CONTRIBUTOR_APP_PRIVATE_KEY`

#### 1.3 Create CLI Scripts
- [ ] Create `/scripts/progressive-capture/` directory in main repo
- [ ] Implement base capture script class
- [ ] Port Inngest functions to CLI scripts:
  - [ ] `capture-pr-details.js`
  - [ ] `capture-pr-reviews.js` 
  - [ ] `capture-pr-comments.js`
  - [ ] `capture-repository-sync.js`
- [ ] Add utility libraries:
  - [ ] `lib/github-client.js`
  - [ ] `lib/rate-limiter.js`
  - [ ] `lib/supabase-client.js`
  - [ ] `lib/progress-tracker.js`

### Phase 2: Workflow Implementation (Week 1-2)

#### 2.1 Core Workflows
- [ ] `capture-pr-details.yml` - Individual PR data capture
- [ ] `capture-pr-reviews.yml` - PR review data capture
- [ ] `capture-pr-comments.yml` - PR comment data capture
- [ ] `capture-repository-sync.yml` - Bulk repository sync

#### 2.2 Orchestration Workflows
- [ ] `bulk-capture.yml` - Orchestrates multiple capture types
- [ ] Matrix strategy for parallel processing
- [ ] Conditional execution based on data freshness

#### 2.3 Testing Workflows
- [ ] Test workflow dispatch API
- [ ] Verify secret access and authentication
- [ ] Test CLI script execution in GitHub Actions environment

### Phase 3: Database Schema (Week 2)

#### 3.1 New Tables
```sql
-- Add to Supabase migration
CREATE TABLE progressive_capture_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,
  repository_id UUID REFERENCES repositories(id),
  status VARCHAR(20) DEFAULT 'pending',
  workflow_run_id BIGINT,
  metadata JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE progressive_capture_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES progressive_capture_jobs(id),
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  current_item TEXT,
  errors JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3.2 Indexes
- [ ] Add indexes for job status queries
- [ ] Add indexes for repository-based lookups

### Phase 4: Frontend Integration (Week 2-3)

#### 4.1 GitHub Actions Client
- [ ] Create `src/lib/progressive-capture/github-actions-client.ts`
- [ ] Implement workflow dispatch functionality
- [ ] Add workflow status monitoring

#### 4.2 Queue Manager Replacement
- [ ] Create `src/lib/progressive-capture/actions-queue-manager.ts`
- [ ] Replace Inngest queue manager with Actions queue manager
- [ ] Maintain same interface for backward compatibility

#### 4.3 Update Existing Code
- [ ] Update `manual-trigger.ts` to use Actions queue manager
- [ ] Update `bootstrap-queue.ts` to use new system
- [ ] Update UI components to show workflow links

### Phase 5: Migration & Testing (Week 3)

#### 5.1 Parallel Running
- [ ] Deploy both systems in parallel
- [ ] Feature flag to switch between Inngest and Actions
- [ ] Compare results and performance

#### 5.2 Data Migration
- [ ] Create migration script for pending Inngest jobs
- [ ] Migrate job history and status data
- [ ] Verify data integrity

#### 5.3 Testing
- [ ] Test all capture types with GitHub Actions
- [ ] Verify rate limiting works correctly
- [ ] Test error handling and retries
- [ ] Performance testing with various repository sizes

### Phase 6: Cutover & Cleanup (Week 4)

#### 6.1 Production Cutover
- [ ] Switch default to GitHub Actions queue manager
- [ ] Monitor for issues and performance
- [ ] Update documentation

#### 6.2 Inngest Cleanup
- [ ] Remove Inngest dependencies from package.json
- [ ] Delete Inngest configuration files:
  - [ ] `inngest.config.ts`
  - [ ] `inngest.config.json`
  - [ ] `netlify/functions/inngest.ts`
- [ ] Remove Inngest function files:
  - [ ] `src/lib/inngest/functions/`
  - [ ] `src/lib/inngest/client.ts`
  - [ ] `src/lib/inngest/github-client.ts`
  - [ ] `src/lib/inngest/queue-manager.ts`
  - [ ] `src/lib/inngest/types.ts`
- [ ] Simplify development environment:
  - [ ] Remove `npm start` script entirely from package.json
  - [ ] Eliminate need for localhost:8288 Inngest dev server
  - [ ] Return to simple `npm run dev` for local development (Vite only)
  - [ ] Update README.md to remove Inngest setup instructions
  - [ ] Update CLAUDE.md to remove Inngest development references
  - [ ] Remove any IDE configurations that depend on `npm start`
- [ ] Update environment variables (remove INNGEST_* variables)
- [ ] Clean up UI references to Inngest
- [ ] Update any deployment scripts that reference `npm start`

#### 6.3 Documentation
- [ ] Update README with new architecture
- [ ] Create operational runbook for GitHub Actions
- [ ] Document troubleshooting procedures
- [ ] Update contributor guidelines

## File Removal Checklist

### Inngest Files to Delete
```
/inngest.config.ts
/inngest.config.json
/inngest.log
/inngest-dev.log
/netlify/functions/inngest.ts
/src/lib/inngest/
├── client.ts
├── github-client.ts
├── queue-manager.ts
├── types.ts
└── functions/
    ├── index.ts
    ├── capture-pr-details.ts
    ├── capture-pr-reviews.ts
    ├── capture-pr-comments.ts
    └── capture-repository-sync.ts
/docs/inngest-integration.md
```

### Package.json Dependencies
```json
{
  "dependencies": {
    "inngest": "^3.x.x"  // Remove this
  },
  "scripts": {
    "dev:inngest": "...",  // Remove this
    "start": "..."         // Update to remove inngest
  }
}
```

## Migration Commands

### 1. Create GitHub App
```bash
# Use GitHub CLI or web interface
gh api /apps --method POST --field name="contributor-info-capture" \
  --field url="https://contributor.info" \
  --field webhook_active=false
```

### 2. Setup Jobs Repository
```bash
# Create new repository
gh repo create contributor-info/progressive-capture-jobs --public

# Clone and setup
git clone https://github.com/contributor-info/progressive-capture-jobs.git
cd progressive-capture-jobs
mkdir -p .github/workflows
# Copy workflow files from GITHUB_ACTIONS.md
```

### 3. Deploy Database Schema
```bash
# Apply migration via Supabase MCP
# Add tables and indexes as specified in Phase 3
```

### 4. Update Frontend Code
```bash
# Replace import statements
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/inngestQueueManager/actionsQueueManager/g'

# Update queue manager references
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/..\/inngest\/queue-manager/..\/progressive-capture\/actions-queue-manager/g'
```

### 5. Remove Inngest Files
```bash
# Remove configuration files
rm inngest.config.ts inngest.config.json inngest*.log
rm netlify/functions/inngest.ts

# Remove source files
rm -rf src/lib/inngest/

# Remove documentation
rm docs/inngest-integration.md

# Update package.json
npm uninstall inngest
```

## Monitoring & Rollback Plan

### Success Metrics
- [ ] 99.5% job success rate
- [ ] Average job completion time < 5 minutes
- [ ] Zero rate limiting errors
- [ ] Cost reduction of 40-88%
- [ ] User experience unchanged

### Rollback Triggers
- Job success rate < 95%
- Average job time > 10 minutes
- More than 5 rate limiting errors per day
- User complaints about performance

### Rollback Procedure
1. Switch feature flag back to Inngest
2. Restart Inngest services
3. Re-queue failed jobs in Inngest
4. Investigate GitHub Actions issues
5. Fix and retry migration

## Risk Mitigation

### Technical Risks
- **GitHub Actions outage**: Implement manual fallback triggers
- **Rate limiting**: Advanced retry logic in CLI scripts
- **Secret exposure**: Use GitHub's secret scanning
- **Performance degradation**: Parallel processing optimization

### Operational Risks
- **Team knowledge**: Document thoroughly and train team
- **Migration complexity**: Phased approach with rollback plan
- **Data loss**: Comprehensive backup and validation

## Success Criteria

### Week 1 Completion
- [ ] GitHub App created and configured
- [ ] Jobs repository set up with basic workflows
- [ ] CLI scripts implemented and tested locally

### Week 2 Completion
- [ ] All workflows implemented and tested
- [ ] Database schema deployed
- [ ] Frontend integration complete

### Week 3 Completion
- [ ] Parallel running successful
- [ ] Migration script tested
- [ ] Performance validation complete

### Week 4 Completion
- [ ] Production cutover successful
- [ ] All Inngest code removed
- [ ] Documentation updated
- [ ] Team trained on new system

## Post-Migration Benefits

### Immediate
- ✅ Elimination of external service dependency
- ✅ 40-88% cost reduction
- ✅ Native GitHub integration
- ✅ Better observability and debugging

### Long-term
- ✅ Simplified architecture
- ✅ Reduced maintenance overhead
- ✅ Better scaling characteristics
- ✅ Enhanced security posture

## Conclusion

This migration plan provides a systematic approach to replacing Inngest with GitHub Actions while maintaining all functionality and improving performance. The phased approach with parallel running and rollback capabilities minimizes risk while ensuring a smooth transition.

Upon completion, the system will be more reliable, cost-effective, and maintainable while providing better visibility into data capture operations.