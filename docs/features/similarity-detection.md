# Similarity Detection for Issues and Pull Requests

## Overview

The Similarity Detection feature automatically identifies related issues and pull requests using semantic similarity analysis. When a new issue or PR is created, it analyzes the content and finds similar items to help prevent duplicates and connect related discussions.

## How It Works

### Core Technology

The system uses **MiniLM-L6-v2**, a lightweight transformer model that converts text into 384-dimensional vectors (embeddings). These vectors capture the semantic meaning of the text, allowing us to find similar content even when different words are used.

### Key Features

- **Automatic Detection**: Triggers on new issues and PRs
- **Semantic Understanding**: Finds similar content even with different wording
- **Categorized Results**: Groups results by type (issue/PR) and state (open/closed)
- **Performance Optimized**: Uses local processing with no external API calls
- **Privacy Preserving**: All processing happens within your GitHub Actions

## Use Cases

### 1. Duplicate Issue Prevention
When users create issues, they immediately see if similar issues already exist, reducing duplicate reports and consolidating discussions.

### 2. Related PR Discovery
Pull request authors can quickly identify related PRs that might conflict or complement their work.

### 3. Historical Context
Find closed issues that dealt with similar problems, providing valuable context and potential solutions.

### 4. Cross-Reference Documentation
Automatically link related discussions across your repository, creating a knowledge graph of related topics.

## Example Output

When similarity is detected, the bot posts a comment like this:

```markdown
## Potentially related issues

_The following issues have been identified as potentially related based on semantic similarity analysis:_

### Open Issues

- **[#123](link)**: Fix navigation menu overflow on mobile _(92% similar)_
- **[#115](link)**: Navigation bar cuts off on small screens _(87% similar)_

### Closed Issues

- **[#98](link)**: Responsive design issues in header _(85% similar)_

---
_This helps identify duplicate issues and related discussions. Powered by semantic similarity analysis from [contributor.info](https://contributor.info)_
```

## Configuration

### Basic Setup

The feature is configured through GitHub Actions workflow (`.github/workflows/similarity-check.yml`). No additional configuration files are needed for basic operation.

### Workflow Triggers

```yaml
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, edited]
  workflow_dispatch:  # Manual trigger with custom parameters
```

### Customizable Parameters

- **similarity_threshold**: Minimum similarity score (0.0-1.0, default: 0.85)
- **max_items**: Maximum items to process (default: 100)
- **item_type**: Focus on 'issues' or 'pull_request'

### Manual Triggering

You can manually run the similarity check through GitHub Actions:

1. Go to Actions tab
2. Select "Similarity Check" workflow
3. Click "Run workflow"
4. Optionally specify custom parameters

## Performance Considerations

### Processing Time

- **Small repos (<100 issues)**: ~10-30 seconds
- **Medium repos (100-1000 issues)**: ~30-60 seconds
- **Large repos (1000+ issues)**: ~1-2 minutes

### Resource Usage

- **Memory**: ~200-500MB for model loading
- **CPU**: Moderate usage during embedding generation
- **Network**: Only GitHub API calls (rate limited)

### Optimization Tips

1. **Limit scope**: Process only recent items for faster results
2. **Adjust threshold**: Higher thresholds (>0.9) find only very similar items
3. **Cache results**: Embeddings are cached to avoid recomputation

## Privacy and Security

### Data Handling

- **Local Processing**: All ML processing happens in GitHub Actions
- **No External APIs**: No data sent to third-party services
- **Respects Permissions**: Only accesses issues/PRs visible to the workflow
- **Temporary Storage**: Embeddings exist only during workflow execution

### Security Considerations

- Uses `GITHUB_TOKEN` with minimal required permissions
- Runs in isolated GitHub Actions environment
- No persistent storage of sensitive data
- Open source and auditable

## Troubleshooting

### Common Issues

#### No similar items found
- **Cause**: Threshold too high or too few items to compare
- **Solution**: Lower threshold or increase max_items

#### Workflow fails with timeout
- **Cause**: Processing too many items
- **Solution**: Reduce max_items or implement pagination

#### Incorrect similarity scores
- **Cause**: Very short or non-descriptive content
- **Solution**: Ensure issues have meaningful titles and descriptions

### Debug Mode

Enable debug output by setting workflow secret:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

## Advanced Usage

### Cross-Repository Search

For organizations, you can extend the workflow to search across multiple repositories:

```yaml
- name: Check similarity across org
  run: |
    for repo in repo1 repo2 repo3; do
      npx tsx scripts/actions-similarity.ts \
        --owner myorg \
        --repo $repo \
        --item-number ${{ github.event.issue.number }}
    done
```

### Custom Comment Templates

Modify the comment format in the workflow:

```javascript
// Customize the comment format
let comment = '## 🔍 Custom Header\n\n';
comment += `Your custom format here...`;
```

### Webhook Integration

Send results to external services:

```yaml
- name: Send to webhook
  if: steps.results.outputs.found_similar == 'true'
  run: |
    curl -X POST https://your-webhook.com/similarity \
      -H "Content-Type: application/json" \
      -d @similarity-results.json
```

## API Reference

### Output Format

The similarity check produces a JSON file (`similarity-results.json`):

```json
{
  "repository": "owner/repo",
  "processedItems": 100,
  "timestamp": "2024-01-15T10:30:00Z",
  "targetItem": {
    "number": 123,
    "title": "Issue title",
    "type": "issue"
  },
  "similarItems": [
    {
      "number": 115,
      "title": "Similar issue title",
      "state": "open",
      "html_url": "https://github.com/...",
      "type": "issue",
      "similarity": 0.92
    }
  ]
}
```

### Similarity Score Interpretation

- **0.95-1.0**: Nearly identical (likely duplicate)
- **0.85-0.95**: Very similar (strongly related)
- **0.75-0.85**: Moderately similar (potentially related)
- **0.65-0.75**: Somewhat similar (loose connection)
- **<0.65**: Not considered similar

## Contributing

### Adding New Features

1. Fork the repository
2. Modify `scripts/actions-similarity.ts`
3. Update the workflow file
4. Test with sample data
5. Submit a pull request

### Testing Locally

```bash
# Install dependencies
npm install

# Run similarity check locally
GITHUB_TOKEN=your_token npx tsx scripts/actions-similarity.ts \
  --owner octocat \
  --repo hello-world \
  --max-items 50 \
  --similarity-threshold 0.8
```

## Future Roadmap

- [ ] Multi-language support
- [ ] Custom embedding models
- [ ] Real-time similarity checking
- [ ] Web dashboard for analytics
- [ ] API endpoints for external tools
- [ ] Fine-tuning on repository-specific data

## Support

For issues or questions:
- Open an issue in [contributor.info](https://github.com/bdougie/contributor.info/issues)
- Check existing [similar issues](https://github.com/bdougie/contributor.info/issues?q=is%3Aissue+similarity)
- Review the [technical architecture](./similarity-architecture.md)

## License

This feature is part of the contributor.info project and follows the same [MIT License](../../LICENSE).