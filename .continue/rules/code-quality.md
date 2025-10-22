# Code Quality Standards

## Build Requirements

All changes must pass:
```bash
npm run build
```

This ensures:
- TypeScript type checking
- Production bundle builds successfully
- No build errors

## Code Improvement Philosophy

- **If you touch the file, make it better** - Don't just disable the linter
- Fix existing issues when modifying files
- Improve code quality incrementally
- Leave code better than you found it

## Testing Standards

- **Use Vitest, NOT Jest** (except in Storybook)
- Follow bulletproof testing practices from `/docs/testing/BULLETPROOF_TESTING_GUIDELINES.md`
- Only use E2E tests when absolutely necessary
- Keep tests maintainable and focused

## Performance

- **No premature optimizations** without testing
- Test performance impact of changes
- Use proper profiling tools
- Document performance improvements with metrics

## Scripts Organization

- Scripts must be documented
- Organize scripts into folders with READMEs
- Delete one-time use scripts not referenced anywhere
- Keep scripts directory clean and maintainable

## Review Checklist

- [ ] Build passes (`npm run build`)
- [ ] TypeScript types check
- [ ] Tests use Vitest (not Jest)
- [ ] No premature optimizations
- [ ] Scripts are documented
- [ ] Linter issues fixed, not disabled
- [ ] Code quality improved if file was touched
