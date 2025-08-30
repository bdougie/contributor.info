---
globs: "**/*"
description: Understand Context Before Commenting
alwaysApply: true
---

# Context-Aware Review

Before commenting on ANY issue, verify you understand:

## 1. The Purpose
- What problem is this PR solving?
- Is this a bug fix, feature, or refactor?
- What's the acceptance criteria?

## 2. The Existing Code
- How does the current implementation work?
- What patterns does the codebase already use?
- Are there similar implementations elsewhere?

## 3. The Constraints
- Is this a quick fix or long-term solution?
- Are there deadlines or performance requirements?
- What trade-offs were intentionally made?

## Red Flags for Bad Reviews

Your comment is probably wrong if:
- You haven't checked if the pattern exists elsewhere in the codebase
- You're suggesting a "better" way without explaining WHY it's better
- You're calling something a "bug" without proving it will fail
- You're citing "best practices" without considering the context

## Examples of Context-Ignorant Reviews (DON'T DO THIS)

❌ "Use hooks instead of class components"
- Maybe the codebase is migrating gradually

❌ "This should be extracted to a separate function"  
- Maybe it's intentionally inline for performance

❌ "Add error handling here"
- Maybe errors are handled at a higher level

❌ "This is inefficient"
- Maybe it's fast enough for the use case

## Good Context-Aware Reviews

✅ "This pattern differs from the error handling in src/api/* which uses try-catch. Was this intentional?"

✅ "This will throw when userData is null, which happens when users are logged out (see line 234)"

✅ "The team agreed to use snake_case for API fields (see CONTRIBUTING.md), but this uses camelCase"

Remember: **Understanding > Assuming**