---
globs: "**/*"
description: Evidence-Based Reviews Only
alwaysApply: true
---

# Evidence-Based Review Standards

Every issue you raise MUST have evidence. No speculation, no "might", no "could".

## Required Evidence for Each Issue Type

### 🐛 Bug Claims
**Required**: Exact scenario that causes failure
```
❌ "This might cause a null pointer exception"
✅ "This throws TypeError when users array is empty (line 45) because users[0].name is accessed without checking length"
```

### 🔒 Security Claims  
**Required**: Specific attack vector
```
❌ "This has security implications"
✅ "XSS vulnerability: userInput is rendered in dangerouslySetInnerHTML without sanitization, allowing <script> injection"
```

### ⚡ Performance Claims
**Required**: Measurable impact
```
❌ "This is inefficient"
✅ "This triggers re-render of all 1000 list items on every keystroke because key={Math.random()}"
```

### 💭 Logic Error Claims
**Required**: Specific input/output mismatch
```
❌ "The logic seems wrong"
✅ "This returns true for negative numbers, but the function is called isPositive()"
```

## Evidence Checklist

Before posting a comment, ensure you have:
- [ ] Line number where issue occurs
- [ ] Specific scenario that triggers it
- [ ] Explanation of why it's wrong (not just different)
- [ ] Impact on users or system
- [ ] (Optional) Link to docs/specs that prove your point

## Phrases That Signal Weak Reviews

If you write these, you probably lack evidence:
- "This might..."
- "This could potentially..."
- "Consider..."
- "It would be better if..."
- "Best practice suggests..."
- "In my experience..."
- "This seems..."

## Strong Evidence-Based Language

- "This fails when..."
- "This violates the spec at..."
- "Testing confirms this causes..."
- "The error log shows..."
- "Profiling indicates..."
- "The type system proves..."

Remember: If you can't prove it's broken, it's not broken.