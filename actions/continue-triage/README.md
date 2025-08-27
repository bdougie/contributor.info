# Continue Triage Action

Automated issue triage using Continue AI with intelligent labeling and SCQA-structured feedback.

## Features

- 🤖 **AI-Powered Analysis**: Uses Continue AI to analyze issue content
- 🏷️ **Automatic Labeling**: Applies relevant labels based on content analysis
- 📋 **SCQA Framework**: Provides structured feedback (Situation, Complication, Question, Answer)
- 🔒 **Secure**: API keys handled via environment variables with masking
- 🚦 **Rate Limiting Protection**: Prevents hitting GitHub API limits
- 🧪 **Dry-Run Mode**: Test without applying changes
- ⚙️ **Configurable**: Customize label mappings and behavior

## Usage

### Workflow Configuration

```yaml
name: Issue Triage
on:
  issues:
    types: [opened, edited]
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Issue number to triage'
        required: false
        type: string
      dry_run:
        description: 'Run in dry-run mode'
        required: false
        type: boolean
        default: false

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.CONTINUE_APP_ID }}
          private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
      
      - name: Run Continue Triage
        uses: ./actions/continue-triage
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'continuedev'
          continue-config: 'continuedev/review-bot'
          issue-number: ${{ github.event.inputs.issue_number || github.event.issue.number }}
          dry-run: ${{ github.event.inputs.dry_run || false }}
```

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | - |
| `continue-api-key` | API key for Continue service | Yes | - |
| `continue-org` | Continue organization/username | Yes | - |
| `continue-config` | Continue assistant path | Yes | `continuedev/review-bot` |
| `issue-number` | Issue number to triage | Yes | - |
| `dry-run` | Run without applying changes | No | `false` |

## Configuration

### Label Mapping (`triage-config.yml`)

The action uses a configuration file to define label mapping rules:

```yaml
labelMappings:
  type:
    bug:
      patterns: ['bug', 'error', 'broken']
      description: 'Issue describes something not working'
    enhancement:
      patterns: ['feature', 'add', 'implement']
      description: 'Issue requests new functionality'

  area:
    frontend:
      patterns: ['ui', 'frontend', 'component', 'react']
      description: 'Issue relates to UI/frontend'
    database:
      patterns: ['database', 'supabase', 'sql']
      description: 'Issue relates to database operations'

tierRules:
  'tier 1':
    patterns: ['critical', 'urgent', 'blocker']
    description: 'Major features and critical issues'

behavior:
  skipIfHasLabels: ['triaged', 'wontfix']
  maxLabelsPerCategory: 2
  confidenceThreshold: 0.6
```

### Customizing SCQA Prompts

You can customize the SCQA analysis format in `triage-config.yml`:

```yaml
scqaPrompt:
  situationPrefix: 'The issue'
  complicationPrefix: 'The challenge is'
  questionPrefix: 'The core question is'
  answerPrefix: 'The recommended approach is'
```

## Dry-Run Mode

Test the action without making changes:

```bash
gh workflow run continue-triage.yml -f issue_number=123 -f dry_run=true
```

In dry-run mode:
- No labels are added or removed
- No comments are posted
- Analysis results are logged to console
- Comment includes "(DRY RUN)" indicator

## Rate Limiting

The action includes built-in rate limiting protection:

- Checks GitHub API rate limit before proceeding
- Fails gracefully if rate limit is below 10 requests
- Shows remaining requests in logs
- Displays reset time if limit is exceeded

## Security

- API keys are passed via environment variables
- Sensitive values are masked in logs using `core.setSecret()`
- GitHub token and Continue API key are never exposed

## Metrics & Monitoring

Future features (planned):
- Track triage accuracy over time
- Measure label application success rate
- Monitor Continue API response times
- Generate triage performance reports

## Development

### Project Structure

```
actions/continue-triage/
├── index.ts              # Main action logic
├── action.yml            # Action metadata
├── package.json          # Dependencies
├── triage-config.yml     # Label mapping configuration
├── README.md            # This file
└── __tests__/           # Test files (coming soon)
```

### Testing

Run tests locally:

```bash
cd actions/continue-triage
npm install
npm test
```

### Building

Compile TypeScript:

```bash
npm run build
```

## Troubleshooting

### Common Issues

1. **"Continue CLI not found"**
   - Ensure `@continuedev/cli` is installed
   - Check Node.js version (requires v20+)

2. **"GitHub API rate limit exceeded"**
   - Wait for rate limit reset
   - Use GitHub App authentication for higher limits

3. **"No labels applied"**
   - Check if labels exist in repository
   - Verify label patterns in config
   - Review confidence threshold

4. **"Continue API failed"**
   - Verify API key is correct
   - Check Continue service status
   - Fallback analysis will be used automatically

## Contributing

1. Update `triage-config.yml` for new label patterns
2. Modify `index.ts` for logic changes
3. Add tests for new features
4. Update this README with changes

## License

See repository LICENSE file.