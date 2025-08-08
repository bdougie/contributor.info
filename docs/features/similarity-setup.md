# Similarity Detection - Setup Guide

## Quick Start

### 1. Enable the Feature

The similarity detection is already configured if you have the workflow file. To enable it:

1. Ensure the workflow file exists at `.github/workflows/similarity-check.yml`
2. No additional setup required - it works out of the box!

### 2. First Run

The feature automatically activates when:
- A new issue is created
- A new pull request is opened
- An issue or PR is edited

## Detailed Setup Instructions

### Prerequisites

- GitHub repository with Issues enabled
- GitHub Actions enabled for the repository
- Node.js 20+ (handled by Actions)

### Step 1: Add the Workflow File

Create `.github/workflows/similarity-check.yml`:

```yaml
name: Similarity Check

on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, edited]
  workflow_dispatch:
    inputs:
      repository:
        description: 'Repository (owner/repo format)'
        required: false
      item_number:
        description: 'Issue or PR number'
        required: false
      similarity_threshold:
        description: 'Similarity threshold (0.0-1.0)'
        required: false
        default: '0.85'

jobs:
  check-similarity:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - name: Run similarity check
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npx tsx scripts/actions-similarity.ts \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.event.repository.name }} \
            --similarity-threshold 0.85
```

### Step 2: Add Required Dependencies

Ensure your `package.json` includes:

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.6.0",
    "@octokit/rest": "^20.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Step 3: Add the Similarity Script

The core script should be at `scripts/actions-similarity.ts`. This is already included in the repository.

### Step 4: Configure Permissions

The workflow needs these permissions:
- **issues: write** - To post comments on issues
- **pull-requests: write** - To post comments on PRs
- **contents: read** - To read repository content

These are already configured in the workflow file.

## Configuration Options

### Basic Configuration

#### Similarity Threshold

Control how similar items need to be to be considered related:

```yaml
env:
  SIMILARITY_THRESHOLD: "0.85"  # 85% similarity required
```

**Recommended values:**
- `0.95`: Nearly identical (duplicates)
- `0.85`: Very similar (default)
- `0.75`: Moderately similar
- `0.65`: Loosely related

#### Maximum Items to Process

Limit the number of items analyzed:

```yaml
env:
  MAX_ITEMS: "100"  # Process latest 100 items
```

### Advanced Configuration

#### Custom Workflow Triggers

```yaml
on:
  issues:
    types: [opened, edited, reopened]
  pull_request:
    types: [opened, edited, synchronize]
  schedule:
    - cron: '0 0 * * 0'  # Weekly analysis
```

#### Environment-Specific Settings

```yaml
jobs:
  check-similarity:
    strategy:
      matrix:
        environment: [development, staging, production]
    env:
      SIMILARITY_THRESHOLD: ${{ 
        matrix.environment == 'production' && '0.9' || '0.8' 
      }}
```

#### Repository-Specific Configuration

Create `.github/similarity.json`:

```json
{
  "enabled": true,
  "threshold": 0.85,
  "maxItems": 100,
  "excludeLabels": ["duplicate", "wontfix"],
  "includeClosedItems": true,
  "commentTemplate": "custom",
  "features": {
    "crossRepository": false,
    "autoLabel": true,
    "suggestAssignees": false
  }
}
```

Load in workflow:

```yaml
- name: Load config
  id: config
  run: |
    if [ -f .github/similarity.json ]; then
      echo "config=$(cat .github/similarity.json | jq -c .)" >> $GITHUB_OUTPUT
    else
      echo "config={}" >> $GITHUB_OUTPUT
    fi

- name: Run with config
  run: |
    THRESHOLD=${{ fromJSON(steps.config.outputs.config).threshold || 0.85 }}
    npx tsx scripts/actions-similarity.ts --similarity-threshold $THRESHOLD
```

## Customization

### Custom Comment Templates

#### Simple Customization

Edit the workflow to modify the comment format:

```javascript
// In the workflow script section
let comment = '## 🎯 Duplicate Check\n\n';
comment += 'We found these similar items:\n\n';
// ... rest of formatting
```

#### Template File Approach

Create `.github/similarity-template.md`:

```markdown
## {{icon}} Similar Items Detected

Found **{{count}}** similar items with >{{threshold}}% similarity:

{{#each items}}
- [#{{number}}]({{url}}): {{title}} _({{similarity}}% match)_
{{/each}}

---
_Automated by similarity detection bot_
```

### Label Management

#### Auto-Label Duplicates

```yaml
- name: Add duplicate label
  if: steps.results.outputs.similarity_score > 0.95
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        labels: ['potential-duplicate']
      });
```

#### Remove Labels on Resolution

```yaml
- name: Remove duplicate label if unique
  if: steps.results.outputs.similarity_score < 0.75
  uses: actions/github-script@v7
  with:
    script: |
      try {
        await github.rest.issues.removeLabel({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          name: 'potential-duplicate'
        });
      } catch (error) {
        // Label might not exist
      }
```

### Notification Integration

#### Slack Notifications

