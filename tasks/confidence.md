# Contributor Confidence Implementation Plan

## Overview
The Contributor Confidence feature predicts the likelihood of a contributor making meaningful contributions to a project based on their past behavior and engagement signals.

## 1. Core Algorithm Enhancement

The enhanced algorithm considers multiple signals beyond just stars and forks:

```typescript
interface ContributorSignals {
  hasStarred: boolean;
  hasForked: boolean;
  hasMadePR: boolean;
  hasOpenedIssue: boolean;
  hasCommented: boolean;
  contributionCount: number;
  recentActivityDays: number;
  otherReposContributed: number;
}

class ContributorConfidenceCalculator {
  calculateConfidence(signals: ContributorSignals): number {
    let score = 0;
    
    // Base signals (0-40 points)
    if (signals.hasStarred) score += 5;
    if (signals.hasForked) score += 10;
    if (signals.hasMadePR) score += 25;
    
    // Engagement signals (0-30 points)
    if (signals.hasOpenedIssue) score += 15;
    if (signals.hasCommented) score += 10;
    score += Math.min(signals.contributionCount * 0.5, 5);
    
    // Activity recency multiplier (0.5-1.0)
    const recencyMultiplier = Math.max(0.5, 1 - (signals.recentActivityDays / 180));
    
    // Cross-repo experience bonus (0-30 points)
    const experienceBonus = Math.min(signals.otherReposContributed * 3, 30);
    
    return Math.min((score + experienceBonus) * recencyMultiplier, 100);
  }
}
```

### Scoring Breakdown
- **Base Signals (0-40 points)**
  - Star: 5 points
  - Fork: 10 points
  - Pull Request: 25 points
- **Engagement Signals (0-30 points)**
  - Issue Creation: 15 points
  - Comments: 10 points
  - Contribution frequency bonus: up to 5 points
- **Experience Bonus (0-30 points)**
  - 3 points per repository contributed to (max 30)
- **Recency Multiplier (0.5-1.0)**
  - Recent activity weights higher than older activity

## 2. Data Collection Strategy

### Primary Data Collection Method

```typescript
async gatherContributorSignals(
  username: string, 
  repoName: string, 
  range: number = 90
): Promise<ContributorSignals> {
  const [
    starData,
    forkData,
    prData,
    issueData,
    commentData,
    crossRepoData
  ] = await Promise.all([
    this.checkIfUserStarred(username, repoName, range),
    this.checkIfUserForked(username, repoName, range),
    this.getUserPRActivity(username, repoName, range),
    this.getUserIssueActivity(username, repoName, range),
    this.getUserCommentActivity(username, repoName, range),
    this.getUserCrossRepoActivity(username, range)
  ]);
  
  return {
    hasStarred: starData.hasStarred,
    hasForked: forkData.hasForked,
    hasMadePR: prData.count > 0,
    hasOpenedIssue: issueData.count > 0,
    hasCommented: commentData.count > 0,
    contributionCount: prData.count + issueData.count + commentData.count,
    recentActivityDays: this.calculateDaysSinceLastActivity(username, repoName),
    otherReposContributed: crossRepoData.repoCount
  };
}
```

### Supporting Data Collection Methods

```typescript
async checkIfUserStarred(username: string, repoName: string, range: number): Promise<StarData> {
  // Query watch_github_events table
}

async checkIfUserForked(username: string, repoName: string, range: number): Promise<ForkData> {
  // Query fork_github_events table
}

async getUserPRActivity(username: string, repoName: string, range: number): Promise<PRData> {
  // Query pull_request_github_events table
}

async getUserIssueActivity(username: string, repoName: string, range: number): Promise<IssueData> {
  // Query issues_github_events table
}

async getUserCommentActivity(username: string, repoName: string, range: number): Promise<CommentData> {
  // Query comment tables (issue_comment, pr_review_comment, commit_comment)
}

async getUserCrossRepoActivity(username: string, range: number): Promise<CrossRepoData> {
  // Query for user's contributions across different repositories
}
```

## 3. Database Schema Updates

### New Tables

```sql
-- Store calculated confidence scores
CREATE TABLE contributor_confidence_scores (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  last_calculated TIMESTAMP DEFAULT NOW(),
  calculation_metadata JSONB,
  UNIQUE(username, repo_name)
);

-- Store prediction outcomes for accuracy tracking
CREATE TABLE confidence_prediction_outcomes (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  predicted_score DECIMAL(5,2) NOT NULL,
  prediction_date TIMESTAMP NOT NULL,
  outcome_date TIMESTAMP,
  did_contribute BOOLEAN,
  contribution_type VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX idx_confidence_repo ON contributor_confidence_scores(repo_name);
CREATE INDEX idx_confidence_user ON contributor_confidence_scores(username);
CREATE INDEX idx_confidence_score ON contributor_confidence_scores(confidence_score DESC);
CREATE INDEX idx_confidence_last_calc ON contributor_confidence_scores(last_calculated);
```

