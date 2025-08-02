# .contributor Configuration File Guide

## Overview

The `.contributor` file allows you to customize how the contributor.info GitHub App behaves in your repository. This configuration file should be placed in the root of your repository and supports both YAML and JSON formats.

## File Location and Format

**File Location**: Place the file at the root of your repository as `.contributor`

**Supported Formats**: 
- YAML (recommended for readability)
- JSON (for programmatic generation)

## Complete Configuration Reference

### YAML Format (Recommended)

```yaml
# Contributor.info Configuration
# Learn more: https://contributor.info/docs/configuration

version: 1

# Enable or disable features
features:
  reviewer_suggestions: true  # Suggest reviewers based on CODEOWNERS and history
  similar_issues: true       # Show related issues on new issues
  auto_comment: true         # Post insights automatically on PRs

# Comment style: "detailed" or "minimal"
comment_style: detailed

# Exclude specific users from features
exclude_authors: []         # Users whose PRs won't get comments
exclude_reviewers: []       # Users who won't be suggested as reviewers

# Advanced settings (optional)
reviewer_settings:
  max_suggestions: 3        # Maximum number of reviewer suggestions (1-5)
  min_ownership: 10         # Minimum ownership percentage to suggest (0-100)
  response_time_weight: 0.2 # How much to weight fast response times (0-1)

# Notification preferences
notifications:
  welcome_first_time: true  # Welcome new contributors
  celebrate_milestones: true # Celebrate contributor milestones
  mention_expertise: true   # Mention contributor expertise areas
```

### JSON Format

```json
{
  "version": 1,
  "features": {
    "reviewer_suggestions": true,
    "similar_issues": true,
    "auto_comment": true
  },
  "comment_style": "detailed",
  "exclude_authors": [],
  "exclude_reviewers": [],
  "reviewer_settings": {
    "max_suggestions": 3,
    "min_ownership": 10,
    "response_time_weight": 0.2
  },
  "notifications": {
    "welcome_first_time": true,
    "celebrate_milestones": true,
    "mention_expertise": true
  }
}
```

## Configuration Options

### Core Settings

#### `version` (required)
- **Type**: Number
- **Default**: `1`
- **Description**: Configuration schema version. Always use `1` for current format.

#### `features` (optional)
Controls which features are enabled for your repository.

**`reviewer_suggestions`**
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable/disable automatic reviewer suggestions on pull requests

**`similar_issues`**
- **Type**: Boolean  
- **Default**: `true`
- **Description**: Show related issues and pull requests in PR comments

**`auto_comment`**
- **Type**: Boolean
- **Default**: `true`
- **Description**: Automatically post insights comments on pull requests

#### `comment_style` (optional)
- **Type**: String
- **Default**: `"detailed"`
- **Options**: `"detailed"` or `"minimal"`
- **Description**: Controls how much information is included in automated comments

**Detailed Style**: Includes full contributor stats, expertise areas, response times, and related issues
**Minimal Style**: Shows only essential information in a condensed format

### User Exclusions

#### `exclude_authors` (optional)
- **Type**: Array of strings
- **Default**: `[]`
- **Description**: List of GitHub usernames whose pull requests will not receive automated comments

#### `exclude_reviewers` (optional)
- **Type**: Array of strings  
- **Default**: `[]`
- **Description**: List of GitHub usernames who will not be suggested as reviewers

### Advanced Reviewer Settings

#### `reviewer_settings` (optional)
Fine-tune reviewer suggestion behavior.

**`max_suggestions`**
- **Type**: Number
- **Default**: `3`
- **Range**: `1-5`
- **Description**: Maximum number of reviewers to suggest per pull request

**`min_ownership`**
- **Type**: Number
- **Default**: `10`
- **Range**: `0-100`
- **Description**: Minimum percentage of files a user must own to be suggested as a reviewer

**`response_time_weight`**
- **Type**: Number
- **Default**: `0.2`
- **Range**: `0-1`
- **Description**: How much to prioritize reviewers with fast response times (0 = ignore, 1 = heavily prioritize)

### Notification Preferences

#### `notifications` (optional)
Control when and how the app mentions contributors.

**`welcome_first_time`**
- **Type**: Boolean
- **Default**: `true`
- **Description**: Post welcome messages for first-time contributors

**`celebrate_milestones`**
- **Type**: Boolean
- **Default**: `true`  
- **Description**: Celebrate contributor milestones (10th PR, 100th commit, etc.)

**`mention_expertise`**
- **Type**: Boolean
- **Default**: `true`
- **Description**: Include expertise areas in contributor profiles

## Example Configurations

### Minimal Configuration
For teams that want basic functionality with minimal noise:

```yaml
version: 1
comment_style: minimal
features:
  reviewer_suggestions: true
  similar_issues: false
  auto_comment: true
notifications:
  welcome_first_time: false
  celebrate_milestones: false
```

### Bot-Heavy Repository
For repositories with many automated PRs:

```yaml
version: 1
exclude_authors:
  - dependabot[bot]
  - renovate[bot]
  - github-actions[bot]
  - greenkeeper[bot]
exclude_reviewers:
  - bot-account
  - automated-reviewer
features:
  reviewer_suggestions: true
  similar_issues: true
  auto_comment: true
```

