# Continue Agent - AI Code Review Setup Guide

Get intelligent, context-aware code reviews powered by Continue AI on your pull requests.

## 🚀 Quick Start

After installing the Continue Agent GitHub App, follow these steps to enable AI reviews:

### 1. Create Your Continue Account & Assistant

1. **Sign up** at [Continue Hub](https://hub.continue.dev)
2. **Create an Assistant** following the [official guide](https://docs.continue.dev/hub/assistants/create-an-assistant)
3. Configure your assistant:
   - **Name**: `review-bot` (or your preference)
   - **Model**: GPT-4 or Claude (recommended for code reviews)
   - **System Prompt**: 
     ```
     You are a senior software engineer providing constructive code reviews.
     Focus on bugs, security issues, performance, and maintainability.
     Be specific and actionable in your feedback.
     ```
   - **Temperature**: 0.3 (for consistent reviews)
4. Save and note your assistant path (format: `your-username/review-bot`)

### 2. Get Your API Key

1. In [Continue Hub](https://hub.continue.dev), go to your account settings
2. Navigate to **API Keys** section
3. Click **"Create New API Key"**
4. Name it (e.g., "GitHub Reviews") and copy the generated key
5. Save this key securely - you'll need it for GitHub Secrets

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
          continue-org: 'your-username'  # Your Continue Hub username
          continue-config: 'your-username/review-bot'  # Your assistant path from Step 1
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

### Rate Limits & Pricing

- Check your usage in [Continue Hub](https://hub.continue.dev) dashboard
- Monitor API key usage in your account settings
- Free tier includes limited API calls
- Pro tier for higher limits - check current pricing in Hub

### Using Different Models

Update your assistant configuration in [Continue Hub](https://hub.continue.dev):

1. Navigate to your assistant settings
2. Change the model selection:
   - **GPT-4 Turbo**: Best for comprehensive reviews
   - **Claude 3 Opus**: Excellent for code understanding
   - **Llama 3**: Open-source alternative
   - **Mistral**: Fast and efficient
3. Save changes - they apply immediately

## 🔗 Resources

- **Continue Hub**: [hub.continue.dev](https://hub.continue.dev)
- **Create Assistant Guide**: [docs.continue.dev/hub/assistants/create-an-assistant](https://docs.continue.dev/hub/assistants/create-an-assistant)
- **Continue Documentation**: [docs.continue.dev](https://docs.continue.dev)
- **API Reference**: [docs.continue.dev/api](https://docs.continue.dev/api)
- **Support**: [Discord](https://discord.gg/continue) | [GitHub Issues](https://github.com/continuedev/continue/issues)

## 💡 Tips

1. **Start with conservative settings** - Use lower temperature (0.2-0.4) for consistent reviews
2. **Iterate on your prompt** - Refine your assistant's system prompt based on the reviews you receive
3. **Use rules for standards** - Codify your team's standards in `.continue/rules/`
4. **Monitor usage** - Check your dashboard regularly to avoid hitting limits
5. **Test locally first** - Use [Continue CLI](https://docs.continue.dev/cli) to test your configuration

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
- Check your usage in [Continue Hub](https://hub.continue.dev) account settings
- Consider upgrading your plan
- Implement review filtering (only critical files)

---

Need help? Join our [Discord community](https://discord.gg/continue) or open an issue!