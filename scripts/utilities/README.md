# Utility Scripts

General-purpose tools and utilities for various maintenance, analysis, and operational tasks.

## 🔧 Overview

Utility scripts provide:
- Repository classification and analysis
- AI embedding management
- Code verification and validation
- System maintenance tools

## 🛠️ Scripts

### AI & Classification
| Script | Purpose | Usage |
|--------|---------|-------|
| `classify-repositories.ts` | Categorize repos by type/language | Data analysis |
| `regenerate-embeddings.ts` | Rebuild AI embeddings | Search optimization |
| `verify-embeddings.ts` | Validate embedding accuracy | Quality assurance |
| `run-maintainer-eval.ts` | Evaluate maintainer metrics | Contributor analysis |

### Code Quality
| Script | Purpose | Usage |
|--------|---------|-------|
| `optimize-icon-imports.js` | Optimize icon bundle size | Build optimization |
| `verify-es-module-fix.js` | Verify ES module compatibility | Module validation |
| `verify-social-card-system.js` | Test social card generation | Feature validation |

### System Utilities
| Script | Purpose | Usage |
|--------|---------|-------|
| `search-user-reviews.mjs` | Search PR reviews by user | Data investigation |
| `report-job-status.js` | Report background job status | Job monitoring |
| `tier.sh` | Manage user tiers | User management |
| `update-rollout.js` | Update feature rollout config | Feature flags |

## 💡 Usage Examples

### Repository Classification
```bash
# Classify all repositories
npx tsx scripts/utilities/classify-repositories.ts

# Classify specific organization
npx tsx scripts/utilities/classify-repositories.ts --org facebook

# Export classifications
npx tsx scripts/utilities/classify-repositories.ts --export
```

### AI Embeddings
```bash
# Regenerate all embeddings
npx tsx scripts/utilities/regenerate-embeddings.ts

# Regenerate for specific repos
npx tsx scripts/utilities/regenerate-embeddings.ts --repos "pytorch/pytorch,facebook/react"

# Verify embedding quality
npx tsx scripts/utilities/verify-embeddings.ts --threshold 0.8
```

### Search Operations
```bash
# Search user reviews
node scripts/utilities/search-user-reviews.mjs --user "octocat" --days 30

# Find specific review patterns
node scripts/utilities/search-user-reviews.mjs --pattern "LGTM" --state approved
```

### System Maintenance
```bash
# Update rollout percentage
node scripts/utilities/update-rollout.js --feature "new-dashboard" --percentage 50

# Check job status
node scripts/utilities/report-job-status.js --type "sync" --last 24h
```

## 🏷️ Repository Classification

### Categories
```javascript
{
  framework: ["react", "vue", "angular"],
  language: ["javascript", "python", "rust"],
  type: ["library", "application", "tool"],
  size: ["small", "medium", "large", "massive"],
  activity: ["active", "moderate", "low", "archived"]
}
```

### Classification Rules
1. **Framework**: Primary technology used
2. **Language**: Dominant programming language
3. **Type**: Repository purpose
4. **Size**: Based on stars, contributors
5. **Activity**: Recent commit frequency

## 🤖 AI Embeddings

### Embedding Process
```
Repository Data → Text Extraction → Vectorization → Storage
                           ↓
                   Description, README, Topics
                           ↓
                   OpenAI text-embedding-ada-002
                           ↓
                   1536-dimension vectors
```

### Quality Metrics
- **Similarity Threshold**: 0.8+
- **Coverage**: 95%+ repos
- **Freshness**: <30 days old

## 🔍 Search Utilities

### Review Search
```javascript
// Search parameters
{
  user: "username",
  repository: "owner/name",
  state: ["approved", "changes_requested", "commented"],
  dateRange: { start: "2024-01-01", end: "2024-03-15" },
  pattern: "regex pattern"
}
```

### Results Format
```javascript
{
  total: 45,
  reviews: [{
    pr: { number: 123, title: "Add feature X" },
    state: "approved",
    body: "LGTM! Great work.",
    submitted_at: "2024-03-10T10:30:00Z",
    repository: "facebook/react"
  }]
}
```

## ⚙️ Configuration

### Classification Config
```javascript
// config/classification.js
export default {
  rules: {
    framework: { 
      minConfidence: 0.7,
      multiLabel: true 
    },
    size: {
      thresholds: {
        small: { maxStars: 100 },
        medium: { maxStars: 1000 },
        large: { maxStars: 10000 },
        massive: { minStars: 10000 }
      }
    }
  }
}
```

### Embedding Config
```javascript
// config/embeddings.js
export default {
  model: "text-embedding-ada-002",
  dimensions: 1536,
  batchSize: 100,
  rateLimit: 3000 // per minute
}
```

## 🚀 Performance

### Optimization Tips
1. **Batch Operations**: Process in groups
2. **Caching**: Store computed results
3. **Async Processing**: Use parallel execution
4. **Rate Limiting**: Respect API limits

### Benchmarks
- Classification: ~100 repos/second
- Embedding generation: ~50 repos/minute
- Search operations: <100ms average

## 📊 Reports

### Classification Report
```
Repository Classification Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Repositories: 1,234

By Framework:
├── React: 456 (37%)
├── Vue: 234 (19%)
└── Other: 544 (44%)

By Language:
├── JavaScript: 678 (55%)
├── Python: 345 (28%)
└── Other: 211 (17%)

By Activity:
├── Active: 890 (72%)
├── Moderate: 234 (19%)
└── Low: 110 (9%)
```

### Embedding Report
```
Embedding Quality Report
━━━━━━━━━━━━━━━━━━━━━

Total Embeddings: 1,234
Average Similarity: 0.87
Coverage: 98.5%

Issues Found:
- 12 repos missing embeddings
- 8 repos with low quality (<0.7)
- 15 repos need regeneration
```

## 🔄 Maintenance Tasks

### Regular Maintenance
```bash
# Weekly tasks
npm run utilities:classify
npm run utilities:verify-embeddings

# Monthly tasks
npm run utilities:regenerate-embeddings
npm run utilities:cleanup
```

### Ad-hoc Tasks
```bash
# Fix specific issues
node scripts/utilities/optimize-icon-imports.js --fix

# Verify fixes
node scripts/utilities/verify-es-module-fix.js
```

## 🆘 Troubleshooting

### "Classification failed"
- Check repository data completeness
- Verify API access
- Review classification rules

### "Embedding generation slow"
- Reduce batch size
- Check rate limits
- Use caching

### "Search returns no results"
- Verify search syntax
- Check data availability
- Review date ranges