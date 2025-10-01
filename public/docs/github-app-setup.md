# GitHub App Installation Guide

Enable real-time similarity search and enhanced repository insights by installing the contributor.info GitHub App. This guide walks you through installation, benefits, and troubleshooting.

## Overview

The contributor.info GitHub App unlocks advanced features powered by webhooks, enabling instant analysis and AI-powered insights without rate limits or manual data refresh.

## Benefits

### 🚀 **10x Faster Similarity Searches**
- **Before**: 2-3 second wait for on-demand API calls
- **After**: <500ms using pre-computed embeddings
- Instant results as you browse PRs and issues

### 📊 **100% Data Coverage**
- **Before**: Limited to 100 most recent issues per search
- **After**: All issues and PRs analyzed automatically
- Complete historical context for better matching

### 🧠 **AI-Powered Semantic Understanding**
- Embeddings generated using advanced language models
- Understands context, not just keywords
- Finds truly related issues, even with different wording

### ⚡ **Real-time Updates**
- New issues processed immediately as they're created
- PRs automatically analyzed for similar issues
- Background processing keeps data fresh

### 🛡️ **No Rate Limits**
- Uses webhooks instead of repeated API calls
- More reliable and consistent performance
- Scales effortlessly with repository activity

## Installation

### Step 1: Navigate to Installation Page

Click the **"Install GitHub App"** button on any repository page, or visit directly:

```
https://github.com/apps/contributor-info/installations/new
```

### Step 2: Select Repositories

Choose which repositories to connect:

- **All repositories**: Enable for your entire organization or personal account
- **Select repositories**: Choose specific repositories to analyze

**Recommendation**: Start with 1-2 repositories to test, then expand based on value.

### Step 3: Approve Permissions

The app requests these permissions:

| Permission | Access Level | Purpose |
|------------|-------------|---------|
| **Issues** | Read & Write | Find similar issues, post analysis |
| **Pull Requests** | Read & Write | Analyze PRs, add similarity comments |
| **Contents** | Read | Access repository metadata |
| **Metadata** | Read | Repository information |

All permissions follow the principle of least privilege.

### Step 4: Complete Installation

After approval:

1. ✅ **Installation confirmed** - You'll see a success message
2. 🔄 **Background processing begins** - Historical data is processed
3. 📊 **Progress tracking** - Real-time updates on processing status
4. ✨ **Features activated** - Similarity search is now live

## What Happens After Installation

### Immediate Processing

The app begins processing your repository's historical data:

1. **Issue Discovery**: Scans all existing issues
2. **Embedding Generation**: Creates semantic embeddings (AI understanding)
3. **Database Storage**: Saves embeddings for instant retrieval
4. **Similarity Index**: Builds searchable similarity index

**Processing Time**:
- Small repos (<100 issues): 1-2 minutes
- Medium repos (100-500 issues): 5-10 minutes
- Large repos (500+ issues): 15-30 minutes

### Real-time Updates

Once processing completes, new activity triggers instant analysis:

- **New Issues**: Embeddings generated within seconds
- **New PRs**: Similarity search runs automatically
- **Updates**: Changes to issues/PRs refresh embeddings
- **Comments**: Similarity results posted as PR comments (when enabled)

## Using the GitHub App

### Similarity Search

After installation, similarity search works automatically:

1. **Open any PR** in your repository
2. **Scroll to "Similar Issues"** section
3. **View AI-powered matches** with similarity scores
4. **Click to explore** related issues

No manual action required - it just works!

### Repository Page Integration

The repository page shows installation status:

- **✅ Installed**: Green badge confirms active GitHub App
- **Install**: Button appears if not yet installed (admin only)
- **Settings**: Manage installation via GitHub settings

### Managing Installations

To update or remove the app:

