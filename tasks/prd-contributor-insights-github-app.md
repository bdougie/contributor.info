# PRD: Contributor Insights GitHub App

## Executive Summary

### Project Overview
Develop a GitHub App that provides intelligent PR-time insights by automatically commenting on pull requests with contributor profiles, reviewer suggestions, and related issue context. This app serves as a viral growth mechanism for contributor.info while providing immediate value to development teams.

### Background
Similar to how Cubic leverages GitHub integrations, we need a compelling reason for users to install our app on their repositories. By providing valuable insights at the moment developers need them most (PR review time), we create a natural adoption path that exposes teams to contributor.info's broader platform.

### Success Metrics
- **Adoption**: 10,000+ repository installations within 6 months
- **Engagement**: 80% of PRs receive insights comments
- **Conversion**: 2-5% of free app users upgrade to paid contributor.info
- **Virality**: Each installation exposes ~10 contributors to the tool
- **Retention**: 90% of installations remain active after 30 days

## Feature Specifications

### Phase 1: Core PR Insights (Priority: HIGH)

#### 1.1 GitHub App Setup
- **App Name**: "Contributor Insights"
- **Permissions Required**:
  - Pull requests: Read & Write (for comments)
  - Issues: Read (for similarity matching)
  - Repository metadata: Read
  - Repository contents: Read (for code ownership)
  - Organization members: Read (for team insights)

