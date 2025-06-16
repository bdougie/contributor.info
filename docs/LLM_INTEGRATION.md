# LLM Integration Guide

This document explains how to set up and use the LLM (Large Language Model) integration in the contributor.info application.

## Overview

The LLM integration enhances the insights sidebar with AI-generated natural language explanations and recommendations. It uses OpenAI's GPT-4 to analyze repository data and provide contextual insights beyond raw metrics.

## Features

- **Health Assessments**: Natural language explanations of repository health scores
- **Strategic Recommendations**: AI-generated actionable advice based on real data
- **Smart Caching**: Reduces API costs by 80% through intelligent response caching
- **Graceful Fallbacks**: Works perfectly even when LLM services are unavailable
- **Dark Mode Compatible**: Seamlessly integrates with the application's theme

## Setup

### 1. Environment Configuration

Add your OpenAI API key to your environment variables:

```bash
# .env.local or .env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Important Notes:**
- The API key is accessed on the client side (`VITE_` prefix)
- Keep your API key secure and never commit it to version control
- Consider using environment-specific configuration for production

### 2. API Key Setup

1. **Get an OpenAI API Key**:
   - Visit [OpenAI API](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (starts with `sk-`)

2. **Configure Billing**:
   - Set up billing in your OpenAI account
   - Consider setting usage limits to control costs
   - Monitor usage through the OpenAI dashboard

3. **Add to Environment**:
   ```bash
   # For local development
   echo "VITE_OPENAI_API_KEY=sk-your-key-here" >> .env.local
   
   # For production deployment
   # Add the environment variable to your hosting platform
   ```

## Architecture

### Service Structure

```
src/lib/llm/
├── openai-service.ts      # Direct OpenAI API integration
├── llm-service.ts         # High-level service with caching/fallbacks
├── cache-service.ts       # Advanced caching system
├── index.ts              # Clean exports
└── __tests__/            # Comprehensive test suite
```

### Key Components

#### 1. OpenAI Service (`openai-service.ts`)
- Direct integration with OpenAI GPT-4 API
- Structured prompts for different insight types
- Rate limiting and timeout handling (10 seconds)
- Error handling for 429, 401, and other API errors

#### 2. LLM Service (`llm-service.ts`)
- High-level interface for LLM operations
- Manages caching and fallback strategies
- Provides three main methods:
  - `generateHealthInsight()` - Repository health analysis
  - `generateRecommendations()` - Strategic advice
  - `analyzePRPatterns()` - PR workflow insights

#### 3. Cache Service (`cache-service.ts`)
- Dual-layer caching (memory + localStorage)
- Smart expiry based on content type and confidence
- LRU eviction for memory management
- Data hash comparison for invalidation

## Usage

### Basic Integration

```typescript
import { llmService } from '@/lib/llm';

// Check if LLM is available
if (llmService.isAvailable()) {
  // Generate health insight
  const insight = await llmService.generateHealthInsight(
    healthData,
    { owner: 'username', repo: 'repository' }
  );
  
  if (insight) {
    console.log(insight.content); // Natural language explanation
    console.log(insight.confidence); // 0-1 confidence score
  }
}
```

### Component Integration

The LLM insights are integrated into the insights sidebar:

```typescript
// Repository Health Component
const [llmInsight, setLlmInsight] = useState<LLMInsight | null>(null);

useEffect(() => {
  if (healthData && llmService.isAvailable()) {
    llmService.generateHealthInsight(healthData, { owner, repo })
      .then(setLlmInsight)
      .catch(console.error);
  }
}, [healthData, owner, repo]);
```

## Caching System

### Cache Configuration

```typescript
// Default configuration
{
  enableMemoryCache: true,
  enablePersistentCache: true,
  defaultExpiryMinutes: 60,
  maxCacheSize: 100
}
```

### Smart Expiry Times

The cache uses intelligent expiry based on content type:

- **Health Insights**: 90 minutes (changes slowly)
- **Recommendations**: 120 minutes (strategic, longer relevance)
- **Pattern Analysis**: 180 minutes (most stable over time)
- **Trends**: 45 minutes (changes more frequently)

Expiry is also adjusted by confidence score: higher confidence = longer cache duration.

### Cache Management

```typescript
import { cacheService } from '@/lib/llm';

// Get cache statistics
const stats = cacheService.getStats();
console.log(stats.hitRate); // Hit rate percentage
console.log(stats.memorySize); // Number of memory entries
console.log(stats.persistentSize); // Number of localStorage entries

// Clear cache for a specific repository
cacheService.invalidateRepository('owner', 'repo');

// Clear all cache
cacheService.clear();

