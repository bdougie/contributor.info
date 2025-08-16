# Social Card Speed Optimization PRD

## Project Overview

**Objective**: Reduce social card generation time from current 579ms average to under 300ms target

**Background**: Social cards are generated via Fly.io service but currently take 497-712ms to deliver. This impacts social sharing performance and user experience.

**Success Metrics**:
- Average response time: <300ms (currently 579ms)
- 95th percentile: <500ms
- Cache hit rate: >80%
- Zero downtime during optimization

## Current State Analysis

### Performance Baseline (Aug 2025)
```
Current Performance:
├── Fastest: Next.js repo (497ms)
├── Average: 579ms
└── Slowest: Home card (712ms)

Breakdown:
├── Server processing: 31-234ms
├── Network latency: ~100-200ms
├── Database queries: Variable (fallback vs real data)
└── SVG generation: Fast (<50ms)
```

### Bottleneck Analysis
1. **Database Queries** (Primary)
   - Real data: 642-712ms (home, custom cards)
   - Fallback data: 497-558ms (repo cards)
   - Impact: +150-200ms for real data

2. **Network Latency** (Secondary)
   - Fly.io to Supabase: ~50-100ms
   - Client to Fly.io: Variable by location

3. **Cache Misses** (Tertiary)
   - Current: Cold generation on each request
   - No pre-generation for popular repos

## Implementation Plan

### Phase 1: Database Query Optimization (HIGH PRIORITY)
**Target**: Reduce database query time by 50%
**Timeline**: 1-2 days

#### 1.1 Query Optimization
- [ ] Add database indexes for common queries
- [ ] Optimize JOIN operations 
- [ ] Use materialized views for aggregated stats
- [ ] Implement query result caching

#### 1.2 Connection Pooling
- [ ] Implement Supabase connection pooling
- [ ] Add connection keep-alive
- [ ] Optimize connection settings

#### 1.3 Smart Fallbacks
- [ ] Cache database results for 5-10 minutes
- [ ] Use stale-while-revalidate pattern
- [ ] Improve fallback data quality

**Expected Impact**: 150ms reduction (579ms → 429ms)

### Phase 2: Pre-generation & Caching (HIGH PRIORITY)
**Target**: Cache hit rate >80%
**Timeline**: 2-3 days

#### 2.1 Popular Repository Pre-generation
```javascript
// Pre-generate cards for top repositories
const popularRepos = [
  'facebook/react', 'microsoft/vscode', 'google/flutter',
  'vercel/next.js', 'angular/angular', 'vuejs/vue'
];

// Generate every 1-4 hours
scheduleGeneration(popularRepos, { interval: '2h' });
```

#### 2.2 Smart Caching Strategy
- [ ] CDN edge caching (Cloudflare/AWS CloudFront)
- [ ] In-memory LRU cache for Fly.io service
- [ ] Redis cache for database results
- [ ] Browser cache optimization

#### 2.3 Cache Invalidation
- [ ] Webhook-based invalidation on repo updates
- [ ] Time-based expiration (1-6 hours)
- [ ] Smart refresh on cache miss

**Expected Impact**: 200ms reduction for cached content (429ms → 229ms)

### Phase 3: Infrastructure Optimization (MEDIUM PRIORITY)
**Target**: Reduce network latency
**Timeline**: 1-2 days

#### 3.1 Geographic Distribution
- [ ] Deploy Fly.io regions closer to users
- [ ] Implement multi-region routing
- [ ] Edge compute for card generation

#### 3.2 Connection Optimization
- [ ] HTTP/2 optimization
- [ ] Connection compression
- [ ] Keep-alive headers optimization

#### 3.3 Resource Optimization
- [ ] SVG optimization and minification
- [ ] Image compression for embedded assets
- [ ] Response payload optimization

**Expected Impact**: 50ms reduction (229ms → 179ms)

### Phase 4: Advanced Optimizations (LOW PRIORITY)
**Target**: Further performance gains
**Timeline**: 2-3 days

#### 4.1 Streaming & Progressive Generation
- [ ] Stream SVG generation
- [ ] Progressive card loading
- [ ] Lazy loading for complex elements

#### 4.2 AI-Powered Optimization
- [ ] Predict popular repositories
- [ ] Smart pre-generation scheduling
- [ ] Usage pattern analysis

#### 4.3 Alternative Rendering
- [ ] WebAssembly for SVG generation
- [ ] GPU-accelerated rendering
- [ ] Edge compute migration

**Expected Impact**: 30ms additional reduction (179ms → 149ms)

## Technical Implementation

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_repos_owner_name ON repositories(owner, name);
CREATE INDEX CONCURRENTLY idx_prs_repo_created ON pull_requests(repository_id, created_at);
CREATE INDEX CONCURRENTLY idx_contributors_active ON contributors(username) WHERE is_bot = false;

-- Materialized view for repository stats
CREATE MATERIALIZED VIEW repository_stats AS
SELECT 
  r.id,
  r.owner,
  r.name,
  COUNT(DISTINCT pr.id) as total_prs,
  COUNT(DISTINCT pr.author_id) as total_contributors,
  COUNT(DISTINCT CASE WHEN pr.created_at > NOW() - INTERVAL '7 days' THEN pr.id END) as weekly_prs
FROM repositories r
LEFT JOIN pull_requests pr ON r.id = pr.repository_id
GROUP BY r.id, r.owner, r.name;

-- Refresh every hour
SELECT cron.schedule('refresh-repo-stats', '0 * * * *', 'REFRESH MATERIALIZED VIEW repository_stats;');
```

### Caching Implementation
```javascript
// fly-social-cards/src/cache-manager.js
import Redis from 'ioredis';

