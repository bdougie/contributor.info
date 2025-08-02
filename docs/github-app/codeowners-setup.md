# CODEOWNERS Setup Guide

## Overview

CODEOWNERS is a powerful GitHub feature that defines who owns specific parts of your codebase. When combined with the contributor.info GitHub App, it becomes the foundation for intelligent reviewer suggestions and automated code review assignments.

This guide will help you create, optimize, and maintain a CODEOWNERS file that maximizes the effectiveness of automated reviewer suggestions.

## What is CODEOWNERS?

CODEOWNERS is a text file that uses gitignore-style patterns to define ownership rules for your repository. When files matching these patterns are modified in a pull request, the specified owners are automatically suggested as reviewers.

### Key Benefits
- **Automated Review Assignment**: Ensures the right people review relevant changes
- **Knowledge Distribution**: Helps team members understand code ownership
- **Faster Reviews**: Routes PRs to appropriate reviewers immediately
- **Quality Assurance**: Ensures domain experts review critical changes

## File Location and Format

### Supported Locations
1. **`.github/CODEOWNERS`** (recommended)
2. **`CODEOWNERS`** (repository root)
3. **`docs/CODEOWNERS`** (less common)

The contributor.info app checks these locations in order and uses the first file found.

### File Format
CODEOWNERS uses a simple text format with patterns and owners:

```
# Comments start with #
pattern @owner1 @owner2

# Examples:
* @admin-team                    # All files owned by admin team
*.js @frontend-team              # JavaScript files owned by frontend team
/api/ @backend-team @alice       # API directory owned by backend team and alice
README.md @docs-team             # Specific file owned by docs team
```

## Pattern Syntax

### Basic Patterns

**Global Ownership**
```
# Everyone on admin team reviews all changes
* @admin-team
```

**File Extensions**
```
# Frontend team owns all JavaScript and TypeScript files
*.js @frontend-team
*.ts @frontend-team
*.tsx @frontend-team

# Database team owns all SQL files
*.sql @database-team
```

**Directory Ownership**
```
# Backend team owns everything in the api directory
/api/ @backend-team

# Frontend team owns the entire frontend directory
/frontend/ @frontend-team

# Security team owns authentication-related code
/src/auth/ @security-team
```

**Specific Files**
```
# Documentation team owns specific documentation files
README.md @docs-team
CONTRIBUTING.md @docs-team
/docs/ @docs-team

# DevOps team owns infrastructure files
Dockerfile @devops-team
docker-compose.yml @devops-team
.github/workflows/ @devops-team
```

### Advanced Patterns

**Nested Ownership**
```
# Default ownership for entire src directory
/src/ @dev-team

# More specific ownership overrides general ownership
/src/auth/ @security-team
/src/payments/ @payments-team @security-team
/src/admin/ @admin-team @security-team
```

**Multi-level Ownership**
```
# Multiple teams can own the same files
/src/shared/ @frontend-team @backend-team
*.config.js @devops-team @senior-devs
```

**Exclusion Patterns**
```
# Own everything except tests
/src/ @dev-team
!/src/**/*.test.js

# Own all configs except local ones
*.config.js @devops-team
!*.local.config.js
```

## Owner Types

### Individual Users
```
# Specific GitHub users
/auth/ @alice @bob
README.md @charlie
```

### Teams
```
# GitHub organization teams
/frontend/ @myorg/frontend-team
/backend/ @myorg/backend-team
*.sql @myorg/database-team
```

### Mixed Ownership
```
# Combine individual users and teams
/critical-module/ @myorg/senior-devs @alice @bob
/security/ @myorg/security-team @security-lead
```

## Best Practices

### Start Simple
Begin with broad patterns and refine over time:

```
# Initial simple setup
* @core-team
/docs/ @docs-team
*.sql @database-admin
```

### Use Hierarchical Ownership
Structure ownership from general to specific:

```
# General ownership
* @dev-team

# More specific ownership (overrides general)
/frontend/ @frontend-team
/backend/ @backend-team

# Very specific ownership (overrides specific)
/frontend/auth/ @frontend-team @security-team
/backend/payments/ @backend-team @payments-team
```

### Balance Coverage and Specificity
Avoid too many owners per file:

