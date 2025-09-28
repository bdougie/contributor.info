import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ReviewMetrics {
  timestamp: string;
  repository: string;
  prNumber: number;
  prAuthor: string;
  filesChanged: number;
  reviewerId: string; // Continue assistant identifier
  metrics: {
    promptLength: number;
    responseLength: number;
    processingTime: number;
    rulesApplied: number;
    patternsDetected: number;
    issuesFound: {
      high: number;
      medium: number;
      low: number;
    };
  };
  context: {
    hasCustomCommand: boolean;
    projectType: string;
    mainLanguages: string[];
  };
}

interface ReviewQualityTracking {
  reviewId: string;
  metrics: ReviewMetrics;
  effectiveness?: {
    implementedSuggestions: number;
    totalSuggestions: number;
    developerFeedback?: 'positive' | 'negative' | 'neutral';
    followUpRequired: boolean;
  };
}

/**
 * Track review metrics for quality analysis
 */
export class ReviewMetricsTracker {
  private metricsFile = '.continue/review-metrics.json';

  async recordReviewMetrics(metrics: ReviewMetrics): Promise<string> {
    const reviewId = this.generateReviewId(metrics);

    try {
      // Ensure .continue directory exists
      await fs.mkdir('.continue', { recursive: true });

      // Load existing metrics
      const existingMetrics = await this.loadMetrics();

      // Add new review
      const reviewRecord: ReviewQualityTracking = {
        reviewId,
        metrics
      };

      existingMetrics.push(reviewRecord);

      // Keep only last 100 reviews to prevent file bloat
      if (existingMetrics.length > 100) {
        existingMetrics.splice(0, existingMetrics.length - 100);
      }

      // Save updated metrics
      await fs.writeFile(
        this.metricsFile,
        JSON.stringify(existingMetrics, null, 2)
      );

      core.info(`Recorded review metrics with ID: ${reviewId}`);
      return reviewId;

    } catch (error) {
      core.warning(`Failed to record review metrics: ${error}`);
      return reviewId;
    }
  }

  async updateReviewEffectiveness(
    reviewId: string,
    effectiveness: ReviewQualityTracking['effectiveness']
  ): Promise<void> {
    try {
      const metrics = await this.loadMetrics();
      const review = metrics.find(r => r.reviewId === reviewId);

      if (review) {
        review.effectiveness = effectiveness;
        await fs.writeFile(
          this.metricsFile,
          JSON.stringify(metrics, null, 2)
        );
        core.info(`Updated effectiveness for review ${reviewId}`);
      }
    } catch (error) {
      core.warning(`Failed to update review effectiveness: ${error}`);
    }
  }

  async getReviewInsights(): Promise<{
    totalReviews: number;
    averageProcessingTime: number;
    averageIssuesFound: number;
    effectivenessRate: number;
    commonPatterns: string[];
  }> {
    try {
      const metrics = await this.loadMetrics();

      if (metrics.length === 0) {
        return {
          totalReviews: 0,
          averageProcessingTime: 0,
          averageIssuesFound: 0,
          effectivenessRate: 0,
          commonPatterns: []
        };
      }

      const totalReviews = metrics.length;
      const averageProcessingTime = metrics.reduce((sum, m) =>
        sum + m.metrics.metrics.processingTime, 0) / totalReviews;

      const averageIssuesFound = metrics.reduce((sum, m) => {
        const issues = m.metrics.metrics.issuesFound;
        return sum + issues.high + issues.medium + issues.low;
      }, 0) / totalReviews;

      const reviewsWithEffectiveness = metrics.filter(m => m.effectiveness);
      const effectivenessRate = reviewsWithEffectiveness.length > 0
        ? reviewsWithEffectiveness.reduce((sum, m) => {
            const rate = m.effectiveness!.implementedSuggestions /
                        Math.max(m.effectiveness!.totalSuggestions, 1);
            return sum + rate;
          }, 0) / reviewsWithEffectiveness.length
        : 0;

      const projectTypes = metrics.map(m => m.metrics.context.projectType);
      const commonPatterns = this.getMostCommon(projectTypes, 5);

      return {
        totalReviews,
        averageProcessingTime: Math.round(averageProcessingTime),
        averageIssuesFound: Math.round(averageIssuesFound * 10) / 10,
        effectivenessRate: Math.round(effectivenessRate * 100) / 100,
        commonPatterns
      };

    } catch (error) {
      core.warning(`Failed to generate review insights: ${error}`);
      return {
        totalReviews: 0,
        averageProcessingTime: 0,
        averageIssuesFound: 0,
        effectivenessRate: 0,
        commonPatterns: []
      };
    }
  }

  /**
   * Generate metrics summary for inclusion in review
   */
  async generateMetricsSummary(): Promise<string> {
    const insights = await this.getReviewInsights();

    if (insights.totalReviews === 0) {
      return '\n---\n*Review Metrics: This is the first review for this repository*';
    }

    let summary = '\n---\n## Review Metrics\n';
    summary += `- Total Reviews: ${insights.totalReviews}\n`;
    summary += `- Average Processing Time: ${insights.averageProcessingTime}s\n`;
    summary += `- Average Issues Found: ${insights.averageIssuesFound}\n`;

    if (insights.effectivenessRate > 0) {
      summary += `- Implementation Rate: ${(insights.effectivenessRate * 100).toFixed(0)}%\n`;
    }

    if (insights.commonPatterns.length > 0) {
      summary += `- Common Project Types: ${insights.commonPatterns.join(', ')}\n`;
    }

    return summary;
  }

  private async loadMetrics(): Promise<ReviewQualityTracking[]> {
    try {
      const content = await fs.readFile(this.metricsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  private generateReviewId(metrics: ReviewMetrics): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    return `${metrics.repository.replace('/', '-')}-${metrics.prNumber}-${timestamp}`;
  }

  private getMostCommon(arr: string[], limit: number): string[] {
    const counts = arr.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }
}

/**
 * Parse review response to extract metrics
 */
export function parseReviewMetrics(reviewText: string): {
  issuesFound: { high: number; medium: number; low: number };
  totalSuggestions: number;
} {
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
    /\*\*Suggestion\*\*/gi // explicit suggestions
  ];

  suggestionPatterns.forEach(pattern => {
    const matches = reviewText.match(pattern);
    if (matches) {
      totalSuggestions = Math.max(totalSuggestions, matches.length);
    }
  });

  return {
    issuesFound,
    totalSuggestions
  };
}

/**
 * Extract project type from context
 */
export function extractProjectType(
  frameworks: string[],
  libraries: string[]
): string {
  if (frameworks.includes('React')) {
    if (frameworks.includes('Next.js')) return 'Next.js Application';
    return 'React Application';
  }

  if (frameworks.includes('Vue')) return 'Vue.js Application';
  if (frameworks.includes('Angular')) return 'Angular Application';
  if (libraries.includes('TypeScript')) return 'TypeScript Project';

  return 'JavaScript Project';
}