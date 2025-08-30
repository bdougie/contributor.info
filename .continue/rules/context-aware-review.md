---
globs: "**/*"
description: Context-Aware Code Review
alwaysApply: true
---

# Context-Aware Code Review

Be aware of the PR context and existing codebase before commenting.

## Before Reviewing

1. **Read the PR description** - Understand what problem is being solved
2. **Check existing patterns** - Look at similar code in the repository
3. **Review other comments** - Don't duplicate what's already been said
4. **Consider the scope** - Is this a hotfix, feature, or refactor?

## Focus Areas

### ✅ DO Comment On
- **Actual bugs**: Code that will fail or behave incorrectly
- **Security issues**: Exposed secrets, injection vulnerabilities, unsafe operations
- **Breaking changes**: API changes, schema modifications, compatibility issues
- **Missing requirements**: If the PR doesn't fulfill its stated purpose
- **Performance problems**: O(n²) algorithms, memory leaks, unnecessary re-renders
- **Missing tests**: For new features or bug fixes that should have test coverage
- **Missing documentation**: For new APIs, complex logic, or public interfaces

### ❌ DON'T Comment On
- **Style preferences**: Let linters and formatters handle this
- **Alternative approaches**: Unless the current approach is objectively wrong
- **Minor naming**: Unless it's genuinely confusing or misleading
- **Trivial documentation**: Don't ask for docs on self-explanatory code

## Review Tone

Be helpful and specific:
- Point to line numbers when reporting issues
- Explain why something is a problem
- Suggest a fix when possible
- Acknowledge good patterns when you see them

## Context Checklist

Before posting a comment, verify:
- [ ] Is this issue specific to this PR (not pre-existing)?
- [ ] Have I checked if this pattern exists elsewhere in the codebase?
- [ ] Has someone else already mentioned this?
- [ ] Is this critical to the PR's functionality?
- [ ] Am I being constructive rather than nitpicky?

Remember: The goal is to help ship quality code, not to show off your knowledge.