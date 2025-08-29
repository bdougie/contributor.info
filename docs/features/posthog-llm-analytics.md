# PostHog LLM Analytics Integration

## Overview

This project now includes comprehensive LLM analytics and observability powered by PostHog. All OpenAI API calls are automatically tracked with detailed metrics including token usage, costs, latency, and error rates.

## What Gets Captured

### Automatic Tracking for All LLM Calls

When PostHog LLM analytics is enabled, the following data is automatically captured for every OpenAI API call:

#### Core LLM Metrics
- **Model Information**: Model name and version used (e.g., `gpt-4o-mini`, `gpt-4o`)
- **Token Usage**: 
  - Input tokens (prompt)
  - Output tokens (completion)
  - Total tokens used
- **Cost Tracking**: Calculated cost in USD based on current OpenAI pricing
- **Latency**: Response time in milliseconds
- **Provider**: Always `openai` for our implementation

#### Custom Business Context
- **Feature**: What part of the app triggered the call (e.g., `health-insight`, `pr-pattern-analysis`)
- **Repository**: Which repository the analysis was for (format: `owner/repo`)
- **User Context**: User ID (if available) or `anonymous`
- **Trace ID**: Unique identifier for tracking related calls
- **Conversation ID**: Links multiple calls in the same user session

#### Error Tracking
- **Error Events**: Separate `$ai_generation_error` events for failed calls
- **Error Details**: Error type, message, and context
- **Debugging Info**: Full context to help identify and fix issues

## Features Using LLM Analytics

### 1. Repository Health Insights (`src/lib/llm/`)
- **Service**: `posthogOpenAIService.generateHealthInsight()`
- **Model**: `gpt-4o-mini` (cost-optimized for simple summaries)
- **Tracked Properties**:
  ```javascript
  {
    feature: 'health-insight',
    repository: 'owner/repo',
    health_score: 85,
    insight_type: 'health'
  }
  ```

### 2. Development Recommendations (`src/lib/llm/`)
- **Service**: `posthogOpenAIService.generateRecommendations()`
- **Model**: `gpt-4o` (higher capability for complex analysis)
- **Tracked Properties**:
  ```javascript
  {
    feature: 'recommendations',
    repository: 'owner/repo',
    insight_type: 'recommendation'
  }
  ```

### 3. PR Pattern Analysis (`src/lib/llm/`)
- **Service**: `posthogOpenAIService.analyzePRPatterns()`
- **Model**: `gpt-4o` (pattern recognition requires advanced reasoning)
- **Tracked Properties**:
  ```javascript
  {
    feature: 'pr-pattern-analysis',
    repository: 'owner/repo',
    pr_count: 25,
    insight_type: 'pattern'
  }
  ```

### 4. PR Insights (Supabase Edge Function)
- **Location**: `supabase/functions/insights/index.ts`
- **Model**: `gpt-4-1106-preview` (maintained for consistency)
- **Tracked Properties**:
  ```javascript
  {
    feature: 'pr-insights',
    repository: 'owner/repo',
    function_type: 'edge_function',
    pull_request_count: 15,
    open_pr_count: 8,
    merged_pr_count: 7
  }
  ```

## PostHog Event Schema

### Successful LLM Calls: `$ai_generation`
```javascript
{
  distinctId: 'user-123' | 'anonymous',
  event: '$ai_generation',
  properties: {
    // Standard PostHog LLM properties
    $ai_model: 'gpt-4o-mini',
    $ai_input_tokens: 150,
    $ai_output_tokens: 75,
    $ai_total_tokens: 225,
    $ai_cost_dollars: 0.000135,
    $ai_latency_ms: 1250,
    $ai_provider: 'openai',
    $ai_input: '[PROMPT_TEXT]', // Redacted if privacy mode enabled
    $ai_output: '[RESPONSE_TEXT]', // Redacted if privacy mode enabled
    
    // Custom application properties
    feature: 'health-insight',
    repository: 'facebook/react',
    conversation_id: 'conv-abc123',
    trace_id: 'trace-def456',
    insight_type: 'health',
    health_score: 85
  },
  groups: {
    organization: 'org-123' // If user belongs to an organization
  }
}
```

### Failed LLM Calls: `$ai_generation_error`
```javascript
{
  distinctId: 'user-123' | 'anonymous',
  event: '$ai_generation_error',
  properties: {
    error_message: 'OpenAI API rate limit exceeded',
    error_type: 'Error',
    feature: 'health-insight',
    repository: 'facebook/react',
    conversation_id: 'conv-abc123',
    trace_id: 'trace-def456',
    $ai_input: '[PROMPT_TEXT]' // Redacted if privacy mode enabled
  }
}
```

## Configuration

### Environment Variables

#### Client-Side (Browser)
```bash
# Optional - enables tracking for client-side calls
VITE_POSTHOG_API_KEY=your-posthog-api-key
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

#### Server-Side (Supabase Edge Functions)
```bash
# Required for edge function tracking
POSTHOG_API_KEY=your-posthog-api-key
POSTHOG_HOST=https://us.i.posthog.com
```

### Service Configuration

The `PostHogOpenAIService` automatically detects environment variables and enables/disables tracking accordingly:

```typescript
const posthogConfig = {
  apiKey: import.meta.env?.VITE_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY,
  host: import.meta.env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  enableTracking: !!(import.meta.env?.VITE_POSTHOG_API_KEY || process.env.POSTHOG_API_KEY),
  enablePrivacyMode: false, // Set to true to redact conversation content
};
```

## Privacy Mode

When `enablePrivacyMode` is set to `true`, the service will:
- Track all metrics (tokens, cost, latency, errors)
- Track custom business properties
- **Redact** actual prompt and response content
- Mark events with `privacy_mode: true`

This allows you to get full observability while maintaining privacy compliance.

## Cost Calculation

Costs are automatically calculated based on current OpenAI pricing (as of January 2025):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |

Costs are calculated per request and stored in the `$ai_cost_dollars` property.

## Integration Patterns

### Using the LLM Service with Tracking
```typescript
import { llmService, type LLMCallMetadata } from '@/lib/llm/llm-service';

