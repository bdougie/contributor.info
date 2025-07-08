# OpenAI Token Tracker System

The Token Tracker is an intelligent system that manages OpenAI API usage to maximize free tier benefits and minimize costs.

## Overview

OpenAI provides different free token quotas per day based on model type. The Token Tracker automatically selects the most cost-effective model for each request while maintaining quality.

### Free Tier Quotas (per day)
- **gpt-4o** (primary): 1,000,000 tokens/day - High-quality complex analysis
- **gpt-4o-mini** (mini): 10,000,000 tokens/day - Efficient for simple tasks

## How It Works

### 1. Token Estimation

Before making any API call, the system estimates token usage:

```typescript
getEstimatedTokens(insightType: 'health' | 'recommendation' | 'pattern'): number {
  switch (insightType) {
    case 'health': return 150;        // Simple health summaries
    case 'recommendation': return 250; // Complex strategic advice
    case 'pattern': return 200;       // Pattern analysis
  }
}
```

### 2. Smart Model Selection

The system chooses the optimal model based on:
- **Task complexity**: Simple tasks use mini models, complex tasks use primary models
- **Quota availability**: Prefers models with higher available quotas
- **Quality requirements**: Uses premium models for strategic recommendations

```typescript
// Selection strategy
Health Insights → gpt-4o-mini (simple analysis, 10M quota)
Recommendations → gpt-4o (complex analysis, 1M quota)
Pattern Analysis → Smart fallback based on availability
```

### 3. Usage Tracking

Daily usage is tracked in localStorage:

```typescript
interface DailyUsage {
  date: string;           // YYYY-MM-DD format
  primaryTokens: number;  // Tokens used for gpt-4o (1M limit)
  miniTokens: number;     // Tokens used for gpt-4o-mini (10M limit)
}
```

### 4. Quota Management

Before each request:
1. Check current date (auto-reset daily)
2. Estimate tokens needed for request
3. Verify quota availability
4. Select optimal model
5. Record usage after successful call

## Usage Examples

### Basic Usage

```typescript
import { tokenTracker } from '@/lib/llm/token-tracker';

// Check if a request can be made
const canMakeRequest = tokenTracker.canUseModel('gpt-4o', 'recommendation');

// Get recommended model for a task
const model = tokenTracker.getRecommendedModel('health');

// Track usage after API call
tokenTracker.trackUsage('gpt-4o-mini', 'health');
```

### Getting Usage Statistics

```typescript
const stats = tokenTracker.getUsageStats();

console.log('Today\'s usage:');
console.log('Primary tokens:', stats.today.primaryTokens, '/ 1,000,000');
console.log('Mini tokens:', stats.today.miniTokens, '/ 10,000,000');

console.log('Remaining quotas:');
console.log('Primary remaining:', stats.primaryRemaining);
console.log('Mini remaining:', stats.miniRemaining);

console.log('Usage percentages:');
console.log('Primary used:', stats.primaryPercentUsed.toFixed(1) + '%');
console.log('Mini used:', stats.miniPercentUsed.toFixed(1) + '%');

console.log('Can use models:');
console.log('Can use primary:', stats.canUsePrimary);
console.log('Can use mini:', stats.canUseMini);
```

### Integration with OpenAI Service

```typescript
// In openai-service.ts
async generateHealthInsight(healthData, repoInfo) {
  // Get optimal model for this request
  const model = tokenTracker.getRecommendedModel('health');
  
  // Check if we can make the request
  if (!tokenTracker.canUseModel(model, 'health')) {
    console.warn('Token quota exceeded, using fallback');
    return this.generateFallbackInsight(healthData);
  }

  try {
    const response = await this.callOpenAI(prompt, model);
    
    // Track successful usage
    tokenTracker.trackUsage(model, 'health');
    
    return response;
  } catch (error) {
    // Handle errors without tracking usage
    throw error;
  }
}
```

## Cost Optimization Benefits

### 1. Intelligent Model Routing
- Simple health summaries → gpt-4o-mini (10M free quota)
- Complex recommendations → gpt-4o (1M free quota)
- **Result**: Maximizes free tier usage before hitting paid usage

### 2. Quota Exhaustion Handling
- Graceful fallbacks when quotas are exceeded
- Smart model switching (primary → mini, or vice versa)
- Clear user messaging about quota status

### 3. Daily Reset Management
- Automatic quota reset at midnight UTC
- Fresh tracking for each day
- No manual intervention required

## Configuration

### Model Classification

