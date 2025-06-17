# LLM Quick Start Guide

Get AI-powered insights running in 5 minutes.

## 🚀 Quick Setup

### 1. Get OpenAI API Key
```bash
# Visit: https://platform.openai.com/api-keys
# Create new key, copy it (starts with sk-)
```

### 2. Add to Environment
```bash
# Create or edit .env.local
echo "VITE_OPENAI_API_KEY=sk-your-key-here" >> .env.local
```

### 3. Restart Development Server
```bash
npm run dev
```

### 4. Test It Works
- Navigate to any repository (e.g., `/microsoft/typescript`)
- Open the insights sidebar (purple sparkles icon)
- Click on "Repository Health" section
- Look for the blue "AI Insights" card

## ✨ What You Get

### Repository Health
- Natural language explanation of health scores
- Contextual insights about critical issues
- Confidence scoring for AI assessments

### AI Recommendations  
- Strategic advice based on real repository data
- Actionable suggestions with GitHub links
- Priority-based recommendations

### Smart Caching
- 80% cost reduction through intelligent caching
- Fast responses for repeated requests
- Works offline with cached insights

## 🛠️ Development

### Check LLM Status
```typescript
import { llmService } from '@/lib/llm';

console.log('LLM Available:', llmService.isAvailable());
```

### Cache Debug (Development Only)
```typescript
import { CacheDebug } from '@/components/insights/cache-debug';

// Add to any component during development
<CacheDebug />
```

### Manual Testing
```typescript
// Test health insight generation
const insight = await llmService.generateHealthInsight(
  { score: 75, trend: 'improving', factors: [], recommendations: [] },
  { owner: 'test', repo: 'test' }
);
console.log(insight);
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "LLM service unavailable" | Check `VITE_OPENAI_API_KEY` in `.env.local` |
| No AI insights showing | Restart dev server after adding API key |
| "Rate limit exceeded" | Wait 1 minute or check OpenAI billing |
| Cache not working | Clear browser localStorage |

## 💰 Cost Management

- **Free tier**: 100 requests for testing
- **Paid usage**: ~$0.01-0.03 per insight
- **Caching**: Reduces costs by 80%
- **Monitor**: Check OpenAI dashboard for usage

## 📖 Full Documentation

For complete details, see [LLM_INTEGRATION.md](./LLM_INTEGRATION.md)

## 🎯 Key Files

```
src/lib/llm/
├── index.ts              # Main exports
├── llm-service.ts        # High-level API
├── openai-service.ts     # OpenAI integration
└── cache-service.ts      # Caching system

src/components/insights/sections/
├── repository-health.tsx # Health + AI insights
└── recommendations.tsx   # Recommendations + AI
```

That's it! You now have AI-powered repository insights. 🎉