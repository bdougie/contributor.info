# Chromatic Visual Regression Testing Setup Guide

## Overview

This project uses Chromatic for automated visual regression testing of Storybook components. Chromatic captures screenshots of your stories and compares them against baseline images to detect visual changes.

## Setup Instructions

### 1. Create Chromatic Project

1. Go to [chromatic.com](https://www.chromatic.com/)
2. Sign in with your GitHub account
3. Click "Add project" and select this repository
4. Follow the setup wizard to create your project
5. Copy the project token provided

### 2. Configure Environment Variables

#### For Local Development
Create a `.env.local` file in the project root:
```
CHROMATIC_PROJECT_TOKEN=your_project_token_here
```

#### For GitHub Actions
1. Go to your repository settings on GitHub
2. Navigate to "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Name: `CHROMATIC_PROJECT_TOKEN`
5. Value: Your Chromatic project token

### 3. Running Visual Tests

#### Local Testing
```bash
# Run Chromatic manually
npm run chromatic

# Run with specific branch
npx chromatic --branch-name=feature-branch-name
```

#### Automated Testing
- Visual tests run automatically on every push to `main` or `develop`
- Visual tests run on all pull requests
- Results are posted as comments on pull requests

### 4. Managing Visual Changes

#### Accepting Changes
When intentional visual changes are made:
1. Review changes in the Chromatic web interface
2. Click "Accept" for intentional changes
3. Changes become the new baseline

#### Reviewing Unexpected Changes
1. Check the Chromatic link in the PR comment
2. Review each visual diff carefully
3. If changes are unintended, fix the code and push again

### 5. Configuration Options

The Chromatic configuration is stored in `chromatic.config.json`:

```json
{
  "projectToken": "YOUR_PROJECT_TOKEN_HERE",
  "buildScriptName": "build-storybook",
  "exitZeroOnChanges": true,
  "onlyChanged": false,
  "allowConsoleErrors": false,
  "ignoreLastBuildOnBranch": "main"
}
```

### 6. Best Practices

#### Story Preparation
- Ensure stories are deterministic (no random data)
- Use consistent mock data for components
- Avoid animations in stories used for visual testing

#### Baseline Management
- Create clean baselines on the main branch
- Review all visual changes before accepting
- Keep baselines up to date with design changes

#### Performance Optimization
- Use `onlyChanged: true` to test only modified stories
- Consider using `skip` for non-visual stories
- Optimize story loading times

### 7. Troubleshooting

#### Common Issues

**Build Failures:**
- Check that Storybook builds successfully locally
- Verify all dependencies are installed
- Check for console errors in stories

**False Positives:**
- Ensure consistent fonts are loaded
- Check for animation-related timing issues
- Verify browser-specific rendering differences

**Missing Baselines:**
- Run Chromatic on the main branch first
- Ensure all stories have been captured
- Check project token configuration

#### Support Resources
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Storybook Visual Testing Guide](https://storybook.js.org/docs/react/workflows/visual-testing)
- [GitHub Actions Integration](https://www.chromatic.com/docs/github-actions)

## Integration with Development Workflow

### Pull Request Process
1. Create feature branch
2. Develop components and stories
3. Push changes (triggers Chromatic build)
4. Review visual changes in Chromatic
5. Accept/reject changes as appropriate
6. Merge when visual review is complete

### Continuous Integration
Visual testing is integrated into the CI/CD pipeline and will:
- Block PRs if visual regressions are detected
- Provide clear feedback on visual changes
- Maintain historical baselines for comparison

This setup ensures that visual changes are intentional and reviewed before deployment.
