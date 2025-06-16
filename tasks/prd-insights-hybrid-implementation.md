# Product Requirements Document: Insights Hybrid Implementation

## Project Overview

### Objective
Transform the insights sidebar from mock data to a hybrid approach combining real GitHub API data with LLM-generated natural language insights and recommendations.

### Background
Currently, the insights sidebar has:
- ✅ **Needs Attention**: Real GitHub data with rule-based urgency scoring
- ⚠️ **PR Activity, Trends, Health, Recommendations**: Mock data only

### Success Metrics
- **Data Accuracy**: 100% real data replacing mock data
- **Response Time**: Insights load within 3 seconds
- **Cost Efficiency**: LLM API calls optimized with caching
- **User Experience**: Natural language insights provide actionable value
- **Reliability**: Graceful fallbacks when LLM services unavailable

## Implementation Plan

### Phase 1: Real Data Integration (HIGH PRIORITY)
**Timeline**: Days 1-3

#### Task C1: Connect PR Activity Section ✅
**Status**: COMPLETED ✅  
**Deliverables**:
- Replace mock PR activity metrics with real GitHub API data
- Calculate actual velocity, merge times, contributor stats
- Maintain existing UI but with real numbers

**Acceptance Criteria**:
- [x] Real weekly PR velocity from GitHub API
- [x] Actual merge time calculations
- [x] Live contributor activity data
- [x] Performance under 2 seconds

#### Task C2: Connect Trends Section ✅
**Status**: COMPLETED ✅  
**Deliverables**:
- Week-over-week comparison calculations
- Real trend analysis using historical GitHub data
- Dynamic trend indicators (up/down/stable)

**Acceptance Criteria**:
- [x] Compare current week vs previous week data
- [x] Calculate percentage changes for key metrics
- [x] Show accurate trend directions
- [x] Handle edge cases (new repos, no historical data)

#### Task C3: Connect Repository Health Section ✅
**Status**: Pending  
**Deliverables**:
- Real health scoring based on GitHub metrics
- Bus factor analysis using contributor data
- Review coverage and response time calculations

**Acceptance Criteria**:
- [ ] Health score (0-100) based on real metrics
- [ ] Bus factor calculation from contributor distribution
- [ ] Review coverage percentage from PR data
- [ ] Average response time from PR/issue data

### Phase 2: LLM Integration (MEDIUM PRIORITY)
**Timeline**: Days 4-6

#### Task C4: Create LLM Service ✅
**Status**: Pending  
**Deliverables**:
- OpenAI GPT-4 API integration using `VITE_OPENAI_API_KEY`
- Prompt templates for different insight types
- Rate limiting and error handling

**Acceptance Criteria**:
- [ ] OpenAI service configured with `VITE_OPENAI_API_KEY` environment variable
- [ ] Structured prompts for health, recommendations, patterns
- [ ] Rate limiting to prevent API abuse
- [ ] Timeout handling for slow responses

#### Task C5: LLM Health Assessments ✅
**Status**: Pending  
**Deliverables**:
- Natural language explanations of health metrics
- Contextual insights about repository state
- Trend explanations in plain English

**Acceptance Criteria**:
- [ ] Health explanations generated from real metrics
- [ ] Context-aware insights (repo size, age, activity)
- [ ] Clear, actionable language
- [ ] Fallback to static text if LLM fails

#### Task C6: LLM Actionable Recommendations ✅
**Status**: Pending  
**Deliverables**:
- Smart recommendations based on repository analysis
- Personalized suggestions for improvement
- Link to relevant GitHub features/documentation

**Acceptance Criteria**:
- [ ] Recommendations based on real repository state
- [ ] Specific, actionable suggestions with links
- [ ] Priority-based recommendation ordering
- [ ] Avoid generic advice, provide specific steps

### Phase 3: Production Polish (MEDIUM-HIGH PRIORITY)
**Timeline**: Days 7-8

#### Task C8: Caching Layer ✅
**Status**: Pending  
**Deliverables**:
- Cache LLM responses to reduce API costs
- Smart cache invalidation based on repository changes
- Local storage for user preferences

**Acceptance Criteria**:
- [ ] Cache LLM responses for 1-24 hours based on content type
- [ ] Invalidate cache when repository data changes significantly
- [ ] Reduce LLM API calls by 80% for repeat visits
- [ ] Performance improvement in subsequent loads

#### Task C10: Error Handling & Fallbacks ✅
**Status**: Pending  
**Deliverables**:
- Graceful degradation when LLM services fail
- Clear error states with retry mechanisms
- Fallback to rule-based insights

**Acceptance Criteria**:
- [ ] Show real data even if LLM fails
- [ ] Clear error messages with retry buttons
- [ ] Fallback insights when LLM unavailable
- [ ] No broken UI states

### Phase 4: Advanced Features (LOW PRIORITY)
**Timeline**: Days 9-10

#### Task C7: LLM Pattern Analysis ✅
**Status**: Pending  
**Deliverables**:
- Analysis of PR patterns and contributor behavior
- Insights about code review effectiveness
- Team dynamics and collaboration patterns

#### Task C9: User Controls ✅
**Status**: Pending  
**Deliverables**:
- Toggle to enable/disable LLM features
- User preference storage
- Performance vs intelligence trade-offs

## Technical Architecture

### Data Flow
1. **GitHub API** → Real metrics calculation → UI display
2. **Real metrics** → LLM prompt → Natural language insights → UI display
3. **Cache layer** → Stores LLM responses → Reduces API calls
4. **Error boundaries** → Fallback to real data only → Maintains functionality

### API Integration Points
- **GitHub API**: Pull requests, issues, contributors, commits
- **LLM API**: OpenAI GPT-4 using `VITE_OPENAI_API_KEY` environment variable
- **Caching**: Browser localStorage + optional Redis for server-side

### Performance Targets
- **Initial load**: < 3 seconds for all sections
- **LLM insights**: < 5 seconds or show loading state
- **Cache hit ratio**: > 80% for LLM responses
- **Error rate**: < 5% for LLM integration

## Risk Assessment & Mitigation

### Technical Risks
- **OpenAI API costs**: Mitigate with aggressive caching and rate limiting
- **OpenAI response time**: Show progressive loading, cache responses
- **GitHub API rate limits**: Implement intelligent batching and caching
- **Missing API key**: Graceful fallback when `VITE_OPENAI_API_KEY` not configured

### User Experience Risks
- **Slow LLM responses**: Show real data immediately, LLM insights as enhancement
- **LLM unavailable**: Fallback to rule-based insights, no broken states
- **Information overload**: Progressive disclosure, collapsible sections

## Success Measurement

### Metrics to Track
- **Real Data Accuracy**: Manual verification against GitHub UI
- **LLM Response Quality**: User feedback and manual review
- **Performance**: Page load times and LLM response times
- **Cost**: LLM API usage and optimization effectiveness
- **Reliability**: Error rates and fallback frequency

### Definition of Done
- [ ] All sections use real GitHub data
- [ ] LLM insights provide clear value over static text
- [ ] Performance meets targets (< 3s initial, < 5s LLM)
- [ ] Error handling covers all failure modes
- [ ] Cost optimization reduces LLM calls by 80%

---

**Created**: 2025-06-16  
**Current Phase**: Phase 1 - Real Data Integration  
**Next Milestone**: Task C1 - PR Activity Real Data Integration  
**Estimated Completion**: 8-10 development days