# Release Process

This document outlines the release process for contributor.info, including versioning, changelog generation, and deployment procedures.

## Overview

We use **Semantic Versioning** and **Conventional Commits** for automated releases:
- Commits trigger automated version bumps
- Changelogs are generated from commit messages
- Releases are deployed to production automatically

## Conventional Commits

### Commit Format (Warning Only)
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Note**: Conventional commit format is recommended but not strictly enforced. Non-conventional commits will show warnings but won't block PR merging.

### Types
- `feat`: New feature (minor version bump)
- `fix`: Bug fix (patch version bump)  
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code refactoring (no feature changes)
- `test`: Adding or updating tests
- `chore`: Build process, dependency updates
- `perf`: Performance improvements
- `ci`: CI/CD configuration changes

### Breaking Changes
Add `BREAKING CHANGE:` in the footer or `!` after type for major version bumps:
```
feat!: redesign user interface
feat(api)!: change response format

BREAKING CHANGE: API endpoints now return different data structure
```

## Major Release Triggers

### Method 1: Breaking Change Commits (Recommended)
Use conventional commits with breaking change indicators (see [Breaking Changes](#breaking-changes) section above for syntax details):

```bash
# Option A: Add ! after commit type
git commit -m "feat!: redesign dashboard with new component architecture"

# Option B: Include BREAKING CHANGE in commit footer
git commit -m "feat: redesign dashboard layout

BREAKING CHANGE: Dashboard components now require different props structure"

# Option C: Any commit type with breaking change
git commit -m "refactor!: restructure API response format

BREAKING CHANGE: All API endpoints now return data in new schema format"
```

### Method 2: Manual GitHub Actions Trigger
Force a major release via GitHub Actions:

1. Navigate to **Actions** tab in GitHub repository
2. Select **Release** workflow
3. Click **Run workflow** button
4. Select branch: `main`
5. Choose **Release type**: `major`
6. Click **Run workflow** to execute

### Method 3: Git Tag (Emergency Releases)
For urgent major releases:

```bash
# Create and push major version tag
git tag v2.0.0
git push origin v2.0.0

# Verify tag was created
git tag --list "v*" | tail -5
```

### Major Release Verification
After triggering a major release, verify:

```bash
# Check if release was created
gh release list --limit 3

# View release notes
gh release view v2.0.0

# Verify production deployment
curl -I https://contributor.info
```

### Common Major Release Scenarios
- **API Breaking Changes**: New endpoint structure, removed fields
- **Component Refactoring**: Changed prop interfaces, removed components  
- **Database Schema Changes**: New required fields, removed tables
- **Build System Updates**: New Node.js version, changed build output
- **Authentication Changes**: New login flow, removed auth methods

### Examples
```bash
# Patch release (1.0.0 � 1.0.1)
git commit -m "fix: resolve login redirect issue"

# Minor release (1.0.0 � 1.1.0)  
git commit -m "feat: add repository health insights"

# Major release (1.0.0 � 2.0.0)
git commit -m "feat!: redesign dashboard layout

BREAKING CHANGE: Dashboard components require new props"
```

### Local Commit Validation
Check your commit messages before pushing:
```bash
npm run check-commits
```

This script provides helpful feedback about conventional commit format but is non-blocking.

## Release Workflow

### 1. Development
- Create feature branches from `main`
- Use conventional commit messages
- Submit pull requests for review

### 2. PR Review & Merge
- **Automatic checks**: Tests, TypeScript, linting
- **Manual review**: Code quality, functionality
- **Squash and merge**: Use conventional commit format for merge message

### 3. Automated Release
When code is merged to `main`:
1. **Version calculation**: Based on conventional commits since last release
2. **Changelog generation**: From commit messages and PR data
3. **Git tag creation**: Semantic version tag
4. **GitHub release**: With generated changelog
5. **Production deployment**: To Netlify

## Manual Release Process

### Emergency Releases
For critical hotfixes that need immediate release:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-security-fix

# 2. Make the fix with conventional commit
git commit -m "fix: patch security vulnerability in auth"

# 3. Push and create PR
git push origin hotfix/critical-security-fix

# 4. Merge PR - triggers automatic release
```

### Pre-releases
For testing releases before production:

```bash
# 1. Create pre-release tag
git tag v1.2.0-beta.1

# 2. Push tag
git push origin v1.2.0-beta.1

# 3. Manual GitHub release with "pre-release" flag
```

## Version Management

### Current Version
Check current version:
```bash
# From package.json
npm version

# From git tags
git describe --tags --abbrev=0

# From GitHub releases
gh release list --limit 1
```

### Version Bumping
Versions are automatically calculated by semantic-release based on:
- **Patch** (x.x.1): `fix:` commits
- **Minor** (x.1.x): `feat:` commits  
- **Major** (1.x.x): `BREAKING CHANGE:` or `feat!:` commits

## Changelog

### Automatic Generation
Changelogs are automatically generated including:
- **Breaking Changes**: Major version updates
- **Features**: New functionality added
- **Bug Fixes**: Issues resolved
- **Performance**: Performance improvements
- **Dependencies**: Dependency updates

### Format Example
```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Features
- Add repository health insights with AI analysis
- Implement responsive insights sidebar
- Add LLM-powered recommendations

### Bug Fixes  
- Fix login redirect loop on expired tokens
- Resolve mobile layout issues in contributor cards

### Performance
- Add caching layer for API responses
- Optimize bundle size with code splitting
```

## Deployment

### Production Deployment
Automatically triggered on releases:
1. **Build**: `npm run build` with optimizations
2. **Tests**: Full test suite execution
3. **Deploy**: To Netlify production environment
4. **Verification**: Automatic health checks

### Environment Variables
Required for production deployment:
```bash
VITE_GITHUB_CLIENT_ID=your_github_app_id
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key  # Optional for LLM features
```

### Rollback Procedure
If issues are detected post-deployment:

```bash
# 1. Identify last known good release
gh release list

# 2. Redeploy previous version via Netlify dashboard
# Or revert the problematic commit:
git revert <commit-hash>
git push origin main  # Triggers new release
```

## Monitoring & Verification

### Post-Release Checks
After each release:
- [ ] Application loads successfully
- [ ] Authentication flow works
- [ ] Repository search functions
- [ ] GitHub API integration operational
- [ ] No console errors in production

### Health Monitoring
- **Netlify**: Deployment status and performance metrics
- **GitHub**: API rate limit monitoring
- **Supabase**: Database performance and health
- **OpenAI**: API usage and cost tracking (if enabled)

## Troubleshooting

### Common Issues

**Release Failed**
- Check GitHub Actions logs
- Verify conventional commit format
- Ensure all tests pass

**Deployment Failed**
- Check Netlify build logs
- Verify environment variables
- Test build locally: `npm run build`

**Missing Changelog**
- Ensure commits follow conventional format
- Check semantic-release configuration
- Verify GitHub token permissions

**Major Release Issues**
- **No major version bump**: Ensure `BREAKING CHANGE:` or `!` syntax is correct
- **Release workflow not triggered**: Verify push is to `main` branch
- **Manual trigger failed**: Check repository permissions and workflow dispatch settings
- **Tag creation failed**: Ensure no duplicate tags exist and push permissions are granted

### Emergency Contacts
- **Infrastructure**: Netlify support
- **Database**: Supabase support  
- **Repository**: GitHub support
- **LLM Services**: OpenAI support

## Best Practices

### Commit Messages
- Use clear, descriptive messages
- Include issue numbers when applicable
- Follow conventional commit format consistently

### Release Notes
- Highlight user-facing changes
- Include migration instructions for breaking changes
- Link to relevant documentation

### Testing
- Test locally before committing
- Verify all automated tests pass
- Test deployment in preview environment

---

For questions about the release process, see [CONTRIBUTING.md](../CONTRIBUTING.md) or open an issue.