### High-Traffic Repository
For busy repositories that need focused reviewer suggestions:

```yaml
version: 1
comment_style: minimal
reviewer_settings:
  max_suggestions: 2
  min_ownership: 25
  response_time_weight: 0.4
features:
  reviewer_suggestions: true
  similar_issues: false
  auto_comment: true
```

### Open Source Project
For open source projects welcoming new contributors:

```yaml
version: 1
comment_style: detailed
notifications:
  welcome_first_time: true
  celebrate_milestones: true
  mention_expertise: true
features:
  reviewer_suggestions: true
  similar_issues: true
  auto_comment: true
```

### Security-Focused Repository
For repositories requiring careful review processes:

```yaml
version: 1
reviewer_settings:
  max_suggestions: 5
  min_ownership: 5
  response_time_weight: 0.1
exclude_reviewers:
  - junior-dev1
  - intern-account
features:
  reviewer_suggestions: true
  similar_issues: true
  auto_comment: true
```

## Comment Style Comparison

### Detailed Style
```markdown
## 🎯 Contributor Insights

**@john-doe** has contributed:
- 📊 45 PRs (42 merged, 93% first-time approval rate)  
- 🏆 Primary expertise: Frontend, API integration
- 🕐 Active hours: 9 AM - 5 PM UTC
- 🔄 Last active: 2 hours ago

### 💡 Suggested Reviewers
Based on code ownership and expertise:
- **@alice-frontend** (Alice Smith) - Owns 75% of modified files (avg response: 4 hours)
- **@bob-security** (Bob Johnson) - Expert in auth, security (avg response: 1 day)

### 🔍 Related Issues & Context
**This PR may fix:**
- ✅ **#123** "Login button not working on mobile" (high priority)
```

### Minimal Style  
```markdown
**@john-doe**: 42/45 PRs merged • Suggested reviewers: @alice-frontend, @bob-security • Fixes 1 issue • [Details](https://contributor.info)
```

## Validation and Error Handling

The configuration file is validated when the app processes each webhook. If validation fails:

1. **Invalid Syntax**: The app falls back to default configuration and logs an error
2. **Unknown Fields**: Unknown fields are ignored with a warning
3. **Invalid Values**: Invalid values are replaced with defaults
4. **Missing File**: If no `.contributor` file exists, all defaults are used

### Common Validation Errors

**Invalid comment_style:**
```yaml
comment_style: verbose  # Error: must be "detailed" or "minimal"
```

**Invalid max_suggestions:**
```yaml
reviewer_settings:
  max_suggestions: 10   # Error: must be between 1-5
```

**Invalid exclude format:**
```yaml
exclude_authors: "dependabot[bot]"  # Error: must be an array
```

## Default Configuration

If no `.contributor` file is present, the app uses these defaults:

```yaml
version: 1
features:
  reviewer_suggestions: true
  similar_issues: true
  auto_comment: true
comment_style: detailed
exclude_authors: []
exclude_reviewers: []
reviewer_settings:
  max_suggestions: 3
  min_ownership: 10
  response_time_weight: 0.2
notifications:
  welcome_first_time: true
  celebrate_milestones: true
  mention_expertise: true
```

## Configuration Management

### Creating Your First Configuration

1. **Start with defaults**: Begin with a minimal configuration and add customizations as needed
2. **Test incrementally**: Make one configuration change at a time to understand the impact
3. **Monitor feedback**: Watch how team members respond to different comment styles and suggestions

### Updating Configuration

1. **Edit the file**: Modify `.contributor` in your repository root
2. **Commit changes**: The new configuration takes effect on the next webhook event
3. **Test with a PR**: Open a test pull request to verify the new settings work as expected

### Organization-Wide Standards

For organizations managing multiple repositories:

1. **Create a template**: Develop a standard `.contributor` file for your organization
2. **Document decisions**: Include comments explaining why certain settings were chosen
3. **Share knowledge**: Train team members on available configuration options
4. **Regular review**: Periodically review and update configurations based on team feedback

## Troubleshooting

### Configuration Not Taking Effect

1. **Check file location**: Ensure `.contributor` is in the repository root
2. **Verify syntax**: Use a YAML/JSON validator to check for syntax errors
3. **Check permissions**: Ensure the GitHub App has repository access
4. **Test with new PR**: Configuration changes apply to new events, not existing PRs

### Unexpected Behavior

1. **Review logs**: Check the app's comment for any error messages
2. **Validate configuration**: Ensure all values are within acceptable ranges
3. **Check exclusions**: Verify exclude lists don't contain typos
4. **Compare with defaults**: Test with a minimal configuration to isolate issues

### Getting Help

- **Validation errors**: Error messages are included in PR comments when possible
- **GitHub Issues**: Report configuration problems at [github.com/bdougie/contributor.info/issues](https://github.com/bdougie/contributor.info/issues)
- **Examples**: Browse real-world configurations in popular open source repositories

---

*Last updated: February 2025*