```yaml
- name: Notify Slack
  if: steps.results.outputs.found_similar == 'true'
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Potential duplicate detected!",
        "blocks": [{
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Issue #${{ github.event.issue.number }} might be a duplicate"
          }
        }]
      }
```

#### Email Notifications

```yaml
- name: Send email alert
  if: steps.results.outputs.similarity_score > 0.95
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: Duplicate Issue Detected
    body: Issue #${{ github.event.issue.number }} appears to be a duplicate
    to: team@example.com
```

## Database Setup (Optional)

For persistent similarity tracking, set up a PostgreSQL database with pgvector:

### 1. Install pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For text similarity
```

### 2. Create Tables

```sql
-- Issues with embeddings
CREATE TABLE issues (
    id SERIAL PRIMARY KEY,
    github_id BIGINT UNIQUE NOT NULL,
    repository_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(20),
    embedding VECTOR(384),
    content_hash VARCHAR(64),
    embedding_generated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE(repository_id, number)
);

-- Create index for similarity search
CREATE INDEX idx_issues_embedding 
ON issues USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### 3. Configure Database Connection

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  # Format: postgresql://user:password@host:5432/dbname
```

### 4. Enable Persistent Storage

Update the script to store embeddings:

```typescript
import { supabase } from '../src/lib/supabase';

// After generating embedding
await supabase
  .from('issues')
  .upsert({
    github_id: issue.id,
    embedding: embedding,
    content_hash: hash,
    embedding_generated_at: new Date()
  });
```

## Testing Your Setup

### 1. Manual Test

Trigger the workflow manually:

```bash
gh workflow run similarity-check.yml \
  -f repository=owner/repo \
  -f item_number=123 \
  -f similarity_threshold=0.8
```

### 2. Local Testing

Test the script locally:

```bash
# Set environment variable
export GITHUB_TOKEN=your_token_here

# Run similarity check
npx tsx scripts/actions-similarity.ts \
  --owner octocat \
  --repo hello-world \
  --item-number 1 \
  --item-type issues \
  --similarity-threshold 0.85
```

### 3. Verify Results

Check for:
1. `similarity-results.json` file created
2. Comment posted on issue/PR (if similar items found)
3. Workflow summary in Actions tab

## Monitoring

### GitHub Actions Dashboard

Monitor workflow runs:
1. Go to repository → Actions tab
2. Select "Similarity Check" workflow
3. View run history and logs

### Custom Metrics

Add metrics collection:

```yaml
- name: Log metrics
  if: always()
  run: |
    echo "::notice ::Items processed: ${{ steps.results.outputs.item_count }}"
    echo "::notice ::Similar items found: ${{ steps.results.outputs.similar_count }}"
    echo "::notice ::Processing time: ${{ steps.results.outputs.duration }}ms"
```

### Cost Tracking

Estimate GitHub Actions usage:

```yaml
- name: Calculate usage
  run: |
    # Ubuntu runner: $0.008/minute
    DURATION=${{ steps.results.outputs.duration_seconds }}
    COST=$(echo "scale=4; $DURATION / 60 * 0.008" | bc)
    echo "Estimated cost: \$$COST"
```

## Troubleshooting

### Workflow Not Triggering

1. Check workflow file location: `.github/workflows/similarity-check.yml`
2. Verify file syntax: `yamllint .github/workflows/similarity-check.yml`
3. Check Actions permissions in repository settings
4. Ensure Actions are not disabled for the repository

### No Similar Items Found

1. Lower the similarity threshold
2. Increase max_items to analyze more content
3. Ensure issues have descriptive titles and bodies
4. Check that the model is loading correctly

### Performance Issues

1. Reduce max_items for faster processing
2. Implement caching for frequently accessed items
3. Use matrix strategy for parallel processing
4. Consider upgrading to larger runner

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Bad credentials` | Invalid token | Check GITHUB_TOKEN |
| `Resource not accessible` | Permission issue | Update workflow permissions |
| `Cannot find module` | Missing dependency | Run `npm ci` |
| `Out of memory` | Too many items | Reduce batch size |

## Best Practices

### 1. Optimize for Your Repository

- **Small repos (<100 issues)**: Process all items
- **Medium repos (100-1000)**: Process recent 200 items
- **Large repos (>1000)**: Process recent 100 items, use scheduling

### 2. Gradual Rollout

```yaml
# Start with high threshold
env:
  SIMILARITY_THRESHOLD: "0.95"  # Week 1: Only catch duplicates
  # SIMILARITY_THRESHOLD: "0.90"  # Week 2: Very similar
  # SIMILARITY_THRESHOLD: "0.85"  # Week 3: Production ready
```

### 3. Monitor and Adjust

Track metrics weekly:
- False positive rate
- Processing time
- User feedback
- Resource usage

### 4. User Education

Add to your contributing guidelines:

```markdown
## Before Creating an Issue

Our repository uses automatic similarity detection. When you create an issue:
1. You'll see similar existing issues
2. Please check if your issue is already covered
3. Link to related issues if different but connected
```

## Support

- [Documentation](./similarity-detection.md)
- [Architecture Guide](./similarity-architecture.md)
- [GitHub Issues](https://github.com/bdougie/contributor.info/issues)
- [Discord Community](https://discord.gg/contributor-info)