# Installing the contributor.info GitHub App

## Quick Installation

1. **Install the App**: Visit https://github.com/apps/contributor-info and click "Install"

2. **Select Repositories**: Choose which repositories to enable:
   - **All repositories**: Get insights on all your repos
   - **Selected repositories**: Choose specific repos

3. **That's it!** The app will automatically comment on new pull requests with:
   - Contributor profiles and expertise
   - Smart reviewer suggestions
   - Related issues and context

## What You'll See

When someone opens a PR, you'll see a comment like this:

```markdown
## 🎯 Contributor Insights

**@username** has contributed:
- 📊 23 PRs (19 merged, 87% first-time approval rate)
- 🏆 Primary expertise: frontend, auth, API
- 🕐 Active hours: 9am-5pm PST
- 🔄 Last active: 2 hours ago

### 🔍 Related Issues & Context
**This PR implements:**
- 🎯 **#234** "Add OAuth2 support"

### 💡 Suggested Reviewers
- **@alice-dev** - Owns 67% of modified files (avg response: 4hr)
- **@bob-reviewer** - Expert in auth flows
```

## Configuration

### Default Settings
- ✅ Comments on all non-draft PRs
- ✅ Includes issue context
- ✅ Suggests up to 3 reviewers
- ✅ Shows up to 5 related issues

### Coming Soon
- Custom settings per repository
- Slack/Teams notifications
- Private repository support (Premium)

## Troubleshooting

**Not seeing comments?**
- Check if the PR is a draft (drafts are skipped)
- Verify the app is installed on the repository
- Look for any error messages in the PR

**Want to disable for specific repos?**
- Go to https://github.com/settings/installations
- Click "Configure" next to contributor.info
- Adjust repository access

## Support

- **Issues**: https://github.com/contributor-info/contributor.info/issues
- **Documentation**: https://contributor.info/docs
- **Email**: support@contributor.info

## Privacy

The app only accesses:
- Public repository data
- PR and issue information
- Basic contributor profiles

No code is stored. All data is processed in real-time.