```
# Good: Clear ownership
/auth/ @security-team @auth-lead

# Avoid: Too many owners can cause confusion
/auth/ @security-team @auth-lead @senior-dev1 @senior-dev2 @manager
```

### Document Your Decisions
Use comments to explain ownership decisions:

```
# Security-sensitive areas require security team review
/auth/ @security-team
/payments/ @payments-team @security-team

# Infrastructure changes need DevOps approval
Dockerfile @devops-team
.github/workflows/ @devops-team

# Public API changes need architect review
/api/public/ @backend-team @architect
```

## Common CODEOWNERS Patterns

### Frontend Applications
```
# Global fallback
* @dev-team

# Frontend code
/src/ @frontend-team
/public/ @frontend-team
*.tsx @frontend-team
*.scss @frontend-team

# Configuration
package.json @frontend-team @devops-team
webpack.config.js @frontend-team @devops-team

# Testing
*.test.tsx @frontend-team @qa-team

# Documentation
README.md @docs-team
/docs/ @docs-team
```

### Backend APIs
```
# Default ownership
* @backend-team

# API routes
/routes/ @backend-team
/middleware/ @backend-team

# Database
/migrations/ @database-team @backend-team
*.sql @database-team

# Authentication & Security
/auth/ @security-team @backend-team
/security/ @security-team

# Configuration
config/ @devops-team @backend-team
```

### Full-Stack Monorepo
```
# Global fallback
* @dev-team

# Frontend
/apps/web/ @frontend-team
/packages/ui/ @frontend-team

# Backend
/apps/api/ @backend-team
/packages/database/ @backend-team @database-team

# Shared
/packages/types/ @frontend-team @backend-team
/packages/utils/ @frontend-team @backend-team

# Infrastructure
/infrastructure/ @devops-team
docker-compose.yml @devops-team
.github/workflows/ @devops-team

# Documentation
*.md @docs-team
/docs/ @docs-team
```

### Open Source Project
```
# Maintainers review everything by default
* @maintainers

# Core features
/src/core/ @core-maintainers
/src/plugins/ @plugin-maintainers

# Documentation
README.md @docs-maintainers
/docs/ @docs-maintainers
CONTRIBUTING.md @core-maintainers

# CI/CD
.github/ @devops-maintainers
```

## Integration with contributor.info

### How the App Uses CODEOWNERS

1. **Pattern Matching**: When a PR is opened, the app analyzes changed files and matches them against CODEOWNERS patterns
2. **Ownership Calculation**: Calculates what percentage of changed files each owner is responsible for
3. **Reviewer Scoring**: Gives higher scores to owners with higher ownership percentages
4. **Smart Suggestions**: Combines CODEOWNERS data with git history and expertise analysis

### Optimization for Better Suggestions

**Be Specific**
```
# Better: Specific patterns give more accurate suggestions
/src/auth/login.ts @auth-team
/src/auth/password.ts @auth-team @security-team

# Less effective: Too broad
/src/ @everyone
```

**Use Active Contributors**
```
# Good: Active team members who can actually review
/frontend/ @alice @bob @frontend-team

# Avoid: Inactive or unavailable reviewers
/frontend/ @former-employee @on-leave-person
```

**Balance Team and Individual Ownership**
```
# Good: Mix of team and individual ownership
/critical-path/ @security-team @security-lead
/auth/ @backend-team @auth-expert

# Avoid: Only teams (may be too broad) or only individuals (may create bottlenecks)
```

## Testing Your CODEOWNERS File

### GitHub's Built-in Validation
1. Navigate to your repository on GitHub
2. Go to Settings > General
3. Scroll to "Pull Requests" section
4. Check "Require review from CODEOWNERS" (if desired)

### contributor.info Integration Test
1. Create a test pull request that modifies files covered by your CODEOWNERS
2. Check the automated comment for reviewer suggestions
3. Verify that the suggested reviewers match your CODEOWNERS configuration

### Manual Validation
Use GitHub's API to test pattern matching:
```bash
# Check which files match specific patterns
curl -H "Authorization: token YOUR_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/contents/CODEOWNERS"
```

## Common Issues and Solutions

### Problem: No Reviewer Suggestions
**Symptoms**: The app posts comments but doesn't suggest reviewers

**Solutions**:
- Verify CODEOWNERS file exists in correct location
- Check file syntax (no trailing spaces, proper @ symbols)
- Ensure referenced users/teams exist and are accessible
- Test with a simple pattern like `* @username`

