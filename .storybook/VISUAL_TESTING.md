# Visual Regression Testing with Chromatic

## Quick Start Guide

### For Developers

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Set up your environment** (get token from team lead):
   ```bash
   export CHROMATIC_PROJECT_TOKEN=your_token_here
   ```

3. **Run visual tests locally**:
   ```bash
   npm run chromatic
   ```

### For Pull Requests

Visual testing happens automatically when you:
- Push to `main` or `develop` branches
- Create or update a pull request

Check the PR comments for Chromatic results and review any visual changes.

## Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run chromatic` | Run full visual regression test |
| `npm run chromatic:ci` | Run optimized tests (changed stories only) |
| `npm run setup-chromatic` | Create initial baselines (first-time setup) |
| `npm run test-visual-regression` | Test the visual regression detection |

## Understanding Chromatic Results

### ✅ No Changes
All stories look the same as the baseline - no action needed.

### 🔍 Changes Detected
Some stories have visual differences:
1. Click the Chromatic link in the PR comment
2. Review each change in the web interface
3. **Accept** if changes are intentional
4. **Deny** if changes are unexpected (fix your code)

### ❌ Build Failed
The Storybook build failed:
1. Check the build logs
2. Fix any errors in your stories
3. Push your fixes

## Best Practices

### Writing Visual-Test-Friendly Stories

✅ **Do:**
- Use consistent mock data
- Avoid random values or dates
- Disable animations for testing variants
- Use deterministic content

❌ **Avoid:**
- `Math.random()` or `Date.now()` in stories
- External API calls
- Timers or intervals
- User-specific data

### Example: Good Story for Visual Testing

```typescript
// ✅ Good - Consistent and deterministic
export const Default: Story = {
  args: {
    user: {
      name: "John Doe",
      avatar: "/mock-avatar.png",
      joinDate: "2024-01-15T00:00:00Z"
    },
    contributions: 42,
    isOnline: true
  }
};

// ❌ Bad - Random and inconsistent  
export const Random: Story = {
  args: {
    user: {
      name: faker.person.fullName(), // Different each time!
      avatar: faker.image.avatar(),   // Different each time!
      joinDate: new Date().toISOString() // Changes every day!
    },
    contributions: Math.floor(Math.random() * 100), // Random!
    isOnline: Math.random() > 0.5 // Random!
  }
};
```

### Handling Visual Changes

#### Expected Changes (New Features)
1. Develop your feature
2. Update/create stories
3. Push changes
4. Review visual diffs in Chromatic
5. Accept the changes
6. Merge PR

#### Unexpected Changes (Regressions)
1. See visual differences in Chromatic
2. Investigate the cause
3. Fix the issue in your code
4. Push the fix
5. Verify no more unexpected changes

## Troubleshooting

### "Build Failed" in Chromatic

**Check Storybook builds locally:**
```bash
npm run build-storybook
```

**Common issues:**
- Missing imports in stories
- TypeScript errors
- Missing mock data
- Console errors in components

### "No Stories Found"

**Verify story files exist:**
```bash
find src -name "*.stories.tsx" | head -5
```

**Check Storybook configuration:**
```bash
npm run storybook
# Visit http://localhost:6006
```

### "Project Token Invalid"

**Verify token is set:**
```bash
echo $CHROMATIC_PROJECT_TOKEN
```

**Get a new token:**
1. Visit [chromatic.com](https://www.chromatic.com/)
2. Go to your project settings
3. Copy the project token

### False Positives

**Common causes:**
- Font loading timing
- Image loading delays
- Animation timing
- Browser rendering differences

**Solutions:**
- Add `chromatic: { delay: 300 }` to story
- Use `chromatic: { disable: true }` for problematic stories
- Mock external dependencies

## Integration Details

### GitHub Actions Workflow

The `.github/workflows/chromatic.yml` file:
- Runs on every push to main/develop
- Runs on all pull requests
- Posts results as PR comments
- Blocks merging if critical visual regressions found

### Configuration Files

- `chromatic.config.json` - Main Chromatic settings
- `.github/workflows/chromatic.yml` - CI/CD integration
- `package.json` - NPM scripts and dependencies

## Team Workflow

### For Feature Development
1. Create feature branch
2. Develop components and stories
3. Test locally: `npm run chromatic`
4. Push and create PR
5. Review Chromatic results
6. Accept/fix visual changes
7. Merge when approved

### For Design Updates
1. Update components/styles
2. Run visual tests: `npm run chromatic`
3. Review all visual changes
4. Accept intentional changes
5. Document breaking changes

### For Story Maintenance
1. Keep stories up to date with components
2. Add visual test variants for edge cases
3. Remove deprecated stories
4. Update mock data when APIs change

## Support and Resources

- **Chromatic Documentation**: [chromatic.com/docs](https://www.chromatic.com/docs/)
- **Project Dashboard**: Visit chromatic.com and select this project
- **Storybook Documentation**: [storybook.js.org](https://storybook.js.org/)

For help with setup or issues, check the project README or ask the team lead.