## 4. API Endpoints

### Individual Contributor Confidence

```typescript
// GET /api/repos/:owner/:repo/contributor/:username/confidence
@Get('repos/:owner/:repo/contributor/:username/confidence')
async getContributorConfidence(
  @Param('owner') owner: string,
  @Param('repo') repo: string,
  @Param('username') username: string,
  @Query() pageOptionsDto: PageOptionsDto
): Promise<ContributorConfidenceResponse> {
  const repoName = `${owner}/${repo}`;
  const confidence = await this.repoDevstatsService.calculateIndividualContributorConfidence(
    username,
    repoName,
    pageOptionsDto.range || 90
  );
  
  return {
    username,
    repository: repoName,
    confidenceScore: confidence.score,
    confidenceLevel: this.getConfidenceLevel(confidence.score),
    signals: confidence.signals,
    calculatedAt: new Date(),
    recommendations: this.generateRecommendations(confidence)
  };
}
```

### Potential Contributors List

```typescript
// GET /api/repos/:owner/:repo/potential-contributors
@Get('repos/:owner/:repo/potential-contributors')
async getPotentialContributors(
  @Param('owner') owner: string,
  @Param('repo') repo: string,
  @Query() pageOptionsDto: PageOptionsDto
): Promise<PotentialContributorResponse[]> {
  const repoName = `${owner}/${repo}`;
  return this.repoDevstatsService.findHighConfidenceNonContributors(
    repoName,
    pageOptionsDto
  );
}
```

### Repository Confidence Analytics

```typescript
// GET /api/repos/:owner/:repo/confidence-analytics
@Get('repos/:owner/:repo/confidence-analytics')
async getRepositoryConfidenceAnalytics(
  @Param('owner') owner: string,
  @Param('repo') repo: string,
  @Query() pageOptionsDto: PageOptionsDto
): Promise<RepositoryConfidenceAnalytics> {
  const repoName = `${owner}/${repo}`;
  return this.repoDevstatsService.analyzeRepositoryConfidence(
    repoName,
    pageOptionsDto
  );
}
```

### Response Types

```typescript
interface ContributorConfidenceResponse {
  username: string;
  repository: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  signals: {
    hasStarred: boolean;
    hasForked: boolean;
    hasMadePR: boolean;
    hasOpenedIssue: boolean;
    hasCommented: boolean;
    contributionCount: number;
    recentActivityDays: number;
    otherReposContributed: number;
  };
  calculatedAt: Date;
  recommendations: string[];
}

interface PotentialContributorResponse {
  username: string;
  avatarUrl: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  primarySignals: string[];
  lastActivityDays: number;
  suggestedActions: string[];
}

interface RepositoryConfidenceAnalytics {
  repository: string;
  analyzedAt: Date;
  totalAnalyzed: number;
  averageConfidence: number;
  distribution: {
    high: number;
    medium: number;
    low: number;
  };
  topPotentialContributors: PotentialContributorResponse[];
  conversionMetrics: {
    starToContributorRate: number;
    forkToContributorRate: number;
    averageTimeToFirstContribution: number;
  };
}
```

## 5. Caching Strategy

### In-Memory Cache Implementation

```typescript
@Injectable()
export class ContributorConfidenceCache {
  private cache = new Map<string, CachedConfidenceScore>();
  private readonly CACHE_TTL = 3600000; // 1 hour
  
  getCacheKey(username: string, repoName: string): string {
    return `${username}:${repoName}`;
  }
  
  async getOrCalculate(
    username: string,
    repoName: string,
    calculator: () => Promise<ConfidenceResult>
  ): Promise<ConfidenceResult> {
    const key = this.getCacheKey(username, repoName);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    
    const result = await calculator();
    this.cache.set(key, { result, timestamp: Date.now() });
    
    // Persist to database for long-term storage
    await this.persistToDatabase(username, repoName, result);
    
    return result;
  }
  
  invalidate(username: string, repoName: string): void {
    const key = this.getCacheKey(username, repoName);
    this.cache.delete(key);
  }
  
  invalidateRepo(repoName: string): void {
    // Invalidate all cache entries for a repository
    for (const [key, _] of this.cache) {
      if (key.endsWith(`:${repoName}`)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Redis Cache (for distributed systems)

```typescript
@Injectable()
export class RedisConfidenceCache {
  constructor(private redis: Redis) {}
  
