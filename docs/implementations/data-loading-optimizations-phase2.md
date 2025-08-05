# Data Loading Optimizations Phase 2

## Overview

This document details the Phase 2 implementation of Core Web Vitals optimizations, focusing on data loading improvements to achieve target performance metrics: TTI < 3.5s, FCP < 1.8s, and 50% reduction in API request waterfall.

## Current State Analysis

### Data Loading Pattern
The application currently loads data in the following sequence:
1. **Repository View Mount** → `useCachedRepoData` hook
2. **Parallel Fetch**:
   - PR data via `fetchPRDataSmart`
   - Direct commits via `fetchDirectCommitsWithDatabaseFallback`
3. **Component Rendering** (all load simultaneously):
   - MetricsAndTrendsCard
   - Contributions
   - RepositoryHealthCard
   - ContributorOfMonthWrapper
   - Distribution

### Performance Bottlenecks
1. **All data loads at once** - No prioritization of above-the-fold content
2. **Large data queries** - Fetching all PRs/commits regardless of viewport
3. **No virtualization** - Rendering hundreds of contributor cards
4. **Request waterfall** - Sequential database queries in some components
5. **No field selection** - Fetching all fields even when only subset needed

## Implementation Plan

### Phase 2A: Progressive Data Loading (Priority: HIGH)

#### 1. Above-the-Fold Prioritization
**Goal**: Load critical metrics first, defer below-fold content

**Implementation**:
- Split `useCachedRepoData` into staged loading:
  ```typescript
  // Stage 1: Critical metrics (< 500ms)
  - Repository basic info
  - Top 5 contributors
  - Key metrics (PR count, contributor count)
  
  // Stage 2: Interactive content (< 2s)
  - Full contributor list
  - Activity timeline
  - Charts data
  
  // Stage 3: Enhancement data (background)
  - Historical trends
  - Detailed analytics
  ```

#### 2. Component-Level Lazy Loading
**Goal**: Load components only when needed

**Implementation**:
- Wrap heavy components with Intersection Observer
- Load data when component enters viewport
- Show skeleton while loading

### Phase 2B: List Virtualization (Priority: HIGH)

#### 1. Contributor List Virtualization
**Goal**: Render only visible contributors

**Implementation**:
- Use `@tanstack/react-virtual` for windowing
- Render ~20 visible items + buffer
- Maintain scroll position on navigation

#### 2. Activity Feed Virtualization
**Goal**: Efficiently handle large activity lists

**Implementation**:
- Virtual scrolling for PR/commit lists
- Dynamic row heights support
- Smooth scrolling experience

### Phase 2C: API Optimization (Priority: MEDIUM)

#### 1. GraphQL-Style Field Selection
**Goal**: Fetch only required fields

**Implementation**:
- Add field selection to Supabase queries:
  ```typescript
  // Before
  .select('*')
  
  // After
  .select('id, title, state, created_at, author:author_id(username, avatar_url)')
  ```

#### 2. Request Batching
**Goal**: Reduce number of database round trips

**Implementation**:
- Batch similar queries with Promise.all()
- Use database views for complex joins
- Implement query deduplication

### Phase 2D: Service Worker Caching (Priority: LOW)

#### 1. Static Asset Caching
**Goal**: Instant subsequent loads

**Implementation**:
- Cache JS/CSS bundles
- Cache font files
- Network-first for API calls

#### 2. API Response Caching
**Goal**: Offline capability

**Implementation**:
- Cache successful API responses
- 5-minute cache for dynamic data
- Background sync when online

## Technical Architecture

### Progressive Loading Hook
```typescript
export function useProgressiveRepoData(owner: string, repo: string) {
  const [criticalData, setCriticalData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [enhancementData, setEnhancementData] = useState(null);
  
  // Stage 1: Load critical data immediately
  useEffect(() => {
    loadCriticalData(owner, repo).then(setCriticalData);
  }, [owner, repo]);
  
  // Stage 2: Load full data after critical
  useEffect(() => {
    if (criticalData) {
      loadFullData(owner, repo).then(setFullData);
    }
  }, [criticalData]);
  
  // Stage 3: Load enhancements in background
  useEffect(() => {
    if (fullData) {
      requestIdleCallback(() => {
        loadEnhancementData(owner, repo).then(setEnhancementData);
      });
    }
  }, [fullData]);
  
  return { criticalData, fullData, enhancementData };
}
```

### Intersection Observer Hook
```typescript
export function useIntersectionLoader<T>(
  loadFn: () => Promise<T>,
  options?: IntersectionObserverInit
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !data && !isLoading) {
          setIsLoading(true);
          loadFn().then(setData).finally(() => setIsLoading(false));
        }
      },
      options
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  
  return { ref, data, isLoading };
}
```

## Implementation Steps

### Week 1: Progressive Loading Foundation
1. ✅ Create progressive loading hook
2. ✅ Split data queries into stages
3. ✅ Update repository view to use staged loading
4. ✅ Add loading priority to components

### Week 2: Virtualization
1. ✅ Install and configure @tanstack/react-virtual
2. ✅ Virtualize contributor lists
3. ✅ Virtualize activity feeds
4. ✅ Test scroll performance

### Week 3: API Optimization
1. ✅ Implement field selection
2. ✅ Batch related queries
3. ✅ Create optimized database views
4. ✅ Measure query performance

### Week 4: Service Worker
1. ✅ Implement basic service worker
2. ✅ Add caching strategies
3. ✅ Test offline functionality
4. ✅ Monitor cache performance

## Success Metrics

### Performance Targets
- **TTI**: < 3.5s (from ~5s)
- **FCP**: < 1.8s (from ~2.5s)
- **LCP**: < 2.5s (maintained)
- **API Waterfall**: 50% reduction

### Quality Metrics
- Zero increase in error rates
- Maintain all existing functionality
- Smooth scrolling (60 FPS)
- No visible layout shifts

## Testing Strategy

### Unit Tests
- Progressive loading hook behavior
- Intersection observer functionality
- Virtual list rendering
- Cache invalidation logic

### Integration Tests
- End-to-end data loading flow
- Component lazy loading
- Scroll performance
- Offline functionality

### Performance Tests
- Lighthouse CI benchmarks
- Network waterfall analysis
- Bundle size monitoring
- Runtime performance profiling

## Rollout Strategy

1. **Feature Flags**: Each optimization behind flag
2. **Gradual Rollout**: 10% → 50% → 100%
3. **Monitoring**: Real-time performance metrics
4. **Rollback Plan**: Quick disable via flags

## Risks and Mitigations

### Risk: Breaking existing features
**Mitigation**: Comprehensive test coverage, gradual rollout

### Risk: Increased complexity
**Mitigation**: Clear documentation, modular implementation

### Risk: Browser compatibility
**Mitigation**: Progressive enhancement, polyfills where needed

## Future Considerations

### Phase 3 Opportunities
- Predictive prefetching based on user behavior
- Edge caching with CDN
- WebAssembly for heavy computations
- HTTP/3 and server push

### Long-term Architecture
- Consider GraphQL for better field selection
- Evaluate React Server Components
- Explore edge computing options