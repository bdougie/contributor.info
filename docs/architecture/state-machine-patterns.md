# State Machine Patterns & Ternary Refactoring

## Background

### The Rollup 4.45.0 Bug

**Critical Issue**: Rollup 4.45.0 has a confirmed bug with nested ternary operators that causes build failures when tree shaking is enabled. This forced us to either:
1. Disable tree shaking (causing 55% larger bundles)
2. Refactor nested ternaries into utility functions

We chose option 2 for better performance and maintainability.

**Status**: Still relevant as of August 2025 - the project uses Rollup 4.45.0 via Vite 6.3.5.

## State Machine Design Philosophy

Our utility functions implement implicit state machines that transform complex nested conditionals into predictable, testable patterns. Each utility function represents a state transition or classification system.

### Core Principles

1. **Single Responsibility**: Each function handles one type of state transformation
2. **Predictable Outputs**: Given an input state, the output is deterministic
3. **Type Safety**: All functions use TypeScript for compile-time safety
4. **Testability**: Each state transition can be unit tested in isolation
5. **Performance**: Functions are pure and optimizable by the compiler

## State Machine Categories

### 1. Score-Based State Machines (`score-styling.ts`)

These functions map numeric scores to discrete states (colors, classes, priorities).

```typescript
// State transitions based on score thresholds
export function getScoreColor(score: number): string {
  if (score >= 90) return '#4ade80'; // Good state
  if (score >= 70) return '#facc15'; // Warning state
  if (score >= 50) return '#fb923c'; // Needs improvement state
  return '#f87171';                   // Poor state
}
```

**State Machine Model**:
```
Score Input → Threshold Evaluator → Color State Output
    95      →    score >= 90      →   '#4ade80' (green)
    75      →    score >= 70      →   '#facc15' (yellow)
    60      →    score >= 50      →   '#fb923c' (orange)
    30      →    score < 50       →   '#f87171' (red)
```

### 2. Enumeration State Machines (`state-mapping.ts`)

These functions map enumerated types to visual representations or classifications.

```typescript
// Discrete state to emoji mapping
export function getPRStateEmoji(state: string): string {
  const emojiMap: Record<string, string> = {
    open: '🟢',
    closed: '🔴',
    merged: '🟣',
    draft: '⚪'
  };
  return emojiMap[state] || '⚫';
}
```

**State Machine Model**:
```
PR State → Lookup Table → Emoji Output
  open   →   Map['open']  →     🟢
  closed →   Map['closed'] →    🔴
  merged →   Map['merged'] →    🟣
  unknown →   fallback    →     ⚫
```

### 3. Priority Classification Machines (`priority-classification.ts`)

These functions determine priority levels and loading strategies based on multiple inputs.

```typescript
// Multi-factor priority determination
export function getPriorityLevel(
  score: number,
  isAboveFold: boolean,
  userInteraction: boolean
): 'high' | 'medium' | 'low' {
  if (isAboveFold || userInteraction) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}
```

**State Machine Model**:
```
Inputs: (score, position, interaction)
    ↓
Priority Rules Engine
    ↓
Priority State: high | medium | low
```

### 4. Binary State Machines (`component-state.ts`)

Simple two-state decisions based on conditions.

```typescript
// Binary state decision
export function getHoverOpacity(isQuadrant: boolean, isHovered: boolean): number {
  if (!isQuadrant) return 1;
  return isHovered ? 1 : 0.92;
}
```

**State Machine Model**:
```
(isQuadrant, isHovered) → Decision Tree → Opacity
    (false, *)          →     1.0
    (true, true)        →     1.0
    (true, false)       →     0.92
```

### 5. Image Optimization State Machine (`image-optimization.ts`)

Complex state machine for determining image optimization strategies.

```typescript
export function getOptimizedImageUrls(originalSrc: string, width?: number, height?: number) {
  // State 1: Determine URL type
  const isRelativePath = !originalSrc.startsWith('http://') && 
                        !originalSrc.startsWith('https://') && 
                        !originalSrc.startsWith('//');
  
  // State 2: Route to appropriate handler
  if (isRelativePath) {
    return IMAGE_URL_GENERATORS.local(originalSrc, width, height);
  }
  
  // State 3: Parse and classify external URLs
  try {
    const url = new URL(originalSrc);
    
    // State 4: Special handling for GitHub avatars
    if (url.hostname === 'avatars.githubusercontent.com') {
      return IMAGE_URL_GENERATORS.githubAvatar(originalSrc, width, height);
    }
    
    // State 5: Generic external handler
    return IMAGE_URL_GENERATORS.external(originalSrc);
  } catch {
    // Error state: Fallback to external
    return IMAGE_URL_GENERATORS.external(originalSrc);
  }
}
```

