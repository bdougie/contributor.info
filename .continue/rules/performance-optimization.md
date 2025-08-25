---
globs: "**/*.{ts,tsx,js,jsx}"
description: No premature optimization without validation
---

# Performance Optimization Guidelines

Avoid premature optimization. Performance improvements must be validated with tests or benchmarks.

## Core Principles

1. **No premature optimization** - Don't optimize without demonstrable need
2. **Measure first** - Profile and identify actual bottlenecks before optimizing
3. **Validate improvements** - Always verify optimizations actually improve performance
4. **Prioritize clarity** - Code readability > theoretical performance gains

## When to Optimize

✅ **Good reasons to optimize:**
- Profiler shows this is a bottleneck
- Users report performance issues
- Metrics show degraded performance
- After visual changes (look for opportunities)

❌ **Bad reasons to optimize:**
- "This might be faster"
- "Best practices say..."
- Complex edge cases that rarely occur
- Micro-optimizations with no measurable impact

## Required for Performance Changes

If implementing performance optimizations:
1. Include benchmarks or tests that verify the improvement
2. Document the performance gain (e.g., "Reduces render time by 40%")
3. Ensure code remains maintainable
4. Consider the trade-offs

## Example

❌ **Premature optimization:**
```javascript
// Overly complex memoization for a simple calculation
const memoizedValue = useMemo(() => {
  return items.reduce((acc, item) => acc + item.value, 0);
}, [items.map(i => i.value).join(',')]);  // Complex dependency tracking
```

✅ **Appropriate optimization (with justification):**
```javascript
// Memoize expensive computation (profiler showed 200ms+ on each render)
const expensiveResult = useMemo(() => {
  return calculateComplexMetrics(largeDataset);
}, [largeDataset]);
// Benchmark: Reduces re-render time from 200ms to 5ms
```