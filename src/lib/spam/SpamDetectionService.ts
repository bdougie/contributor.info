import {
  PullRequestData,
  SpamDetectionResult,
  SpamFlags,
  DETECTION_WEIGHTS,
  SPAM_THRESHOLDS,
} from './types';
import { PRAnalysisService } from './PRAnalysisService';
import { AccountAnalysisService } from './AccountAnalysisService';

export class SpamDetectionService {
  private prAnalysisService = new PRAnalysisService();
  private accountAnalysisService = new AccountAnalysisService();

  /**
   * Main method to detect spam in a pull request
   */
  async detectSpam(pr: PullRequestData): Promise<SpamDetectionResult> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!pr || !pr.author) {
        throw new Error('Invalid PR _data: missing required fields');
      }

      // Analyze different aspects of the PR
      const prAnalysis = await this.prAnalysisService.analyzePR(pr);
      const accountFlags = this.accountAnalysisService.analyzeAccount(pr);

      // Combine all flags
      const flags: SpamFlags = {
        template_match: prAnalysis.template_match,
        content_quality: prAnalysis.content_quality,
        account_flags: accountFlags,
        pr_characteristics: prAnalysis.pr_characteristics,
      };

      // Calculate composite spam score
      const spamScore = this.calculateSpamScore(flags);

      // Determine if it's spam based on thresholds
      const isSpam = spamScore >= SPAM_THRESHOLDS.LIKELY_SPAM;

      // Calculate confidence based on multiple factors
      const confidence = this.calculateConfidence(flags, spamScore);

      // Generate human-readable reasons
      const reasons = this.generateReasons(flags, spamScore);

      const result: SpamDetectionResult = {
        spam_score: Math.round(spamScore),
        is_spam: isSpam,
        flags,
        detected_at: new Date().toISOString(),
        confidence,
        reasons,
      };

      // Log performance
      const processingTime = Date.now() - startTime;
      if (processingTime > 100) {
        console.warn(`Spam detection took ${processingTime}ms for PR ${pr.id}`);
      }

      return result;
    } catch () {
      console.error('Error during spam detection:', _error);

      // Return safe default on error
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
   * Calculate composite spam score from all detection flags
   */
  private calculateSpamScore(flags: SpamFlags): number {
    let score = 0;

    // Template matching score (0-100 * weight)
    if (flags.template_match?.is_match) {
      const templateScore = (flags.template_match.similarity_score || 1.0) * 100;
      score += templateScore * DETECTION_WEIGHTS.TEMPLATE_MATCH;
    }

    // Content quality score (0-100 * weight)
    if (flags.content_quality) {
      const qualityScore = (1 - flags.content_quality.quality_score) * 100;
      score += qualityScore * DETECTION_WEIGHTS.CONTENT_QUALITY;
    }

    // Account patterns score (0-100 * weight)
    if (flags.account_flags) {
      const accountScore = this.calculateAccountSpamScore(flags.account_flags);
      score += accountScore * DETECTION_WEIGHTS.ACCOUNT_PATTERNS;
    }

    // PR characteristics score (0-100 * weight)
    if (flags.pr_characteristics) {
      const prScore = this.calculatePRCharacteristicsScore(flags.pr_characteristics);
      score += prScore * DETECTION_WEIGHTS.PR_CHARACTERISTICS;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate account-based spam score
   */
  private calculateAccountSpamScore(accountFlags: SpamFlags['account_flags']): number {
    if (!accountFlags) return 0;

    let score = 0;

    // New account penalty
    if (accountFlags.is_new_account) {
      score += 50;

      // Extra penalty for very new accounts
      if (accountFlags.account_age_days <= 7) {
        score += 25;
      }
    }

    // Incomplete profile penalty
    if (!accountFlags.has_profile__data) {
      score += 30;
    }

    // Low contribution history penalty
    const contributionScore = accountFlags.contribution_history_score || 0;
    score += (1 - contributionScore) * 40;

    return Math.min(score, 100);
  }

  /**
   * Calculate PR characteristics spam score
   */
  private calculatePRCharacteristicsScore(prFlags: SpamFlags['pr_characteristics']): number {
    if (!prFlags) return 0;

    let score = 0;

    // No context penalty
    if (!prFlags.has_context) {
      score += 40;
    }

    // Poor commit quality penalty
    const commitQuality = prFlags.commit_quality_score || 0;
    score += (1 - commitQuality) * 30;

    // Large PR with poor documentation ratio
    if (prFlags.files_changed > 10 && prFlags.size_vs_documentation_ratio < 0.1) {
      score += 20;
    }

    // Single file changes with no context (common spam pattern)
    if (prFlags.files_changed === 1 && !prFlags.has_context) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate confidence in the spam detection result
   */
  private calculateConfidence(flags: SpamFlags, spamScore: number): number {
    let confidence = 0.5; // Base confidence

    // High confidence indicators
    if (flags.template_match?.is_match && (flags.template_match.similarity_score || 0) > 0.9) {
      confidence += 0.3;
    }

    if (flags.account_flags?.is_new_account && !flags.account_flags.has_profile_data) {
      confidence += 0.2;
    }

    if (flags.content_quality && flags.content_quality.quality_score < 0.2) {
      confidence += 0.2;
    }

    // Moderate confidence indicators
    if (flags.pr_characteristics && !flags.pr_characteristics.has_context) {
      confidence += 0.1;
    }

    // Score-based confidence adjustment
    if (spamScore > 80 || spamScore < 20) {
      confidence += 0.1; // More confident in extreme scores
    }

    // Ensure minimum confidence for legitimate PRs
    if (spamScore < 25) {
      confidence = Math.max(confidence, 0.6);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate human-readable reasons for the spam classification
   */
  private generateReasons(flags: SpamFlags, spamScore: number): string[] {
    const reasons: string[] = [];

    // Template matching reasons
    if (flags.template_match?.is_match) {
      const similarity = flags.template_match.similarity_score || 0;
      if (similarity >= 0.9) {
        reasons.push(`Matches known spam template (${Math.round(similarity * 100)}% similarity)`);
      } else {
        reasons.push(`Similar to spam patterns (${Math.round(similarity * 100)}% similarity)`);
      }
    }

    // Content quality reasons
    if (flags.content_quality) {
      const quality = flags.content_quality.quality_score;
      if (quality < 0.3) {
        reasons.push('Very low content quality');
      } else if (quality < 0.5) {
        reasons.push('Poor content quality');
      }

      if (flags.content_quality.description_length === 0) {
        reasons.push('Empty description');
      } else if (flags.content_quality.description_length < 10) {
        reasons.push('Extremely short description');
      }

      if (!flags.content_quality.has_meaningful_content) {
        reasons.push('No meaningful content detected');
      }
    }

    // Account reasons
    if (flags.account_flags) {
      if (flags.account_flags.is_new_account) {
        const days = flags.account_flags.account_age_days;
        if (days <= 7) {
          reasons.push(`Very new account (${days} days old)`);
        } else {
          reasons.push(`New account (${days} days old)`);
        }
      }

      if (!flags.account_flags.has_profile__data) {
        reasons.push('Incomplete GitHub profile');
      }

      const contributionScore = flags.account_flags.contribution_history_score;
      if (contributionScore < 0.2) {
        reasons.push('No contribution history');
      } else if (contributionScore < 0.4) {
        reasons.push('Limited contribution history');
      }
    }

    // PR characteristics reasons
    if (flags.pr_characteristics) {
      if (!flags.pr_characteristics.has_context) {
        reasons.push('No context or explanation provided');
      }

      if (flags.pr_characteristics.files_changed === 1) {
        reasons.push('Single file change');
      }

      const commitQuality = flags.pr_characteristics.commit_quality_score;
      if (commitQuality < 0.3) {
        reasons.push('Poor commit quality indicators');
      }
    }

    // Overall score reason
    if (spamScore >= SPAM_THRESHOLDS.DEFINITE_SPAM) {
      reasons.push('Multiple spam indicators detected');
    } else if (spamScore >= SPAM_THRESHOLDS.LIKELY_SPAM) {
      reasons.push('Several spam indicators present');
    }

    return reasons.length > 0 ? reasons : ['Automated analysis completed'];
  }

  /**
   * Batch process multiple PRs for spam detection
   */
  async detectSpamBatch(prs: PullRequestData[]): Promise<SpamDetectionResult[]> {
    const results: SpamDetectionResult[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
      const batchPromises = batch.map((pr) => this.detectSpam(pr));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches to prevent overwhelming
      if (i + batchSize < prs.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    return results;
  }

  /**
   * Get spam detection statistics
   */
  getDetectionStats(results: SpamDetectionResult[]): {
    total: number;
    spam_count: number;
    spam_percentage: number;
    avg_score: number;
    avg_confidence: number;
    by_threshold: Record<string, number>;
  } {
    const total = results.length;
    const spamCount = results.filter((r) => r.is_spam).length;
    const avgScore = results.reduce((sum, r) => sum + r.spam_score, 0) / total;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / total;

    const byThreshold = {
      legitimate: results.filter((r) => r.spam_score <= SPAM_THRESHOLDS.LEGITIMATE).length,
      warning: results.filter(
        (r) => r.spam_score > SPAM_THRESHOLDS.LEGITIMATE && r.spam_score <= SPAM_THRESHOLDS.WARNING,
      ).length,
      likely_spam: results.filter(
        (r) =>
          r.spam_score > SPAM_THRESHOLDS.WARNING && r.spam_score <= SPAM_THRESHOLDS.LIKELY_SPAM,
      ).length,
      definite_spam: results.filter((r) => r.spam_score > SPAM_THRESHOLDS.LIKELY_SPAM).length,
    };

    return {
      total,
      spam_count: spamCount,
      spam_percentage: (spamCount / total) * 100,
      avg_score: Math.round(avgScore * 10) / 10,
      avg_confidence: Math.round(avgConfidence * 100) / 100,
      by_threshold: byThreshold,
    };
  }
}
