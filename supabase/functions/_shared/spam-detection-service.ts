/**
 * Spam Detection Service
 * 
 * Provides spam analysis functionality for GitHub user profiles and pull requests.
 * Extracted from spam-detection edge function for reusability across multiple functions.
 * 
 * @module spam-detection-service
 */

/**
 * Spam indicator with severity level
 */
export interface SpamIndicator {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Result of spam detection analysis
 */
export interface SpamDetectionResult {
  spam_score: number;
  is_spam: boolean;
  flags: Record<string, number>;
  detected_at: string;
  confidence: number;
  reasons: string[];
}

/**
 * Pull request data for spam analysis
 */
export interface PullRequestData {
  id: string;
  title: string;
  body?: string;
  number: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  html_url: string;
  author: {
    id: number;
    login: string;
    created_at?: string;
    public_repos?: number;
    followers?: number;
    following?: number;
    bio?: string;
    company?: string;
    location?: string;
  };
  repository: {
    full_name: string;
  };
}

/**
 * Spam detection thresholds
 */
export const SPAM_THRESHOLDS = {
  LEGITIMATE: 25,
  WARNING: 50,
  LIKELY_SPAM: 75,
  DEFINITE_SPAM: 90,
} as const;

/**
 * Spam Detection Service
 * 
 * Analyzes GitHub pull requests for spam indicators using multiple detection methods:
 * - Content analysis (40%): Title/body patterns, links, formatting
 * - Account characteristics (40%): Age, activity, followers
 * - PR characteristics (20%): Size, files changed, patterns
 * 
 * @example
 * const service = new SpamDetectionService();
 * const result = await service.detectSpam(prData);
 * if (result.is_spam) {
 *   console.log('Spam detected: %s', result.reasons.join(', '));
 * }
 */
export class SpamDetectionService {
  /**
   * Analyzes a pull request for spam indicators
   * 
   * @param pr - Pull request data to analyze
   * @returns Spam detection results
   */
  detectSpam(pr: PullRequestData): SpamDetectionResult {
    try {
      if (!pr || !pr.author) {
        throw new Error('Invalid PR data: missing required fields');
      }

      // Analyze different aspects
      const contentScore = this.analyzeContent(pr);
      const accountScore = this.analyzeAccount(pr);
      const prScore = this.analyzePRCharacteristics(pr);

      // Calculate composite score
      const spamScore = Math.min(
        Math.round(contentScore * 0.4 + accountScore * 0.4 + prScore * 0.2),
        100
      );

      const isSpam = spamScore >= SPAM_THRESHOLDS.LIKELY_SPAM;
      const confidence = this.calculateConfidence(spamScore);
      const reasons = this.generateReasons(pr, spamScore);

      return {
        spam_score: spamScore,
        is_spam: isSpam,
        flags: { content_score: contentScore, account_score: accountScore, pr_score: prScore },
        detected_at: new Date().toISOString(),
        confidence,
        reasons,
      };
    } catch (error) {
      console.error('Error during spam detection:', error);
      return {
        spam_score: 0,
        is_spam: false,
        flags: {},
        detected_at: new Date().toISOString(),
        confidence: 0,
        reasons: ['Error during spam detection'],
      };
    }
  }

  /**
   * Analyzes content quality and patterns
   * 
   * @param pr - Pull request data
   * @returns Content spam score (0-100)
   */
  private analyzeContent(pr: PullRequestData): number {
    const description = pr.body || '';
    const title = pr.title || '';
    let score = 0;

    // Empty or very short description
    if (description.length === 0) score += 40;
    else if (description.length < 10) score += 30;
    else if (description.length < 20) score += 20;

    // Check for spam patterns
    const spamPatterns = [
      /^(fix|update|add|remove|change)\s*$/i,
      /hacktoberfest/i,
      /please merge/i,
      /first contribution/i,
      /beginner friendly/i,
    ];

    const text = `${title} ${description}`.toLowerCase();
    const matchedPatterns = spamPatterns.filter(pattern => pattern.test(text));
    score += matchedPatterns.length * 15;

    // Very generic titles
    if (/^(fix|update|add|remove|change|test)\s*\.?$/i.test(title)) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  /**
   * Analyzes account characteristics
   * 
   * @param pr - Pull request data
   * @returns Account spam score (0-100)
   */
  private analyzeAccount(pr: PullRequestData): number {
    let score = 0;
    const author = pr.author;

    // Account age analysis
    if (author.created_at) {
      const accountAge = (new Date().getTime() - new Date(author.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge <= 7) score += 50;
      else if (accountAge <= 30) score += 30;
      else if (accountAge <= 90) score += 15;
    }

    // Profile completeness
    const hasProfile = author.bio || author.company || author.location;
    if (!hasProfile) score += 20;

    // Repository and follower counts (if available)
    if (author.public_repos !== undefined && author.public_repos === 0) score += 15;
    if (author.followers !== undefined && author.followers === 0) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Analyzes PR characteristics
   * 
   * @param pr - Pull request data
   * @returns PR characteristics spam score (0-100)
   */
  private analyzePRCharacteristics(pr: PullRequestData): number {
    let score = 0;
    const totalChanges = pr.additions + pr.deletions;
    const descriptionLength = (pr.body || '').length;

    // Single file changes with no context
    if (pr.changed_files === 1 && descriptionLength < 20) {
      score += 30;
    }

    // Large changes with inadequate description
    if (totalChanges > 100 && descriptionLength < 50) {
      score += 25;
    }

    // Very large PRs (often spam)
    if (pr.changed_files > 20) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculates confidence level based on spam score
   * 
   * @param spamScore - Calculated spam score
   * @returns Confidence level (0-1)
   */
  private calculateConfidence(spamScore: number): number {
    if (spamScore > 80 || spamScore < 20) return 0.8;
    if (spamScore > 70 || spamScore < 30) return 0.7;
    return 0.6;
  }

  /**
   * Generates human-readable reasons for spam detection
   * 
   * @param pr - Pull request data
   * @param spamScore - Calculated spam score
   * @returns Array of reason strings
   */
  private generateReasons(pr: PullRequestData, spamScore: number): string[] {
    const reasons: string[] = [];

    if ((pr.body || '').length === 0) {
      reasons.push('Empty description');
    } else if ((pr.body || '').length < 10) {
      reasons.push('Very short description');
    }

    if (/^(fix|update|add|remove|change|test)\s*\.?$/i.test(pr.title)) {
      reasons.push('Generic title');
    }

    if (pr.author.created_at) {
      const accountAge = (new Date().getTime() - new Date(pr.author.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge <= 7) {
        reasons.push(`Very new account (${Math.round(accountAge)} days old)`);
      } else if (accountAge <= 30) {
        reasons.push(`New account (${Math.round(accountAge)} days old)`);
      }
    }

    if (pr.changed_files === 1 && (pr.body || '').length < 20) {
      reasons.push('Single file change with no context');
    }

    if (spamScore >= SPAM_THRESHOLDS.LIKELY_SPAM) {
      reasons.push('Multiple spam indicators detected');
    }

    return reasons.length > 0 ? reasons : ['Automated analysis completed'];
  }
}
