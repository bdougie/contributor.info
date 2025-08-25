# Continue Agent - AI Code Review Setup Guide

Get intelligent, context-aware code reviews powered by Continue AI on your pull requests.

## 🚀 Quick Start

After installing the Continue Agent GitHub App, follow these steps to enable AI reviews:

### 1. Get Your Continue API Key

1. **Sign up for Continue** at [continue.dev](https://continue.dev)
2. Navigate to your [API Keys page](https://continue.dev/api-keys)
3. Click **"Create New API Key"** and copy the generated key
4. Save this key securely - you'll need it for the GitHub Secret

### 2. Create Your Review Assistant

1. Go to the [Continue Hub](https://hub.continue.dev)
2. Click **"Create Assistant"** or **"New Configuration"**
3. Choose a base model (recommended: GPT-4 or Claude for best results)
4. Name your assistant (e.g., `review-bot`)
5. Configure the assistant settings:
   ```yaml
   name: review-bot
   model: gpt-4  # or claude-3-opus
   temperature: 0.3  # Lower for more consistent reviews
   system_prompt: |
     You are a senior software engineer providing constructive code reviews.
     Focus on bugs, security issues, performance, and maintainability.
   ```
6. Save and note your configuration path (format: `your-org/review-bot`)

### 3. Add Repository Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add the following secret:
   - **Name:** `CONTINUE_API_KEY`
   - **Value:** Your Continue API key from Step 1

### 4. Create the Workflow

Create `.github/workflows/continue-review.yml` in your repository:

```yaml
name: Continue AI Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       contains(github.event.comment.body, '@continue-agent'))
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Continue AI Review
        uses: continuedev/continue-review-action@v1  # Or your custom action
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'your-org'  # Your Continue organization
          continue-config: 'your-org/review-bot'  # Your assistant path
```

### 5. (Optional) Add Project-Specific Rules

Create custom review rules in `.continue/rules/`:

```markdown
# .continue/rules/no-console-logs.md
---
globs: "**/*.{js,ts}"
description: "No console.log in production code"
---

Production code should not contain console.log statements.
Use proper logging libraries instead.
```

## 📝 Usage

### Automatic Reviews
Every new PR and update will automatically trigger a review.

### Manual Trigger
Comment on any PR with:
```
@continue-agent review this
@continue-agent check for security issues
@continue-agent suggest performance improvements
```

## 🔧 Advanced Configuration

### Custom Models

For different AI models, update your Continue Hub configuration:

- **GPT-4 Turbo**: Best for comprehensive reviews
- **Claude 3 Opus**: Excellent for code understanding
- **Llama 3**: Open-source alternative
- **Custom models**: Deploy your fine-tuned models

### Rate Limits & Pricing

- Check your [Continue Dashboard](https://continue.dev/dashboard) for usage
- Free tier: 100 reviews/month
- Pro tier: Unlimited reviews - [View Pricing](https://continue.dev/pricing)

### Self-Hosted Option

Deploy your own Continue instance:

1. Clone the [Continue Server repo](https://github.com/continuedev/continue-server)
2. Follow the [self-hosting guide](https://continue.dev/docs/self-hosting)
3. Update your workflow to use your custom endpoint:
   ```yaml
   continue-endpoint: 'https://your-continue-instance.com'
   ```

## 🔗 Resources

- **Continue Documentation**: [continue.dev/docs](https://continue.dev/docs)
- **API Reference**: [continue.dev/api](https://continue.dev/api)
- **Continue Hub**: [hub.continue.dev](https://hub.continue.dev)
- **Support**: [Discord](https://discord.gg/continue) | [GitHub Issues](https://github.com/continuedev/continue/issues)

## 💡 Tips

1. **Start with conservative settings** - Use lower temperature (0.2-0.4) for consistent reviews
2. **Iterate on your prompt** - Refine your assistant's system prompt based on the reviews you receive
3. **Use rules for standards** - Codify your team's standards in `.continue/rules/`
4. **Monitor usage** - Check your dashboard regularly to avoid hitting limits
5. **Test locally first** - Use [Continue CLI](https://continue.dev/docs/cli) to test your configuration

## 🆘 Troubleshooting

### Reviews not appearing?
- Verify `CONTINUE_API_KEY` is set correctly
- Check workflow runs in Actions tab for errors
- Ensure your API key has sufficient credits

### Generic or unhelpful reviews?
- Upgrade to a more capable model (GPT-4 or Claude)
- Add specific rules in `.continue/rules/`
- Refine your assistant's system prompt

### Rate limit errors?
- Check your usage at [continue.dev/dashboard](https://continue.dev/dashboard)
- Consider upgrading to Pro tier
- Implement review filtering (only critical files)

---

Need help? Join our [Discord community](https://discord.gg/continue) or open an issue!