/**
 * Story Validation and Quality Checks Configuration
 * 
 * This module provides utilities for validating story structure
 * and ensuring consistent quality across all Storybook stories.
 */

export interface StoryValidationConfig {
  requireDefaultStory: boolean;
  requireInteractionStory: boolean;
  requireDocumentation: boolean;
  requiredTags: string[];
  recommendedStories: string[];
  titlePatterns: RegExp[];
}

export const defaultValidationConfig: StoryValidationConfig = {
  requireDefaultStory: true,
  requireInteractionStory: false, // Optional but recommended
  requireDocumentation: true,
  requiredTags: ["autodocs"],
  recommendedStories: ["Default", "Loading", "Error"],
  titlePatterns: [
    /^UI\/[A-Z][a-zA-Z]*$/, // UI/Button
    /^Features\/[A-Z][a-zA-Z]*\/[A-Z][a-zA-Z]*$/, // Features/Activity/VelocityCard
    /^Common\/[A-Z][a-zA-Z]*\/[A-Z][a-zA-Z]*$/, // Common/Theming/ModeToggle
    /^Icons\/[A-Z][a-zA-Z]*$/, // Icons/ContributorIcon
    /^Skeletons\/[A-Z][a-zA-Z]*$/, // Skeletons/ContributorCardSkeleton
  ],
};

/**
 * Validates story structure and configuration
 */
export function validateStory(storyExports: Record<string, unknown>, config: StoryValidationConfig = defaultValidationConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if default export exists and has required properties
  if (!storyExports.default) {
    errors.push("Story file must have a default export (meta configuration)");
    return { isValid: false, errors, warnings };
  }

  const meta = storyExports.default;

  // Validate title pattern
  if (!meta.title) {
    errors.push("Meta configuration must include a title");
  } else {
    const titleMatches = config.titlePatterns.some(pattern => pattern.test(meta.title));
    if (!titleMatches) {
      warnings.push(
        `Title "${meta.title}" doesn't match recommended patterns. ` +
        "Use patterns like 'UI/ComponentName', 'Features/Category/ComponentName', etc."
      );
    }
  }

  // Check for required tags
  if (config.requiredTags.length > 0) {
    const tags = meta.tags || [];
    const missingTags = config.requiredTags.filter(tag => !tags.includes(tag));
    if (missingTags.length > 0) {
      warnings.push(`Missing recommended tags: ${missingTags.join(", ")}`);
    }
  }

  // Check for component reference
  if (!meta.component) {
    warnings.push("Meta configuration should include a component reference for better prop detection");
  }

  // Check for documentation
  if (config.requireDocumentation) {
    if (!meta.parameters?.docs?.description?.component) {
      warnings.push("Component should include documentation in meta.parameters.docs.description.component");
    }
  }

  // Get all story exports (non-default exports)
  const stories = Object.keys(storyExports).filter(key => key !== "default");

  // Check for required Default story
  if (config.requireDefaultStory && !stories.includes("Default")) {
    errors.push("Story file must include a 'Default' story");
  }

  // Check for recommended stories
  const missingRecommended = config.recommendedStories.filter(
    story => !stories.includes(story)
  );
  if (missingRecommended.length > 0) {
    warnings.push(`Consider adding these recommended stories: ${missingRecommended.join(", ")}`);
  }

  // Check for interaction story requirement
  if (config.requireInteractionStory) {
    const hasInteractionStory = stories.some(storyName => {
      const story = storyExports[storyName];
      return story?.play || story?.tags?.includes("interaction");
    });
    if (!hasInteractionStory) {
      warnings.push("Consider adding a story with user interactions for better testing coverage");
    }
  }

  // Validate individual stories
  stories.forEach(storyName => {
    const story = storyExports[storyName];
    
    // Check story naming convention
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(storyName)) {
      warnings.push(`Story "${storyName}" should use PascalCase naming`);
    }

    // Check for args vs render consistency
    if (story?.args && story?.render) {
      warnings.push(
        `Story "${storyName}" has both args and render function. ` +
        "Consider using one approach for consistency"
      );
    }
  });

  const isValid = errors.length === 0;
  return { isValid, errors, warnings };
}

/**
 * Validates story accessibility requirements
 */