**State Machine Model**:
```
Image URL Input
    ↓
URL Classification
    ├─ Relative Path → Local Optimizer → WebP + Fallback URLs
    ├─ GitHub Avatar → GitHub Optimizer → Sized Avatar URL
    └─ External URL → External Handler → Original URL
```

## Benefits of State Machine Approach

### 1. Maintainability
- **Clear Logic Flow**: Each state transition is explicit
- **Easy Debugging**: Can trace exact state path
- **Modular Updates**: Changes to one state don't affect others

### 2. Performance
- **Tree Shaking**: Functions are individually shakeable
- **Compiler Optimization**: Pure functions enable optimization
- **Bundle Size**: Smaller than inline ternaries after minification

### 3. Testing
- **Unit Testable**: Each function tested in isolation
- **Edge Cases**: All state transitions have explicit tests
- **Coverage**: 100% test coverage achievable

### 4. Type Safety
- **Compile-Time Checks**: TypeScript ensures valid states
- **Exhaustive Handling**: Can use discriminated unions for completeness
- **IntelliSense**: Better IDE support than nested ternaries

## Migration Guide

### Before (Nested Ternary):
```tsx
const className = score >= 90 ? 'text-green-500' : 
                  score >= 70 ? 'text-yellow-500' : 
                  score >= 50 ? 'text-orange-500' : 'text-red-500';
```

### After (State Machine):
```tsx
const className = getScoreClassName(score);
```

### Implementation:
```typescript
export function getScoreClassName(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}
```

## Best Practices

### 1. Naming Conventions
- Use descriptive verbs: `get`, `determine`, `calculate`, `classify`
- Include output type: `getScoreColor`, `getPriorityLevel`, `determineLoadingStrategy`
- Be specific: `getGitHubAvatarUrl` not just `getAvatarUrl`

### 2. Documentation
- Add JSDoc with examples
- Document state transitions
- Include parameter descriptions and return types

### 3. Testing
- Test all state transitions
- Include edge cases
- Test with invalid inputs

### 4. Organization
- Group related functions in same file
- Create domain-specific modules
- Export from index for clean imports

## Common Patterns

### Pattern 1: Threshold-Based Classification
```typescript
export function classifyByThreshold(value: number): string {
  const thresholds = [
    { min: 90, result: 'excellent' },
    { min: 70, result: 'good' },
    { min: 50, result: 'fair' },
    { min: 0, result: 'poor' }
  ];
  
  return thresholds.find(t => value >= t.min)?.result || 'unknown';
}
```

### Pattern 2: Lookup Table
```typescript
export function mapStateToValue(state: string): string {
  const stateMap: Record<string, string> = {
    loading: 'spinner',
    error: 'alert',
    success: 'check',
    idle: 'empty'
  };
  
  return stateMap[state] || stateMap.idle;
}
```

### Pattern 3: Multi-Factor Decision
```typescript
export function determineAction(
  condition1: boolean,
  condition2: boolean,
  condition3: boolean
): string {
  if (condition1 && condition2) return 'action1';
  if (condition1 || condition3) return 'action2';
  if (condition2) return 'action3';
  return 'default';
}
```

## Future Considerations

### Rollup Bug Resolution
- Monitor Rollup releases for bug fix
- When fixed, ternaries could be allowed but utility functions provide better maintainability
- Consider keeping utility functions for complex logic even after bug fix

### Potential Enhancements
1. **State Machine Library**: Consider formal state machine library for complex flows
2. **Memoization**: Add memoization for expensive calculations
3. **Composition**: Create higher-order functions for common patterns
4. **Code Generation**: Generate boilerplate for common state machines

## References

- [Original Rollup Bug Report](https://github.com/rollup/rollup/issues/5000)
- [PR #574 - Initial Ternary Refactoring](https://github.com/bdougie/contributor.info/pull/574)
- [Issue #542 - Nested Ternary Tracking](https://github.com/bdougie/contributor.info/issues/542)
- [Bundle Optimization Documentation](./docs/performance/BUNDLE_OPTIMIZATION_2025.md)