#### 1.2 Basic PR Comment Template
```markdown
## 🎯 Contributor Insights

**@username** has contributed:
- 📊 23 PRs merged (87% first-time approval rate)
- 🏆 Primary expertise: frontend, auth, API
- 🕐 Active hours: 9am-5pm PST
- 🔄 Last active: 2 hours ago

### Suggested Reviewers
Based on this code touching `src/auth/*`:
- **@reviewer1** - Owns 67% of modified files
- **@reviewer2** - Expert in auth flows
- **@reviewer3** - Frequently reviews similar PRs

---
*[Contributor Insights](link) • [Get full analytics](upgrade)*
```

#### 1.3 Database Schema
```sql
-- App installations tracking
CREATE TABLE github_app_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id BIGINT UNIQUE NOT NULL,
    account_type TEXT CHECK (account_type IN ('user', 'organization')),
    account_name TEXT NOT NULL,
    account_id BIGINT NOT NULL,
    repository_selection TEXT CHECK (repository_selection IN ('all', 'selected')),
    installed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    suspended_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    CONSTRAINT unique_account_installation UNIQUE (account_id, installation_id)
);

-- Track which repos have the app
CREATE TABLE app_enabled_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    installation_id UUID REFERENCES github_app_installations(id) ON DELETE CASCADE,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    enabled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_app_repo UNIQUE (installation_id, repository_id)
);

-- PR insights cache
CREATE TABLE pr_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_request_id UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
    contributor_stats JSONB NOT NULL,
    suggested_reviewers JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    comment_posted BOOLEAN DEFAULT FALSE,
    comment_id BIGINT,
    CONSTRAINT unique_pr_insights UNIQUE (pull_request_id)
);
```

### Phase 2: Issue Intelligence (Priority: HIGH)

#### 2.1 Issue Data Model
```sql
-- Core issues table
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT CHECK (state IN ('open', 'closed')),
    author_id UUID REFERENCES contributors(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_by_id UUID REFERENCES contributors(id),
    labels JSONB DEFAULT '[]',
    assignees JSONB DEFAULT '[]',
    milestone JSONB,
    comments_count INTEGER DEFAULT 0,
    is_pull_request BOOLEAN DEFAULT FALSE,
    linked_pr_id UUID REFERENCES pull_requests(id),
    CONSTRAINT unique_issue_per_repo UNIQUE (repository_id, number)
);

-- Issue similarity scores
CREATE TABLE issue_similarities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type TEXT CHECK (source_type IN ('issue', 'pull_request')),
    source_id UUID NOT NULL,
    target_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    similarity_score DECIMAL(3, 2) CHECK (similarity_score >= 0 AND similarity_score <= 1),
    similarity_reasons JSONB NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_similarity UNIQUE (source_type, source_id, target_issue_id)
);
```

#### 2.2 Enhanced PR Comment with Issues
```markdown
## 🎯 Contributor Insights

**@username** has contributed:
- 📊 23 PRs merged (87% first-time approval rate)
- 🏆 Primary expertise: frontend, auth, API

### 🔍 Related Issues & Context
**This PR implements authentication refactoring:**
- 🎯 **#234** "Add OAuth2 support" - *Implements this feature*
- 🔄 **#189** "Refactor auth middleware" (Closed by @reviewer1)
  - Similar changes in `src/auth/*`
- 📊 **#156** "JWT token expiration bug" (High Priority)
  - May be fixed by changes to `auth/tokens.js`

### 💡 Suggested Reviewers
- **@reviewer1** - Fixed similar auth issues, owns 67% of files
- **@reviewer2** - Reviewed #189 (avg response: 4hr)

### 📈 Potential Impact
- **Fixes**: #156, #203 (auth timeout issues)
- **Enables**: #301 (SSO), #312 (2FA)

---
*[See full issue graph](link) • [Install on more repos](link)*
```

#### 2.3 Similarity Algorithm
```typescript
interface SimilarityWeights {
  fileOverlap: 0.3,      // Same files modified
  semantic: 0.25,        // Title/description similarity
  labels: 0.15,          // Common labels
  contributors: 0.15,    // Same people involved
  temporal: 0.1,         // Recent related work
  explicit: 0.05         // Mentioned in description
}

class IssueSimilarityEngine {
  async calculateSimilarity(pr: PR, issue: Issue): Promise<SimilarityScore> {
    const scores = {
      fileOverlap: await this.compareFiles(pr, issue),
      semantic: await this.semanticSimilarity(pr, issue),
      labels: this.labelOverlap(pr, issue),
      contributors: this.contributorOverlap(pr, issue),
      temporal: this.temporalProximity(pr, issue),
      explicit: this.explicitMention(pr, issue)
    };
    
    return this.weightedAverage(scores, this.weights);
  }
}
```

### Phase 3: App Promotion & Installation UI (Priority: MEDIUM)

#### 3.1 In-App Promotion Points
1. **Repository Page**: "Install GitHub App" button for enhanced insights
2. **Issues Tab**: "Install app to analyze 1,234 issues"
3. **Private Repo Search**: "Install app to access private repositories"
4. **Rate Limit Warning**: "Install app for 5,000 requests/hour"

#### 3.2 Installation Flow Component
```typescript
// src/components/features/github-app/install-prompt.tsx
interface InstallPromptProps {
  trigger: 'issues' | 'private-repo' | 'rate-limit' | 'features';
  repository?: Repository;
  onInstall: () => void;
  onDismiss: () => void;
}

// src/components/features/github-app/installation-status.tsx
interface InstallationStatusProps {
  repository: Repository;
  installation?: Installation;
  showBenefits?: boolean;
}
```

#### 3.3 Post-Installation Onboarding
1. Welcome message in first PR comment
2. Settings link for customization
3. Quick tips for maximum value
4. Team invitation prompts

### Phase 4: Advanced Features - paid (Priority: MEDIUM)

requires stripe integration

#### 4.1 Reviewer Workload Balancing
```typescript
interface ReviewerWorkload {
  openPRs: number;
  avgResponseTime: string;
  lastReviewActivity: Date;
  expertise: string[];
  availability: 'available' | 'busy' | 'away';
}
```

#### 4.2 Cross-Repository Intelligence
- Track issues across organization repos
- Suggest reviewers from other teams
- Identify duplicate efforts
- Link related work across projects

#### 4.3 Smart Notifications
- Slack/Teams integration for PR insights
- Email digests for team leads
- Mentions when identified as ideal reviewer
- Fix confirmations for issue reporters

### Phase 5: Premium Features & Monetization (Priority: LOW)

#### 4.1 Free Tier Limitations
- Public repositories only
- Top 5 similar issues
- Basic reviewer suggestions
- Standard PR comments

#### 4.2 Premium Unlocks ($29/team/month)
- Private repository support
- Unlimited issue matching
- AI-powered insights
- Custom reviewer rules
- Team analytics dashboard
- API access
- Priority support
- Slack/Teams integration

#### 4.3 Enterprise Features
- SSO integration
- Audit logs
- Custom branding
- SLA guarantees
- Dedicated support

## Technical Architecture

### Webhook Infrastructure
```typescript
// netlify/functions/github-webhook.ts
export const handler = async (event: Event) => {
  // Verify webhook signature
  const signature = verifyWebhookSignature(event);
  
  // Route to appropriate handler
  switch (event.headers['x-github-event']) {
    case 'pull_request':
      await handlePullRequest(event);
      break;
    case 'installation':
      await handleInstallation(event);
      break;
    case 'issues':
      await handleIssue(event);
      break;
  }
};
```

### Event Processing Flow
1. GitHub webhook → Netlify Function
2. Signature verification & event parsing
3. Queue event in Inngest
4. Process asynchronously:
   - Calculate insights
   - Find similar issues
   - Generate recommendations
   - Post PR comment
5. Cache results in database

### Performance Considerations
- Generate insights within 5 seconds of PR open
- Cache contributor stats for 24 hours
- Pre-calculate reviewer expertise
- Use embeddings for fast similarity search
- Implement circuit breakers for API limits

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Create GitHub App with minimal permissions
- [ ] Implement webhook infrastructure
- [ ] Add database tables for installations
- [ ] Basic PR comment posting

### Week 3-4: Core Features  
- [ ] Contributor statistics calculation
- [ ] Basic reviewer suggestions
- [ ] Issue similarity matching
- [ ] Enhanced PR comments

### Week 5-6: UI Integration
- [ ] App installation prompts
- [ ] Installation status indicators
- [ ] Settings management UI
- [ ] Onboarding flow

### Week 7-8: Advanced Features
- [ ] Cross-repo intelligence
- [ ] Workload balancing
- [ ] Notification system
- [ ] Premium feature gates

### Week 9-10: Launch Preparation
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] Marketing materials
- [ ] Beta testing

## Success Criteria

### Acceptance Criteria
1. **Functional Requirements**
   - PR comments post within 5 seconds
   - 95% accuracy in reviewer suggestions
   - Issue matching with >70% relevance
   - Zero false positive spam comments

2. **Performance Requirements**
   - Handle 1000+ concurrent PRs
   - Sub-second similarity calculations
   - 99.9% uptime for webhook processing
   - Graceful degradation on API limits

3. **User Experience**
   - One-click installation process
   - Clear value in first PR comment
   - Non-intrusive promotion
   - Customizable preferences

### Risk Mitigation
1. **GitHub API Limits**: Implement caching, use app rate limits
2. **Webhook Failures**: Queue with retries, monitoring alerts
3. **Comment Spam**: Rate limiting, user preferences
4. **Privacy Concerns**: Clear data usage policy, opt-out options

## Competitive Analysis

### vs. GitHub's Built-in Features
- **Our Advantage**: Historical context, cross-repo intelligence
- **Their Advantage**: Native integration, no installation

### vs. Pull Panda (acquired by GitHub)
- **Our Advantage**: Issue intelligence, contributor profiles
- **Their Advantage**: GitHub backing, simple reminders

### vs. Reviewable/Pull Approve
- **Our Advantage**: Free tier, automatic insights
- **Their Advantage**: Advanced review workflows

## Go-to-Market Strategy

1. **Launch on Product Hunt**: "AI-powered PR insights for GitHub"
2. **Open Source Promotion**: Comment on popular repos
3. **Developer Influencers**: Free premium accounts
4. **GitHub Marketplace**: Featured app placement
5. **Content Marketing**: "How we review PRs 73% faster"

## Conclusion

This GitHub App positions contributor.info as an essential development tool while creating a viral growth loop. By providing immediate value at PR-time, we ensure high adoption and create natural touchpoints for platform conversion. The phased approach allows us to launch quickly while building toward a comprehensive solution.