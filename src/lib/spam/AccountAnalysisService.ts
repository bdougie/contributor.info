import { 
  PullRequestData, 
  SpamFlags, 
  ACCOUNT_THRESHOLDS 
} from './types';

export class AccountAnalysisService {
  /**
   * Analyze contributor account patterns for spam indicators
   */
  analyzeAccount(pr: PullRequestData): SpamFlags['account_flags'] {
    const author = pr.author;
    const accountAgeInDays = this.calculateAccountAge(author.created_at);
    const isNewAccount = this.isNewAccount(accountAgeInDays);
    const hasProfileData = this.hasCompletedProfile(author);
    const contributionScore = this.calculateContributionHistoryScore(author);

    return {
      account_age_days: accountAgeInDays,
      is_new_account: isNewAccount,
      has_profile_data: hasProfileData,
      contribution_history_score: contributionScore,
    };
  }

  /**
   * Calculate account age in days
   */
  private calculateAccountAge(createdAt?: string): number {
    if (!createdAt) {
      // If we don't have creation date, assume it's recent for safety
      return 0;
    }

    const accountCreated = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - accountCreated.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Determine if account is considered "new" and potentially suspicious
   */
  private isNewAccount(accountAgeInDays: number): boolean {
    return accountAgeInDays <= ACCOUNT_THRESHOLDS.NEW_ACCOUNT_DAYS;
  }

  /**
   * Check if user has completed their GitHub profile
   */
  private hasCompletedProfile(author: PullRequestData['author']): boolean {
    let profileScore = 0;
    const maxScore = 5;

    // Check various profile completeness indicators
    if (author.bio && author.bio.trim().length > 10) {
      profileScore += 1;
    }

    if (author.company && author.company.trim().length > 0) {
      profileScore += 1;
    }

    if (author.location && author.location.trim().length > 0) {
      profileScore += 1;
    }

    if (author.public_repos && author.public_repos > 0) {
      profileScore += 1;
    }

    if (author.followers && author.followers > 0) {
      profileScore += 1;
    }

    const completionRatio = profileScore / maxScore;
    return completionRatio >= ACCOUNT_THRESHOLDS.MIN_PROFILE_SCORE;
  }

  /**
   * Calculate a score based on contribution history indicators
   */
  private calculateContributionHistoryScore(author: PullRequestData['author']): number {
    let score = 0;

    // Repository count score (0-0.3)
    const repoCount = author.public_repos || 0;
    if (repoCount > 0) {
      score += Math.min(repoCount / 10, 0.3);
    }

    // Follower count score (0-0.2)
    const followerCount = author.followers || 0;
    if (followerCount > 0) {
      score += Math.min(followerCount / 50, 0.2);
    }

    // Following count score (0-0.1)
    const followingCount = author.following || 0;
    if (followingCount > 0) {
      score += Math.min(followingCount / 100, 0.1);
    }

    // Profile completeness score (0-0.4)
    const hasProfile = this.hasCompletedProfile(author);
    if (hasProfile) {
      score += 0.4;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Check for patterns that might indicate automated or bot accounts
   */
  private checkForBotPatterns(author: PullRequestData['author']): {
    likely_bot: boolean;
    bot_indicators: string[];
  } {
    const indicators: string[] = [];
    const login = author.login.toLowerCase();

    // Check username patterns
    if (login.includes('bot') || login.includes('automated')) {
      indicators.push('username_contains_bot');
    }

    // Check for numeric suffixes that might indicate generated accounts
    if (/\d{3,}$/.test(login)) {
      indicators.push('numeric_suffix');
    }

    // Check for very new accounts with high activity
    const repoCount = author.public_repos || 0;
    if (repoCount > 20) {
      // This would need account age to be meaningful
      // indicators.push('high_activity_new_account');
    }

    // Check for accounts with no followers but many repos
    const followers = author.followers || 0;
    if (followers === 0 && repoCount > 10) {
      indicators.push('no_followers_many_repos');
    }

    return {
      likely_bot: indicators.length >= 2,
      bot_indicators: indicators,
    };
  }

  /**
   * Analyze account for suspicious creation patterns
   */
  analyzeCreationPatterns(author: PullRequestData['author']): {
    is_suspicious: boolean;
    risk_factors: string[];
  } {
    const riskFactors: string[] = [];
    const accountAge = this.calculateAccountAge(author.created_at);

    // Very new account (less than 7 days)
    if (accountAge <= ACCOUNT_THRESHOLDS.SUSPICIOUS_ACCOUNT_DAYS) {
      riskFactors.push('very_new_account');
    }

    // Empty or minimal profile
    if (!this.hasCompletedProfile(author)) {
      riskFactors.push('incomplete_profile');
    }

    // No repositories but making contributions
    if (!author.public_repos || author.public_repos === 0) {
      riskFactors.push('no_public_repos');
    }

    // No followers or following (might indicate throwaway account)
    if ((!author.followers || author.followers === 0) && 
        (!author.following || author.following === 0)) {
      riskFactors.push('no_social_connections');
    }

    // Check for bot patterns
    const botAnalysis = this.checkForBotPatterns(author);
    if (botAnalysis.likely_bot) {
      riskFactors.push('bot_like_behavior');
    }

    return {
      is_suspicious: riskFactors.length >= 2,
      risk_factors: riskFactors,
    };
  }

  /**
   * Calculate overall account trust score
   */
  calculateTrustScore(pr: PullRequestData): number {
    const accountFlags = this.analyzeAccount(pr);
    const creationPatterns = this.analyzeCreationPatterns(pr.author);

    let trustScore = 0.5; // Start with neutral score

    // Boost score for established accounts
    if (accountFlags && !accountFlags.is_new_account) {
      trustScore += 0.2;
    }

    // Boost score for complete profiles
    if (accountFlags && accountFlags.has_profile__data) {
      trustScore += 0.2;
    }

    // Add contribution history score
    if (accountFlags) {
      trustScore += accountFlags.contribution_history_score * 0.3;
    }

    // Penalize suspicious patterns
    if (creationPatterns.is_suspicious) {
      trustScore -= 0.4;
    }

    // Penalize very new accounts making contributions
    if (accountFlags && accountFlags.account_age_days <= ACCOUNT_THRESHOLDS.SUSPICIOUS_ACCOUNT_DAYS) {
      trustScore -= 0.3;
    }

    return Math.max(0, Math.min(trustScore, 1.0));
  }
}