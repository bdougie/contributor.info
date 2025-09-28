---
globs: "**/*"
description: Enhanced Contextual Code Review Insights
alwaysApply: true
---

# Enhanced Contextual Code Review

Provide deep, contextual insights that go beyond surface-level feedback.

## Strategic Review Approach

### 🎯 Architectural Analysis
- **System Impact**: How do these changes affect the overall architecture?
- **Pattern Consistency**: Do changes follow established codebase patterns?
- **Integration Points**: What other components might be affected?
- **Scalability Considerations**: Will this approach scale with the system?

### 🔍 Codebase Context Awareness
- **Existing Patterns**: Reference similar implementations in the codebase
- **Convention Adherence**: Follow established naming and structure patterns
- **Library Usage**: Align with existing dependency choices and patterns
- **Test Coverage**: Match existing testing patterns and coverage expectations

### 📊 Quality Metrics Focus
- **Performance Impact**: Real bottlenecks, not premature optimization
- **Security Analysis**: Context-specific vulnerability assessment
- **Maintainability**: Long-term code health and readability
- **Error Handling**: Robust error patterns that match project standards

## Review Output Standards

### Strategic Insights Section
Provide high-level analysis first:
- Key architectural considerations
- Performance implications with specific metrics
- Security concerns with context
- Integration impact assessment

### Code Quality Analysis
Reference project-specific patterns:
- "This pattern matches the approach used in `componentName.ts:line`"
- "Consider using the existing `UtilityClass` pattern for consistency"
- "The error handling should follow the pattern established in `errorHandler.ts`"

### Actionable Recommendations
Each suggestion should include:
1. **Specific location** (file:line)
2. **Context explanation** (why it matters in this codebase)
3. **Example fix** with actual code
4. **Priority level** (High/Medium/Low) based on impact
5. **Related patterns** from existing codebase

## Context Integration Guidelines

### Learn from Codebase
- Analyze import patterns to understand preferred libraries
- Identify naming conventions from existing code
- Reference architectural patterns already in use
- Consider test coverage expectations based on existing tests

### Provide Relevant Examples
```typescript
// Instead of generic advice:
"Use proper TypeScript types"

// Provide contextual feedback:
"Based on the existing UserProfile interface in `types/user.ts`,
consider using:
interface UpdateUserRequest {
  profile: Partial<UserProfile>;
  preferences: UserPreferences;
}
This matches the pattern established in `userService.ts:45`"
```

### Reference Project History
- Mention similar PRs or changes when relevant
- Reference existing documentation or patterns
- Connect changes to broader project goals
- Consider impact on existing workflows

## Effectiveness Metrics

Track review quality through:
- **Implementation Rate**: Percentage of suggestions adopted
- **Issue Prevention**: Bugs caught before merge
- **Pattern Consistency**: Adherence to established conventions
- **Developer Satisfaction**: Useful vs. nitpicky feedback ratio

Remember: The goal is to provide insights that make the codebase better while respecting established patterns and helping developers learn the project's conventions.