```typescript
// Models eligible for free tier
const modelTiers = {
  primary: ['gpt-4o', 'gpt-4.5-preview', 'gpt-4.1', 'o1', 'o3'],
  mini: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o1-mini', 'o3-mini'],
  dailyLimits: {
    primary: 1000000,   // 1M tokens/day
    mini: 10000000      // 10M tokens/day
  }
};
```

### Token Estimates by Use Case

```typescript
const tokenEstimates = {
  health: 150,        // "Repository health is good. Continue..."
  recommendation: 250, // "1. Improve PR review process..."
  pattern: 200        // "Analysis shows high collaboration..."
};
```

## Monitoring and Debugging

### Development Tools

```typescript
// Get real-time statistics
const stats = tokenTracker.getUsageStats();

// Check specific model availability
const canUseGPT4 = tokenTracker.canUseModel('gpt-4o', 'recommendation');

// Test model selection logic
const recommended = tokenTracker.getRecommendedModel('health');

// Reset for testing (development only)
tokenTracker.resetUsage();
```

### Production Monitoring

Monitor these key metrics:

```typescript
const stats = tokenTracker.getUsageStats();

// Alert thresholds
if (stats.primaryPercentUsed > 80) {
  console.warn('Primary quota 80% exhausted');
}

if (stats.miniPercentUsed > 90) {
  console.warn('Mini quota 90% exhausted');
}

// Track usage patterns
console.log('Daily usage patterns:', {
  primaryTokens: stats.today.primaryTokens,
  miniTokens: stats.today.miniTokens,
  totalRequests: stats.today.primaryTokens + stats.today.miniTokens
});
```

## Error Handling

### Quota Exhaustion

```typescript
// Check before making request
if (!tokenTracker.canUseModel(preferredModel, insightType)) {
  // Try alternative model
  const fallbackModel = tokenTracker.getRecommendedModel(insightType);
  
  if (fallbackModel && tokenTracker.canUseModel(fallbackModel, insightType)) {
    // Use fallback model
    return await this.callOpenAI(prompt, fallbackModel);
  } else {
    // All quotas exhausted, use rule-based fallback
    return this.generateRuleBasedInsight(data);
  }
}
```

### Storage Errors

```typescript
// Handle localStorage unavailable
try {
  const usage = this.getTodayUsage();
} catch (error) {
  console.warn('Token tracking storage unavailable:', error);
  // Continue with default quotas (assume fresh day)
  return { date: today, primaryTokens: 0, miniTokens: 0 };
}
```

## Best Practices

### 1. Always Check Availability
```typescript
// Before expensive operations
if (tokenTracker.canUseModel(model, insightType)) {
  await makeAPICall();
} else {
  useFallback();
}
```

### 2. Track All Usage
```typescript
// After successful API calls
try {
  const response = await openai.call();
  tokenTracker.trackUsage(model, insightType); // Track success
  return response;
} catch (error) {
  // Don't track failed calls
  throw error;
}
```

### 3. Monitor Quota Health
```typescript
// Regular monitoring
const stats = tokenTracker.getUsageStats();
if (stats.primaryPercentUsed > 75) {
  // Switch to more conservative model selection
  preferMiniModels = true;
}
```

### 4. Graceful Degradation
```typescript
// Always have fallbacks
const getInsight = async (data) => {
  try {
    return await llmService.generateInsight(data);
  } catch (quotaError) {
    return generateRuleBasedInsight(data);
  }
};
```

## Troubleshooting

### Common Issues

#### Token counting seems wrong
- Estimates are conservative approximations
- Actual usage may vary ±20%
- Reset tracking: `tokenTracker.resetUsage()`

#### Wrong model being selected
- Check quota status: `tokenTracker.getUsageStats()`
- Verify model classification in console
- Review selection logic for edge cases

#### Quota not resetting daily
- Check system timezone vs UTC
- Verify localStorage persistence
- Check date format consistency

### Debug Commands

```typescript
// Complete diagnostic
const debug = {
  stats: tokenTracker.getUsageStats(),
  canUsePrimary: tokenTracker.canUseModel('gpt-4o', 'recommendation'),
  canUseMini: tokenTracker.canUseModel('gpt-4o-mini', 'health'),
  recommendedForHealth: tokenTracker.getRecommendedModel('health'),
  recommendedForRecs: tokenTracker.getRecommendedModel('recommendation')
};
console.table(debug);
```

## Future Enhancements

### Planned Improvements
1. **Server-side tracking** for cross-device quota management
2. **Usage analytics** for optimization insights
3. **Custom token estimates** based on actual usage patterns
4. **Quota alerts** and usage notifications
5. **A/B testing** for model selection strategies

The Token Tracker system ensures you get maximum value from OpenAI's free tier while maintaining high-quality AI insights for your repository analysis.