// Call with tracking metadata
const metadata: LLMCallMetadata = {
  userId: 'user-123',
  traceId: `trace-${Date.now()}`,
  conversationId: 'health-analysis-session',
  feature: 'health-insight',
  repository: 'facebook/react',
  organizationId: 'org-123'
};

const insight = await llmService.generateHealthInsight(
  healthData,
  { owner: 'facebook', repo: 'react' },
  metadata
);
```

### Direct Service Usage
```typescript
import { posthogOpenAIService } from '@/lib/llm/posthog-openai-service';

const insight = await posthogOpenAIService.generateHealthInsight(
  healthData,
  { owner: 'facebook', repo: 'react' },
  {
    userId: 'user-123',
    feature: 'health-analysis',
    repository: 'facebook/react'
  }
);
```

### Proper Shutdown
```typescript
import { shutdownLLMService } from '@/lib/llm/llm-service';

// Ensure all events are sent before app shutdown
await shutdownLLMService();
```

## PostHog Dashboard Setup

### 1. Enable LLM Observability
1. Go to your PostHog project settings
2. Enable the "LLM Observability" feature
3. Create a new dashboard for LLM analytics

### 2. Recommended Dashboard Widgets

#### Cost Tracking
- **Widget**: Line chart
- **Event**: `$ai_generation`
- **Y-axis**: Sum of `$ai_cost_dollars`
- **Group by**: `feature`, `repository`, `$ai_model`

#### Token Usage
- **Widget**: Line chart  
- **Event**: `$ai_generation`
- **Y-axis**: Sum of `$ai_total_tokens`
- **Group by**: `feature`, `$ai_model`

#### Latency Monitoring
- **Widget**: Line chart
- **Event**: `$ai_generation`
- **Y-axis**: Average of `$ai_latency_ms`
- **Group by**: `feature`, `$ai_model`

#### Error Rate
- **Widget**: Funnel
- **Steps**: 
  1. All LLM calls (`$ai_generation` OR `$ai_generation_error`)
  2. Successful calls (`$ai_generation`)

#### Feature Usage
- **Widget**: Bar chart
- **Event**: `$ai_generation`
- **Y-axis**: Count
- **Group by**: `feature`

#### Repository Analysis
- **Widget**: Table
- **Event**: `$ai_generation`
- **Columns**: `repository`, count, sum(`$ai_cost_dollars`), avg(`$ai_latency_ms`)

### 3. Alerts and Monitoring

Set up alerts for:
- **High Error Rate**: When `$ai_generation_error` events exceed 5% of total
- **High Costs**: When daily `$ai_cost_dollars` sum exceeds threshold
- **High Latency**: When `$ai_latency_ms` average exceeds 10 seconds
- **Token Limit Warnings**: When approaching monthly token budgets

## Troubleshooting

### Common Issues

#### 1. No Events Appearing
- Verify `POSTHOG_API_KEY` is set correctly
- Check that PostHog host URL is correct
- Ensure `posthogOpenAIService.isTrackingEnabled()` returns `true`

#### 2. Missing Properties
- Verify metadata is being passed to LLM service calls
- Check for console warnings about PostHog initialization

#### 3. Cost Calculations Incorrect
- Ensure the `calculateCost()` function has current pricing
- Check that usage data is being returned by OpenAI API

#### 4. Edge Function Tracking Not Working
- Verify edge function environment variables are set in Supabase dashboard
- Check edge function logs for PostHog initialization messages

### Debug Mode
Enable debug logging by setting console log level in your service:
```typescript
console.log('PostHog tracking enabled:', posthogOpenAIService.isTrackingEnabled());
console.log('LLM service available:', posthogOpenAIService.isAvailable());
```

## Security Considerations

- **API Keys**: PostHog API keys are safe to expose client-side (they're project-specific read keys)
- **Content Privacy**: Enable privacy mode if handling sensitive data
- **Rate Limiting**: PostHog has generous limits (100k events/month free)
- **Data Retention**: Configure PostHog data retention policies as needed

## Benefits

### For Developers
- **Real-time Monitoring**: See LLM usage, costs, and performance in real-time
- **Error Tracking**: Automatically capture and debug LLM failures
- **Cost Control**: Monitor and set alerts for LLM spending
- **Performance Optimization**: Identify slow or inefficient LLM calls

### For Product Teams
- **Feature Usage**: See which AI features users engage with most
- **User Journey**: Track how users interact with AI-powered features
- **Business Impact**: Measure ROI of AI features through usage analytics
- **A/B Testing**: Compare different models or prompts using PostHog experiments

### For Operations
- **Capacity Planning**: Predict future LLM usage and costs
- **SLA Monitoring**: Track response times and availability
- **Budget Management**: Set spending limits and get alerts
- **Vendor Management**: Compare costs across different LLM providers

This comprehensive observability setup provides full visibility into your AI features while maintaining flexibility and privacy controls.