1. Visit [GitHub Settings → Installations](https://github.com/settings/installations)
2. Find "contributor.info" in your installed apps
3. Configure repository access or suspend installation

## Permissions & Privacy

### Data Usage

The GitHub App only processes public repository data:

- **Issues**: Titles, descriptions, labels, status
- **Pull Requests**: Titles, descriptions, linked issues
- **Metadata**: Repository name, owner, basic settings

**Private Data Protection**:
- No access to code contents
- No access to private repositories (unless explicitly granted)
- No personal information collected beyond GitHub profile

### Webhook Security

All webhooks use industry-standard security:

- **HMAC-SHA256 signatures** verify authenticity
- **Short-lived tokens** expire within 1 hour
- **Fine-grained permissions** limited to necessary access
- **Isolated execution** in secure environment

## Troubleshooting

### Installation Status Not Showing

**Problem**: The repository page doesn't show installation status

**Solutions**:
1. Refresh the page (browser cache may be stale)
2. Verify you have admin/maintain permissions on the repository
3. Check [GitHub App settings](https://github.com/settings/installations) to confirm installation

### Similarity Search Still Empty

**Problem**: No similar issues appear after installation

**Solutions**:
1. **Wait for processing**: Large repos take 15-30 minutes for initial processing
2. **Check repository has issues**: Need at least 3-5 issues for meaningful results
3. **Verify installation**: Ensure the app has access to this specific repository

### Processing Taking Too Long

**Problem**: Historical data processing seems stuck

**Solutions**:
1. **Check repository size**: 1000+ issues may take 30-60 minutes
2. **Refresh status**: The progress indicator updates every 30 seconds
3. **Contact support**: If processing exceeds 2 hours, [open an issue](https://github.com/bdougie/contributor.info/issues/new)

### Permission Errors

**Problem**: App shows "insufficient permissions" errors

**Solutions**:
1. **Re-install the app**: Go to [installations page](https://github.com/settings/installations) and reinstall
2. **Update permissions**: The app may need updated permissions after a feature release
3. **Check organization settings**: Org admins may need to approve app installation

## Comparing GitHub App vs. Manual Search

### Without GitHub App
- ❌ Slower searches (2-3 seconds per query)
- ❌ Limited to recent 100 issues
- ❌ API rate limit concerns
- ❌ Manual refresh required
- ❌ No real-time updates

### With GitHub App
- ✅ Lightning-fast searches (<500ms)
- ✅ 100% issue coverage
- ✅ No rate limits
- ✅ Automatic background updates
- ✅ Real-time similarity analysis

## Frequently Asked Questions

### Do I need to be a repository admin?

**Yes**, only repository admins or users with "maintain" permissions can install GitHub Apps. This is a GitHub security requirement.

### Can I install it on multiple repositories?

**Yes**, you can install on all repositories in your account or select specific ones. Installation is per-account, not per-repository.

### Does it work on private repositories?

**Yes**, if you grant access during installation. The same privacy and security protections apply.

### Can I uninstall it later?

**Yes**, you can uninstall anytime from [GitHub settings](https://github.com/settings/installations). Your data will be removed according to our [data retention policy](/privacy).

### Will it work on forked PRs?

**Yes**, the GitHub App is specifically designed to work safely with fork PRs, unlike GitHub Actions workflows that expose secrets.

### Does it cost anything?

**No**, the GitHub App is free to use for all repositories. There are no hidden costs or premium tiers.

## Next Steps

After installation:

1. ✅ **Verify installation** - Check repository page for green "Installed" badge
2. 📊 **Monitor processing** - Watch the progress indicator
3. 🔍 **Test similarity search** - Open a PR and check for similar issues
4. 🚀 **Explore features** - Browse the [features documentation](/docs) for more capabilities

## Related Documentation

- [Similarity Search Architecture](/docs/similarity-architecture) - Technical details
- [Privacy Policy](/privacy) - Data handling and retention
- [GitHub App Fork PR Checks](https://github.com/bdougie/contributor.info/blob/main/docs/features/github-app-fork-pr-checks.md) - Advanced check runs
- [Issue #833](https://github.com/bdougie/contributor.info/issues/833) - Implementation details

## Support

Need help? We're here for you:

- 📖 **Documentation**: Browse [all docs](/docs)
- 🐛 **Bug Reports**: [Open an issue](https://github.com/bdougie/contributor.info/issues/new)
- 💬 **Questions**: Join [discussions](https://github.com/bdougie/contributor.info/discussions)
- 📧 **Contact**: hello@contributor.info

---

**Pro Tip**: Install the GitHub App on your most active repositories first to see the biggest impact on similarity search performance!