export function validateAccessibility(storyExports: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const meta = storyExports.default;

  // Check for a11y configuration
  if (!meta.parameters?.a11y) {
    warnings.push("Consider adding accessibility testing configuration (parameters.a11y)");
  }

  // Check for interaction stories with accessibility considerations
  const stories = Object.keys(storyExports).filter(key => key !== "default");
  const interactionStories = stories.filter(storyName => {
    const story = storyExports[storyName];
    return story?.play || story?.tags?.includes("interaction");
  });

  if (interactionStories.length > 0) {
    interactionStories.forEach(storyName => {
      const story = storyExports[storyName];
      if (!story.tags?.includes("accessibility")) {
        warnings.push(
          `Interactive story "${storyName}" should include accessibility testing. ` +
          "Add 'accessibility' tag or use accessibility testing utilities in play function"
        );
      }
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validates story performance considerations
 */
export function validatePerformance(storyExports: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const meta = storyExports.default;

  // Check for heavy decorators
  if (meta.decorators && meta.decorators.length > 3) {
    warnings.push("Consider reducing the number of decorators for better performance");
  }

  // Check for large mock data
  const stories = Object.keys(storyExports).filter(key => key !== "default");
  stories.forEach(storyName => {
    const story = storyExports[storyName];
    if (story?.args) {
      const argsString = JSON.stringify(story.args);
      if (argsString.length > 10000) { // 10KB threshold
        warnings.push(
          `Story "${storyName}" has large args object. ` +
          "Consider moving large mock data to separate files"
        );
      }
    }
  });

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Comprehensive story validation
 */
export function validateStoryFile(storyExports: Record<string, unknown>, config: StoryValidationConfig = defaultValidationConfig) {
  const structureValidation = validateStory(storyExports, config);
  const accessibilityValidation = validateAccessibility(storyExports);
  const performanceValidation = validatePerformance(storyExports);

  return {
    isValid: structureValidation.isValid && accessibilityValidation.isValid && performanceValidation.isValid,
    structure: structureValidation,
    accessibility: accessibilityValidation,
    performance: performanceValidation,
    summary: {
      totalErrors: structureValidation.errors.length + accessibilityValidation.errors.length + performanceValidation.errors.length,
      totalWarnings: structureValidation.warnings.length + accessibilityValidation.warnings.length + performanceValidation.warnings.length,
    }
  };
}

/**
 * Story quality scoring
 */
export function scoreStoryQuality(storyExports: Record<string, unknown>): {
  score: number; // 0-100
  breakdown: {
    structure: number;
    documentation: number;
    coverage: number;
    accessibility: number;
    performance: number;
  };
  recommendations: string[];
} {
  const validation = validateStoryFile(storyExports);
  const stories = Object.keys(storyExports).filter(key => key !== "default");
  const meta = storyExports.default;

  let structureScore = 80;
  let documentationScore = 60;
  let coverageScore = 50;
  let accessibilityScore = 60;
  let performanceScore = 80;

  const recommendations: string[] = [];

  // Structure scoring
  if (validation.structure.errors.length === 0) {
    structureScore = 90;
  }
  if (stories.includes("Default")) {
    structureScore += 10;
  }

  // Documentation scoring
  if (meta.parameters?.docs?.description?.component) {
    documentationScore += 30;
  }
  if (meta.tags?.includes("autodocs")) {
    documentationScore += 10;
  }

  // Coverage scoring
  const recommendedStories = ["Default", "Loading", "Error", "Disabled"];
  const presentStories = recommendedStories.filter(story => stories.includes(story));
  coverageScore = Math.min(100, 30 + (presentStories.length / recommendedStories.length) * 70);

  // Accessibility scoring
  if (meta.parameters?.a11y) {
    accessibilityScore += 20;
  }
  const hasInteractionTests = stories.some(storyName => {
    const story = storyExports[storyName];
    return story?.play;
  });
  if (hasInteractionTests) {
    accessibilityScore += 20;
  }

  // Performance scoring
  if (validation.performance.warnings.length === 0) {
    performanceScore = 100;
  }

  // Generate recommendations
  if (structureScore < 90) {
    recommendations.push("Fix story structure issues");
  }
  if (documentationScore < 80) {
    recommendations.push("Add comprehensive component documentation");
  }
  if (coverageScore < 70) {
    recommendations.push("Add more story variants (Loading, Error, Disabled states)");
  }
  if (accessibilityScore < 80) {
    recommendations.push("Enhance accessibility testing");
  }
  if (performanceScore < 90) {
    recommendations.push("Optimize story performance");
  }

  const breakdown = {
    structure: structureScore,
    documentation: documentationScore,
    coverage: coverageScore,
    accessibility: accessibilityScore,
    performance: performanceScore,
  };

  const score = Math.round(
    (structureScore + documentationScore + coverageScore + accessibilityScore + performanceScore) / 5
  );

  return { score, breakdown, recommendations };
}