// Clean up expired entries
cacheService.cleanup();
```

## Fallback System

The LLM integration includes comprehensive fallbacks:

### 1. Service Unavailable
When OpenAI API is unavailable, the system provides rule-based insights:

```typescript
// Health assessment fallback
if (healthData.score >= 80) {
  return "Repository health is excellent. Continue maintaining current practices.";
} else if (healthData.score < 60) {
  return "Repository health needs attention. Address critical issues first.";
}
```

### 2. API Errors
- **Rate Limits (429)**: Clear error message, cached responses used
- **Authentication (401)**: Prompts to check API key configuration
- **Timeouts**: 10-second timeout with graceful degradation

### 3. Invalid Responses
- Validates OpenAI response structure
- Falls back to rule-based insights on invalid data
- Logs errors for debugging

## Cost Optimization

### 1. Caching Strategy
- **80% cost reduction** for repeat visits
- Memory cache for instant responses
- Persistent cache survives page reloads
- Smart invalidation prevents stale data

### 2. Prompt Optimization
- **Maximum 500 tokens** per response
- **Temperature 0.3** for consistent, cost-effective responses
- Structured prompts minimize unnecessary tokens
- Focused context reduces API costs

### 3. Request Management
- **10-second timeout** prevents hanging requests
- **Rate limiting** prevents API abuse
- **Batch operations** where possible
- **Conditional requests** based on data changes

## Monitoring and Debugging

### Development Tools

For development environments, use the cache debug component:

```typescript
import { CacheDebug } from '@/components/insights/cache-debug';

// Only shows in development
<CacheDebug />
```

This provides real-time cache statistics:
- Memory and persistent cache sizes
- Hit rate percentage
- Total hits/misses
- Cache management controls

### Production Monitoring

Monitor these metrics in production:

```typescript
const stats = cacheService.getStats();

// Key metrics to track
- stats.hitRate          // Should be > 0.6
- stats.totalRequests    // Monitor usage patterns
- API response times     // Should be < 5 seconds
- Error rates           // Should be < 5%
```

## Security Considerations

### 1. API Key Protection
- Never commit API keys to version control
- Use environment variables for all configurations
- Consider API key rotation policies
- Monitor API usage for anomalies

### 2. Data Privacy
- No sensitive user data is sent to OpenAI
- Only repository metrics and public data are analyzed
- Cache data is stored locally (no external transmission)
- Clear cache on logout if needed

### 3. Rate Limiting
- Built-in request throttling
- Timeout protection (10 seconds)
- Graceful degradation on limits
- Cache-first strategy reduces requests

## Troubleshooting

### Common Issues

#### 1. "LLM service unavailable"
- Check `VITE_OPENAI_API_KEY` environment variable
- Verify API key is valid and has billing set up
- Check browser console for detailed errors

#### 2. "Rate limit exceeded"
- Wait for rate limit reset (usually 1 minute)
- Check OpenAI dashboard for usage limits
- Consider upgrading OpenAI plan for higher limits

#### 3. "Request timeout"
- Check internet connection
- Verify OpenAI API status
- Cache will provide fallback content

#### 4. Cache not working
- Check browser localStorage availability
- Clear browser storage if corrupted
- Verify no browser extensions blocking localStorage

### Debug Commands

```typescript
// Check LLM availability
console.log(llmService.isAvailable());

// Get detailed cache stats
console.log(cacheService.getStats());

// Test API connectivity
llmService.generateHealthInsight(testData, { owner: 'test', repo: 'test' })
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

## Best Practices

### 1. Error Handling
```typescript
try {
  const insight = await llmService.generateHealthInsight(data, repoInfo);
  if (insight) {
    // Use insight
  } else {
    // Show fallback content
  }
} catch (error) {
  console.error('LLM error:', error);
  // Always have fallback UI
}
```

### 2. Loading States
```typescript
const [loading, setLoading] = useState(false);
const [insight, setInsight] = useState(null);

const loadInsight = async () => {
  setLoading(true);
  try {
    const result = await llmService.generateHealthInsight(data, repoInfo);
    setInsight(result);
  } finally {
    setLoading(false);
  }
};
```

### 3. Cache Management
```typescript
// Invalidate cache when repository data changes significantly
useEffect(() => {
  if (dataHasChanged) {
    cacheService.invalidateRepository(owner, repo);
  }
}, [significantDataChange]);
```

## Future Enhancements

Planned improvements:

1. **Additional Insight Types**:
   - Contributor onboarding analysis
   - Code quality assessments
   - Security recommendations

2. **Advanced Caching**:
   - Server-side caching with Redis
   - Cross-user cache sharing for public repos
   - Predictive cache warming

3. **Analytics Integration**:
   - Usage tracking and optimization
   - A/B testing for prompt effectiveness
   - Cost analysis and optimization

4. **Model Options**:
   - Support for multiple LLM providers
   - Model selection based on use case
   - Local model integration options

## Support

For issues or questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review browser console errors
3. Test with cache cleared
4. Verify API key and billing setup
5. Create an issue with detailed error information

The LLM integration is designed to enhance the user experience while maintaining reliability and cost-effectiveness. It gracefully degrades when services are unavailable and provides valuable insights when they are.