  async get(username: string, repoName: string): Promise<ConfidenceResult | null> {
    const key = `confidence:${username}:${repoName}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(username: string, repoName: string, result: ConfidenceResult): Promise<void> {
    const key = `confidence:${username}:${repoName}`;
    await this.redis.setex(key, 3600, JSON.stringify(result));
  }
}
```

## 6. Batch Processing

### Repository-Wide Analysis

```typescript
async analyzeRepositoryPotentialContributors(
  repoName: string,
  range: number = 90
): Promise<RepositoryConfidenceAnalysis> {
  const [stargazers, forkers] = await Promise.all([
    this.getRepoStargazers(repoName, range),
    this.getRepoForkers(repoName, range)
  ]);
  
  const uniqueUsers = [...new Set([...stargazers, ...forkers])];
  
  // Batch process in chunks to avoid overwhelming the database
  const BATCH_SIZE = 50;
  const results = [];
  
  for (let i = 0; i < uniqueUsers.length; i += BATCH_SIZE) {
    const batch = uniqueUsers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(username => 
        this.calculateContributorConfidenceWithDetails(username, repoName, range)
      )
    );
    results.push(...batchResults);
    
    // Add small delay between batches to prevent overload
    if (i + BATCH_SIZE < uniqueUsers.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return this.aggregateResults(repoName, results);
}
```

### Scheduled Background Jobs

```typescript
@Injectable()
export class ConfidenceCalculationJob {
  @Cron('0 0 * * *') // Run daily at midnight
  async updateHighTrafficRepos() {
    const popularRepos = await this.getPopularRepositories();
    
    for (const repo of popularRepos) {
      await this.queue.add('calculate-repo-confidence', {
        repoName: repo.name,
        range: 90
      });
    }
  }
  
  @Cron('0 */6 * * *') // Run every 6 hours
  async updateRecentlyActiveUsers() {
    const activeUsers = await this.getRecentlyActiveUsers();
    
    for (const user of activeUsers) {
      await this.queue.add('update-user-confidence', {
        username: user.login,
        repos: user.recentRepos
      });
    }
  }
}
```

## 7. Frontend Integration

### Data Structures

```typescript
interface ContributorConfidenceDisplay {
  username: string;
  avatarUrl: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceVisual: {
    color: string;
    icon: string;
    percentage: number;
  };
  primarySignals: string[];
  lastActivityDays: number;
  suggestedAction?: string;
  contributionPrediction: {
    likelihood: string;
    estimatedTimeframe: string;
  };
}

interface RepositoryConfidenceMetrics {
  averageConfidence: number;
  totalPotentialContributors: number;
  conversionRate: number;
  topSignals: Signal[];
  trends: {
    daily: TrendData[];
    weekly: TrendData[];
    monthly: TrendData[];
  };
}
```

### UI Components

```typescript
// Confidence Badge Component
export const ConfidenceBadge: React.FC<{ score: number }> = ({ score }) => {
  const level = getConfidenceLevel(score);
  const color = getConfidenceColor(level);
  
  return (
    <div className={`confidence-badge ${level}`} style={{ backgroundColor: color }}>
      <span className="score">{score}%</span>
      <span className="label">{level} confidence</span>
    </div>
  );
};

// Contributor Card Component
export const PotentialContributorCard: React.FC<{ contributor: ContributorConfidenceDisplay }> = ({ contributor }) => {
  return (
    <div className="contributor-card">
      <img src={contributor.avatarUrl} alt={contributor.username} />
      <h3>{contributor.username}</h3>
      <ConfidenceBadge score={contributor.confidenceScore} />
      <div className="signals">
        {contributor.primarySignals.map(signal => (
          <span key={signal} className="signal-badge">{signal}</span>
        ))}
      </div>
      {contributor.suggestedAction && (
        <button className="action-button">
          {contributor.suggestedAction}
        </button>
      )}
    </div>
  );
};
```

## 8. Testing Strategy

### Unit Tests

```typescript
describe('ContributorConfidenceCalculator', () => {
  let calculator: ContributorConfidenceCalculator;
  
  beforeEach(() => {
    calculator = new ContributorConfidenceCalculator();
  });
  
  describe('calculateConfidence', () => {
    it('should calculate high confidence for active cross-repo contributors', () => {
      const signals: ContributorSignals = {
        hasStarred: true,
        hasForked: true,
        hasMadePR: true,
        hasOpenedIssue: true,
        hasCommented: true,
        contributionCount: 10,
        recentActivityDays: 7,
        otherReposContributed: 8
      };
      
      const confidence = calculator.calculateConfidence(signals);
      expect(confidence).toBeGreaterThan(70);
    });
    
    it('should apply recency decay correctly', () => {
      const recentSignals: ContributorSignals = {
        hasStarred: true,
        hasForked: true,
        hasMadePR: false,
        hasOpenedIssue: false,
        hasCommented: false,
        contributionCount: 0,
        recentActivityDays: 7,
        otherReposContributed: 3
      };
      
      const oldSignals: ContributorSignals = {
        ...recentSignals,
        recentActivityDays: 150
      };
      
      const recentConfidence = calculator.calculateConfidence(recentSignals);
      const oldConfidence = calculator.calculateConfidence(oldSignals);
      
      expect(recentConfidence).toBeGreaterThan(oldConfidence);
    });
    
    it('should cap confidence at 100', () => {
      const maxSignals: ContributorSignals = {
        hasStarred: true,
        hasForked: true,
        hasMadePR: true,
        hasOpenedIssue: true,
        hasCommented: true,
        contributionCount: 100,
        recentActivityDays: 1,
        otherReposContributed: 20
      };
      
      const confidence = calculator.calculateConfidence(maxSignals);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });
});
```

### Integration Tests

```typescript
describe('RepoDevstatsService Integration', () => {
  let service: RepoDevstatsService;
  let testRepo: string;
  
  beforeEach(async () => {
    // Setup test database and service
    testRepo = 'test-owner/test-repo';
  });
  
  describe('calculateContributorConfidenceByRepoName', () => {
    it('should handle users with no activity gracefully', async () => {
      const confidence = await service.calculateContributorConfidenceByRepoName(
        'inactive-user',
        testRepo,
        90
      );
      
      expect(confidence).toBe(0);
    });
    
    it('should process batch calculations efficiently', async () => {
      const startTime = Date.now();
      const results = await service.analyzeRepositoryPotentialContributors(
        testRepo,
        90
      );
      const endTime = Date.now();
      
      expect(results.totalAnalyzed).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});
```

### E2E Tests

```typescript
describe('Contributor Confidence API E2E', () => {
  it('should return contributor confidence data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/repos/facebook/react/contributor/gaearon/confidence')
      .expect(200);
    
    expect(response.body).toHaveProperty('confidenceScore');
    expect(response.body).toHaveProperty('confidenceLevel');
    expect(response.body).toHaveProperty('signals');
    expect(response.body.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(response.body.confidenceScore).toBeLessThanOrEqual(100);
  });
  
  it('should return potential contributors list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/repos/facebook/react/potential-contributors')
      .query({ limit: 10, range: 30 })
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeLessThanOrEqual(10);
    
    if (response.body.length > 0) {
      expect(response.body[0]).toHaveProperty('username');
      expect(response.body[0]).toHaveProperty('confidenceScore');
      expect(response.body[0]).toHaveProperty('primarySignals');
    }
  });
});
```

## 9. Monitoring and Analytics

### Prediction Accuracy Tracking

```typescript
@Injectable()
export class ConfidenceAccuracyTracker {
  async trackPredictionAccuracy(): Promise<AccuracyReport> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get predictions made 30+ days ago
    const predictions = await this.getPredictionsOlderThan(thirtyDaysAgo);
    
    // Check if users actually contributed
    const outcomes = await Promise.all(
      predictions.map(async (prediction) => {
        const didContribute = await this.checkIfUserContributed(
          prediction.username,
          prediction.repoName,
          prediction.predictionDate
        );
        
        return {
          ...prediction,
          didContribute,
          accurate: this.isPredictionAccurate(prediction.confidenceScore, didContribute)
        };
      })
    );
    
    // Calculate metrics
    const accuracy = this.calculateAccuracyMetrics(outcomes);
    
    // Log for monitoring
    this.logger.log({
      metric: 'contributor_confidence_accuracy',
      ...accuracy,
      timestamp: new Date()
    });
    
    return accuracy;
  }
  
  private isPredictionAccurate(score: number, didContribute: boolean): boolean {
    if (score >= 70 && didContribute) return true;
    if (score < 30 && !didContribute) return true;
    if (score >= 30 && score < 70) return true; // Medium confidence is always "accurate"
    return false;
  }
  
  private calculateAccuracyMetrics(outcomes: PredictionOutcome[]): AccuracyReport {
    const total = outcomes.length;
    const accurate = outcomes.filter(o => o.accurate).length;
    
    const highConfidencePredictions = outcomes.filter(o => o.confidenceScore >= 70);
    const highConfidenceAccuracy = highConfidencePredictions.filter(o => o.didContribute).length / 
                                  highConfidencePredictions.length;
    
    return {
      overallAccuracy: accurate / total,
      highConfidenceAccuracy,
      sampleSize: total,
      falsePositives: outcomes.filter(o => o.confidenceScore >= 70 && !o.didContribute).length,
      falseNegatives: outcomes.filter(o => o.confidenceScore < 30 && o.didContribute).length
    };
  }
}
```

### Metrics Dashboard

```typescript
interface ConfidenceMetricsDashboard {
  realTimeMetrics: {
    calculationsPerMinute: number;
    averageCalculationTime: number;
    cacheHitRate: number;
  };
  accuracyMetrics: {
    overallAccuracy: number;
    accuracyByConfidenceLevel: {
      high: number;
      medium: number;
      low: number;
    };
    trend: TrendData[];
  };
  usageMetrics: {
    totalCalculations: number;
    uniqueUsersAnalyzed: number;
    uniqueReposAnalyzed: number;
    topReposByUsage: RepoUsage[];
  };
}
```

## 10. Implementation Timeline

### Week 1: Core Algorithm & Data Model
- [ ] Implement enhanced confidence calculation algorithm
- [ ] Create database schema and migrations
- [ ] Set up TypeORM entities and relationships
- [ ] Write unit tests for algorithm

### Week 2: Data Collection & Processing
- [ ] Implement signal gathering methods
- [ ] Create batch processing system
- [ ] Set up background job queue
- [ ] Integration tests for data collection

### Week 3: API Development
- [ ] Create REST API endpoints
- [ ] Implement response DTOs
- [ ] Add input validation and error handling
- [ ] API documentation with Swagger

### Week 4: Performance & Caching
- [ ] Implement in-memory caching
- [ ] Add Redis caching layer
- [ ] Optimize database queries
- [ ] Load testing and performance tuning

### Week 5: Frontend Integration
- [ ] Create TypeScript interfaces
- [ ] Build React components
- [ ] Implement data visualization
- [ ] End-to-end testing

### Week 6: Monitoring & Deployment
- [ ] Set up monitoring and alerting
- [ ] Implement accuracy tracking
- [ ] Create operational dashboards
- [ ] Production deployment and documentation

## 11. Future Enhancements

### Machine Learning Integration
- Use historical data to train ML models for better predictions
- Implement feature importance analysis
- A/B test different scoring algorithms

### Advanced Signals
- Code complexity analysis of contributions
- Time-of-day activity patterns
- Language/framework expertise matching
- Social graph analysis (who follows whom)

### Gamification
- Contributor confidence badges
- Leaderboards for potential contributors
- Achievement system for improving confidence scores

### Integration with Other Tools
- GitHub Actions for automated invitations
- Slack notifications for high-confidence users
- Email campaigns targeting potential contributors

## 12. Configuration

### Environment Variables

```env
# Confidence Calculation Settings
CONFIDENCE_CACHE_TTL=3600000
CONFIDENCE_BATCH_SIZE=50
CONFIDENCE_MAX_RANGE_DAYS=90

# Feature Flags
ENABLE_CONFIDENCE_CACHING=true
ENABLE_BACKGROUND_CALCULATIONS=true
ENABLE_ACCURACY_TRACKING=true

# Performance Settings
MAX_CONCURRENT_CALCULATIONS=10
CALCULATION_TIMEOUT_MS=30000

# Redis Configuration (if using Redis cache)
REDIS_URL=redis://localhost:6379
REDIS_CONFIDENCE_PREFIX=confidence:
```

### Application Configuration

```typescript
@Injectable()
export class ConfidenceConfig {
  constructor(private configService: ConfigService) {}
  
  get cacheEnabled(): boolean {
    return this.configService.get<boolean>('ENABLE_CONFIDENCE_CACHING', true);
  }
  
  get cacheTTL(): number {
    return this.configService.get<number>('CONFIDENCE_CACHE_TTL', 3600000);
  }
  
  get batchSize(): number {
    return this.configService.get<number>('CONFIDENCE_BATCH_SIZE', 50);
  }
  
  get maxRangeDays(): number {
    return this.configService.get<number>('CONFIDENCE_MAX_RANGE_DAYS', 90);
  }
}
```

## Conclusion

This implementation plan provides a comprehensive approach to building the Contributor Confidence feature. The system is designed to be scalable, maintainable, and accurate, with built-in monitoring to continuously improve predictions over time.
