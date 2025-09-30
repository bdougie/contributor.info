/**
 * Parse review response to extract metrics
 * @param {string} reviewText - The review text to analyze
 * @returns {object} Parsed metrics
 */
export function parseReviewMetrics(reviewText) {
  const issuesFound = { high: 0, medium: 0, low: 0 };
  let totalSuggestions = 0;

  // Count priority levels
  const highMatches = reviewText.match(/\*\*Priority\*\*:\s*High/gi);
  const mediumMatches = reviewText.match(/\*\*Priority\*\*:\s*Medium/gi);
  const lowMatches = reviewText.match(/\*\*Priority\*\*:\s*Low/gi);

  issuesFound.high = highMatches?.length || 0;
  issuesFound.medium = mediumMatches?.length || 0;
  issuesFound.low = lowMatches?.length || 0;

  // Count total suggestions (look for numbered lists, bullet points, etc.)
  const suggestionPatterns = [
    /^\d+\./gm, // numbered lists
    /^[-*]\s/gm, // bullet points
    /### .*Issue/gi, // section headers
    /\*\*Suggestion\*\*/gi, // explicit suggestions
  ];

  suggestionPatterns.forEach((pattern) => {
    const matches = reviewText.match(pattern);
    if (matches) {
      totalSuggestions = Math.max(totalSuggestions, matches.length);
    }
  });

  return {
    issuesFound,
    totalSuggestions,
  };
}

/**
 * Extract project type from context
 * @param {string[]} frameworks - List of frameworks
 * @param {string[]} libraries - List of libraries
 * @returns {string} Project type description
 */
export function extractProjectType(frameworks, libraries) {
  if (frameworks.includes('React')) {
    if (frameworks.includes('Next.js')) return 'Next.js Application';
    return 'React Application';
  }

  if (frameworks.includes('Vue')) return 'Vue.js Application';
  if (frameworks.includes('Angular')) return 'Angular Application';
  if (libraries.includes('TypeScript')) return 'TypeScript Project';

  return 'JavaScript Project';
}

/**
 * Log review metrics (for webhook environment, we just log instead of persisting)
 * @param {object} metrics - Review metrics to log
 * @param {object} logger - Logger instance
 */
export function logReviewMetrics(metrics, logger) {
  logger.info('Review Metrics Summary:');
  logger.info('  Repository: %s', metrics.repository);
  logger.info('  PR #%d by %s', metrics.prNumber, metrics.prAuthor);
  logger.info('  Files Changed: %d', metrics.filesChanged);
  logger.info('  Processing Time: %ds', metrics.metrics.processingTime);
  logger.info('  Prompt Length: %d chars', metrics.metrics.promptLength);
  logger.info('  Response Length: %d chars', metrics.metrics.responseLength);
  logger.info('  Rules Applied: %d', metrics.metrics.rulesApplied);
  logger.info('  Patterns Detected: %d', metrics.metrics.patternsDetected);
  logger.info(
    '  Issues Found: High=%d, Medium=%d, Low=%d',
    metrics.metrics.issuesFound.high,
    metrics.metrics.issuesFound.medium,
    metrics.metrics.issuesFound.low
  );
  logger.info('  Project Type: %s', metrics.context.projectType);
  logger.info('  Has Custom Command: %s', metrics.context.hasCustomCommand);
}