class SocialCardCache {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.memoryCache = new Map();
    this.maxMemoryItems = 1000;
  }

  async getCard(key) {
    // L1: Memory cache (fastest)
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // L2: Redis cache (fast)
    const cached = await this.redis.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      this.setMemoryCache(key, data);
      return data;
    }

    return null;
  }

  async setCard(key, data, ttl = 3600) {
    // Set in both caches
    this.setMemoryCache(key, data);
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }

  setMemoryCache(key, data) {
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, data);
  }
}
```

### Pre-generation Service
```javascript
// scripts/social-cards/pre-generate-popular.js
import { generateSocialCard } from '../fly-social-cards/src/card-generator.js';

const POPULAR_REPOS = [
  { owner: 'facebook', repo: 'react' },
  { owner: 'microsoft', repo: 'vscode' },
  { owner: 'vercel', repo: 'next.js' },
  { owner: 'angular', repo: 'angular' },
  { owner: 'vuejs', repo: 'vue' }
];

async function preGenerateCards() {
  console.log('🚀 Pre-generating popular social cards...');
  
  for (const { owner, repo } of POPULAR_REPOS) {
    try {
      const key = `repo:${owner}/${repo}`;
      
      // Check if already cached
      const existing = await cache.getCard(key);
      if (existing && !isStale(existing, '2h')) {
        console.log(`✅ ${owner}/${repo} - already cached`);
        continue;
      }

      // Generate new card
      const startTime = Date.now();
      const cardData = await fetchRepositoryData(owner, repo);
      const svg = generateSocialCard(cardData);
      
      await cache.setCard(key, { svg, cardData }, 14400); // 4 hour TTL
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${owner}/${repo} - generated in ${duration}ms`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ ${owner}/${repo} - error:`, error.message);
    }
  }
  
  console.log('🎉 Pre-generation complete!');
}

// Run every 2 hours
setInterval(preGenerateCards, 2 * 60 * 60 * 1000);
```

## Performance Monitoring

### Metrics to Track
```javascript
// Performance metrics
const metrics = {
  responseTime: {
    p50: '<300ms',
    p95: '<500ms', 
    p99: '<1000ms'
  },
  cacheHitRate: '>80%',
  errorRate: '<1%',
  throughput: 'requests/second'
};

// Real-time monitoring
function trackPerformance(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log to monitoring service
    metrics.record('social_card_generation', {
      duration,
      cache_hit: res.locals.cacheHit,
      card_type: req.params.type,
      status: res.statusCode
    });
  });
  
  next();
}
```

### Alerting Thresholds
- Response time >500ms for 5 minutes
- Cache hit rate <70% for 10 minutes  
- Error rate >5% for 2 minutes
- Service availability <99%

## Rollout Strategy

### Phase 1: Safe Deployment
1. **Deploy optimizations to staging**
2. **Run performance tests** 
3. **A/B test with 10% traffic**
4. **Monitor metrics for 24 hours**

### Phase 2: Gradual Rollout
1. **50% traffic split**
2. **Monitor performance improvements**
3. **Full rollout if metrics improve**

### Phase 3: Advanced Features
1. **Pre-generation service**
2. **Multi-region deployment**
3. **Edge compute migration**

## Acceptance Criteria

### Phase 1 ✅ Complete when:
- [ ] Average response time <400ms
- [ ] Database query time <100ms
- [ ] All tests passing
- [ ] Zero service downtime

### Phase 2 ✅ Complete when:
- [ ] Average response time <300ms
- [ ] Cache hit rate >80%
- [ ] Popular repos serve in <200ms
- [ ] Monitoring dashboard deployed

### Phase 3 ✅ Complete when:
- [ ] Multi-region deployment active
- [ ] Network latency optimized
- [ ] Edge caching implemented

### Phase 4 ✅ Complete when:
- [ ] Average response time <200ms
- [ ] Advanced caching strategies active
- [ ] AI-powered optimizations deployed

## Risk Assessment

### High Risk
- **Database migration failures** → Mitigation: Blue-green deployment
- **Cache invalidation bugs** → Mitigation: Graceful fallbacks
- **CDN configuration errors** → Mitigation: Staging environment testing

### Medium Risk  
- **Memory usage increases** → Mitigation: Memory monitoring/limits
- **Regional deployment complexity** → Mitigation: Phased regional rollout

### Low Risk
- **SVG generation issues** → Mitigation: Current implementation proven
- **Monitoring overhead** → Mitigation: Sampling and aggregation

## Success Metrics Dashboard

```javascript
// Target metrics after optimization
const successMetrics = {
  performance: {
    averageResponseTime: '<300ms', // from 579ms
    p95ResponseTime: '<500ms',
    cacheHitRate: '>80%',
    errorRate: '<1%'
  },
  business: {
    socialShareConversions: '+15%',
    userSatisfaction: '>95%',
    systemReliability: '99.9%'
  },
  infrastructure: {
    serverCosts: 'neutral or reduced',
    bandwidthUsage: 'reduced via caching',
    maintenanceOverhead: 'minimal'
  }
};
```

## Next Steps

1. **Review and approve** this PRD
2. **Set up performance monitoring** baseline
3. **Begin Phase 1 implementation** (database optimization)
4. **Create staging environment** for testing
5. **Schedule regular performance reviews**

---

**Expected Timeline**: 6-8 days total
**Expected Result**: 300ms+ improvement (579ms → <300ms)
**Risk Level**: Medium (manageable with proper testing)
**Resource Requirements**: 1 developer, staging environment, monitoring tools