### Problem: Wrong Reviewers Suggested
**Symptoms**: Inappropriate or inactive users are suggested

**Solutions**:
- Update CODEOWNERS to reflect current team structure
- Remove inactive users from ownership patterns
- Use `.contributor` file to exclude specific users
- Make patterns more specific to reduce false matches

### Problem: Too Many/Too Few Suggestions
**Symptoms**: Either overwhelming number of suggestions or too few

**Solutions**:
- Adjust ownership patterns to be more/less specific
- Use `.contributor` file to set `max_suggestions` limit
- Balance individual and team ownership
- Review ownership overlap between patterns

### Problem: Patterns Not Matching Files
**Symptoms**: Files that should match CODEOWNERS patterns don't trigger suggestions

**Solutions**:
- Check pattern syntax (use `/` for directories, `*` for wildcards)
- Test patterns with actual file paths from your repository
- Remember that later patterns override earlier ones
- Use online gitignore pattern testers to validate syntax

## Maintenance and Updates

### Regular Review Schedule
- **Monthly**: Review recent PRs to see if reviewer suggestions are accurate
- **Quarterly**: Update ownership patterns based on team changes
- **After Reorganizations**: Update all ownership patterns when team structure changes

### Monitoring Effectiveness
Track these metrics to optimize your CODEOWNERS:
- **Suggestion Accuracy**: Are suggested reviewers appropriate?
- **Review Speed**: Are PRs getting reviewed faster?
- **Coverage**: Are all critical areas covered by ownership patterns?
- **Balance**: Is review load distributed evenly?

### Updating Process
1. **Propose Changes**: Create PR with CODEOWNERS updates
2. **Team Review**: Have current owners review ownership changes
3. **Test Changes**: Verify new patterns work with test PRs
4. **Document Changes**: Update team documentation about ownership
5. **Monitor Impact**: Watch for improvements in review process

## Advanced Configuration

### Repository-Specific Settings
Use the `.contributor` file to customize how CODEOWNERS is used:

```yaml
version: 1
reviewer_settings:
  max_suggestions: 3        # Limit reviewer suggestions
  min_ownership: 15         # Only suggest owners of 15%+ of files
  response_time_weight: 0.3 # Prefer faster reviewers
```

### Integration with GitHub Features
- **Branch Protection**: Require CODEOWNERS review for protected branches
- **Auto-Assignment**: Automatically assign reviewers based on CODEOWNERS
- **Notifications**: Team members get notified when their owned files are modified

### Multiple CODEOWNERS Strategies
For complex repositories, consider:
- **Layered Ownership**: Broad base patterns with specific overrides
- **Feature-Based**: Organize ownership by feature rather than directory structure
- **Risk-Based**: More reviewers for high-risk areas, fewer for low-risk areas

## Migration from Manual Review Assignment

### Phase 1: Assessment
1. **Analyze Current Process**: Document how reviews are currently assigned
2. **Identify Ownership**: Map current informal ownership to formal patterns
3. **Team Consensus**: Ensure team agrees on ownership structure

### Phase 2: Implementation
1. **Start Broad**: Begin with simple, broad patterns
2. **Gradual Refinement**: Add specificity based on feedback
3. **Monitor and Adjust**: Watch PR comments and adjust patterns

### Phase 3: Optimization
1. **Fine-tune Patterns**: Optimize based on actual usage
2. **Team Training**: Ensure team understands new process
3. **Process Integration**: Update team documentation and workflows

## Resources and Tools

### Validation Tools
- **GitHub CODEOWNERS Validator**: Built into GitHub's interface
- **Online Pattern Testers**: Test gitignore-style patterns
- **contributor.info Testing**: Use test PRs to verify suggestions

### Example Repositories
Study CODEOWNERS files from popular open source projects:
- [Microsoft/vscode](https://github.com/microsoft/vscode/blob/main/.github/CODEOWNERS)
- [Facebook/react](https://github.com/facebook/react/blob/main/.github/CODEOWNERS)
- [Kubernetes/kubernetes](https://github.com/kubernetes/kubernetes/blob/master/OWNERS)

### Documentation
- [GitHub CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [contributor.info Configuration Guide](/docs/configuration/contributor-file.md)

---

*Last updated: February 2025*