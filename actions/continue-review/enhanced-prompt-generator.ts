import { ProjectContext } from './codebase-analyzer';

interface ReviewContext {
  pr: {
    number: number;
    title: string;
    body: string;
    author: string;
    files: PRFile[];
  };
  rules: Rule[];
  command?: string;
  repository: string;
}

interface PRFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
}

interface Rule {
  file: string;
  globs: string;
  description?: string;
  alwaysApply?: boolean;
  content: string;
}

/**
 * Generate enhanced, context-aware review prompt
 */
export function generateEnhancedPrompt(
  context: ReviewContext,
  projectContext: ProjectContext
): string {
  const { pr, rules, command, repository } = context;
  const { patterns, conventions, architecture } = projectContext;

  let prompt = `You are an expert code reviewer with deep understanding of this specific codebase.

# Repository Context: ${repository}

## Project Understanding
This is a **${inferProjectType(conventions, architecture)}** project with the following characteristics:

### Technology Stack
- **Frameworks**: ${conventions.dependencies.frameworks.join(', ') || 'Standard JavaScript/TypeScript'}
- **Key Libraries**: ${conventions.dependencies.libraries.slice(0, 5).join(', ') || 'Standard libraries'}
- **Architecture Patterns**: ${architecture.componentPatterns.slice(0, 3).join(', ') || 'Standard patterns'}

### Established Patterns (found in codebase)
${generatePatternInsights(patterns, conventions)}

### Code Quality Standards
${generateQualityStandards(rules)}

---

# PR Analysis Task

## PR Details
- **Title**: ${pr.title}
- **Author**: ${pr.author}
- **Files Changed**: ${pr.files.length}
- **Description**: ${pr.body || 'No description provided'}

${command ? `\n## Specific Review Request\n"${command}"\n` : ''}

## Review Focus Areas

### 🎯 Strategic Analysis (Primary Focus)
1. **Architectural Impact**: How do these changes affect the system design? Do they follow established patterns?
2. **Performance Implications**: Any potential bottlenecks, unnecessary re-renders, or memory issues?
3. **Security Assessment**: Check for exposed secrets, injection risks, or unsafe operations
4. **Integration Concerns**: How do changes affect other parts of the system?

### 🔍 Code Quality Assessment
1. **Pattern Consistency**: Do changes follow the established patterns found in this codebase?
2. **Type Safety**: Proper TypeScript usage (no 'any' types, proper interfaces)
3. **Error Handling**: Robust error handling that matches project patterns
4. **Testing Requirements**: Are tests needed/updated for these changes?

### ⚡ Implementation Review
1. **Logic Correctness**: Will the code work as intended?
2. **Edge Cases**: Are error conditions and edge cases handled?
3. **Code Clarity**: Is the intent clear and maintainable?
4. **Documentation**: Are complex parts explained appropriately?

---

# Review Guidelines

## What to Focus On
- **Actual Problems**: Issues that will cause bugs, security vulnerabilities, or performance problems
- **Pattern Violations**: Code that doesn't follow established codebase conventions
- **Missing Requirements**: If PR doesn't achieve its stated goals
- **Breaking Changes**: Modifications that could affect existing functionality

## What to Avoid Commenting On
- Style/formatting (handled by linters)
- Personal preferences unless they violate established patterns
- Minor naming unless genuinely confusing
- Alternative approaches unless current approach is problematic

## Review Output Format

Structure your review with clear markdown formatting (use ## and ### headers, but never # h1):

**START WITH A TLDR RECOMMENDATION AT THE VERY TOP:**

## 🎯 TLDR
**Recommendation**: [MERGE ✅ | DON'T MERGE ❌ | MERGE AFTER CHANGES 🔄]
**Summary**: [One or two lines explaining the main reason for this recommendation]

---

Then continue with the detailed review:

## Strategic Insights
- Key architectural considerations and system impact
- Performance implications with specific concerns
- Security vulnerabilities with context
- Integration effects on other components

## Code Quality Analysis
- Pattern consistency with existing codebase
- Type safety and interface usage
- Error handling and edge cases
- Testing coverage recommendations

## Issues Found

For each issue, use ### headers with clear structure:

### 1. Issue Title
**Priority**: High/Medium/Low
**File**: \`path/to/file.ts:line\`
**Problem**: Clear description of the issue
**Why it matters**: Explanation of impact
**Fix**: Concrete solution with code example

## Recommendations
- Overall assessment and next steps
- Critical issues that need immediate attention
- Suggestions for improvement

---

# Code Changes to Review

`;

  // Add code changes with size limits
  let diffContent = '';
  let isTruncated = false;
  
  for (const file of pr.files) {
    if (file.patch) {
      diffContent += `\n## File: ${file.filename}\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;
    }
  }

  // Truncate if too large (15KB limit, increased from 12KB for better context)
  if (diffContent.length > 15000) {
    isTruncated = true;
    diffContent =
      diffContent.substring(0, 14000) +
      '\n```\n\n**⚠️ DIFF TRUNCATED**: The complete diff exceeds size limits. Review only the visible portions.';
  }

  prompt += diffContent;
  
  if (isTruncated) {
    prompt += `\n\n## ⚠️ Important: Handling Truncated Diffs\n\nThe diff has been truncated due to size. When reviewing:\n\n1. **DO NOT** comment on truncation or incomplete content\n2. **DO** review all visible code thoroughly\n3. **DO** mention if you need to see specific files to complete the review\n4. **DO** provide actionable feedback on what you can see\n5. Focus your review on the visible portions only\n\nIf critical files are cut off, recommend viewing them directly in the GitHub PR.`;
  }

  prompt += `

---

Please provide a comprehensive, actionable review that helps improve code quality while respecting the established patterns and conventions of this ${repository} codebase.

Focus on issues that matter for functionality, security, maintainability, and consistency with established patterns.

IMPORTANT FORMATTING RULES:
- Use proper markdown formatting with ## and ### headers for clear structure
- Never use # (h1 headers) - start with ## for main sections and ### for specific issues
- DO NOT mention or comment on diff truncation - review what you can see
- If the diff was truncated, simply review the visible portions without mentioning the truncation`;

  return prompt;
}

/**
 * Infer project type based on dependencies and patterns
 */
function inferProjectType(conventions: any, architecture: any): string {
  const { frameworks, libraries } = conventions.dependencies;

  if (frameworks.includes('React')) {
    if (frameworks.includes('Next.js')) return 'Next.js React application';
    if (libraries.includes('Storybook')) return 'React component library with Storybook';
    return 'React application';
  }

  if (frameworks.includes('Vue')) return 'Vue.js application';
  if (frameworks.includes('Angular')) return 'Angular application';
  if (libraries.includes('TypeScript')) return 'TypeScript application';

  return 'JavaScript application';
}

/**
 * Generate insights about established code patterns
 */
function generatePatternInsights(patterns: any[], conventions: any): string {
  let insights = '';

  // Import patterns
  const topImports = patterns
    .filter((p) => p.type === 'import' && p.frequency > 1)
    .slice(0, 5)
    .map((p) => `- \`${p.pattern}\` (used ${p.frequency} times)`)
    .join('\n');

  if (topImports) {
    insights += `**Common Dependencies**:\n${topImports}\n\n`;
  }

  // Naming conventions
  const { naming } = conventions;
  if (naming.files.length > 0) {
    const fileConvention = getMostCommon(naming.files);
    insights += `**File Naming**: Prefers ${fileConvention}\n`;
  }

  if (naming.functions.length > 0) {
    const funcConvention = getMostCommon(naming.functions);
    insights += `**Function Naming**: Uses ${funcConvention}\n`;
  }

  if (naming.types.length > 0) {
    const typeConvention = getMostCommon(naming.types);
    insights += `**Type Naming**: Uses ${typeConvention}\n`;
  }

  return insights || 'Standard patterns detected';
}

/**
 * Generate quality standards from rules
 */
function generateQualityStandards(rules: Rule[]): string {
  const keyRules = rules
    .filter((rule) => rule.description)
    .slice(0, 5)
    .map((rule) => `- **${rule.description}**: Key project requirement`)
    .join('\n');

  return keyRules || 'Standard code quality practices apply';
}

/**
 * Get the most common item from an array
 */
function getMostCommon(arr: string[]): string {
  const counts = arr.reduce(
    (acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'mixed';
}
