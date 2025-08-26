import { PullRequestData, SpamFlags, CONTENT_THRESHOLDS } from './types';
import { TemplateDetector, SPAM_PATTERNS } from './templates/CommonTemplates';
import { PRTemplateService } from './PRTemplateService';

export class PRAnalysisService {
  private templateDetector = new TemplateDetector();
  private prTemplateService = new PRTemplateService();

  /**
   * Analyze PR content quality and characteristics
   */
  async analyzePR(pr: PullRequestData): Promise<{
    content_quality: SpamFlags['content_quality'];
    pr_characteristics: SpamFlags['pr_characteristics'];
    template_match: SpamFlags['template_match'];
  }> {
    const contentQuality = this.analyzeContentQuality(pr);
    const prCharacteristics = this.analyzePRCharacteristics(pr);
    const templateMatch = await this.analyzeTemplateMatch(pr);

    return {
      content_quality: contentQuality,
      pr_characteristics: prCharacteristics,
      template_match: templateMatch,
    };
  }

  /**
   * Analyze the quality of PR description and title
   */
  private analyzeContentQuality(pr: PullRequestData): SpamFlags['content_quality'] {
    const description = pr.body || '';
    const title = pr.title || '';
    const combinedText = `${title} ${description}`.trim();

    const descriptionLength = description.length;

    // Check for meaningful content indicators
    const hasMeaningfulContent = this.hasMeaningfulContent(combinedText);

    // Calculate quality score based on various factors
    let qualityScore = 0;

    // Length score (0-0.3)
    if (descriptionLength >= CONTENT_THRESHOLDS.MIN_DESCRIPTION_LENGTH) {
      qualityScore += 0.3;
    } else if (descriptionLength > 0) {
      qualityScore += (descriptionLength / CONTENT_THRESHOLDS.MIN_DESCRIPTION_LENGTH) * 0.3;
    }

    // Meaningful content score (0-0.4)
    if (hasMeaningfulContent) {
      qualityScore += 0.4;
    }

    // Title quality score (0-0.3)
    const titleQuality = this.analyzeTitleQuality(title);
    qualityScore += titleQuality * 0.3;

    return {
      description_length: descriptionLength,
      has_meaningful_content: hasMeaningfulContent,
      quality_score: Math.min(qualityScore, 1.0),
    };
  }

  /**
   * Check if content contains meaningful information
   */
  private hasMeaningfulContent(text: string): boolean {
    if (!text || text.length < 5) return false;

    const normalized = text.toLowerCase().trim();

    // Check against spam patterns
    for (const pattern of Object.values(SPAM_PATTERNS)) {
      if (pattern.test(normalized)) {
        return false;
      }
    }

    // Look for meaningful indicators
    const meaningfulIndicators = [
      /fix(es|ed)?\s+#?\d+/i, // References to issues
      /close(s|d)?\s+#?\d+/i, // Closes issues
      /implement(s|ed)?/i, // Implementation details
      /add(s|ed)?\s+\w{4,}/i, // Adds something specific
      /updat(e|ed)?\s+\w{4,}/i, // Updates something specific
      /remov(e|ed)?\s+\w{4,}/i, // Removes something specific
      /refactor/i, // Refactoring
      /performance/i, // Performance improvements
      /security/i, // Security fixes
      /test(s|ing)?/i, // Testing related
      /documentation/i, // Documentation
      /feature/i, // Feature additions
      /bug/i, // Bug fixes
    ];

    const hasIndicators = meaningfulIndicators.some((pattern) => pattern.test(normalized));

    // Check for code snippets, file paths, or technical terms
    const hasTechnicalContent =
      /\.(js|ts|py|java|cpp|c|h|css|html|md|json|yml|yaml)|\w+\/\w+|`[^`]+`/i.test(text);

    // Check word diversity (not just repeated words)
    const words = normalized.split(/\s+/).filter((word) => word.length > 2);
    const uniqueWords = new Set(words);
    const wordDiversity = words.length > 0 ? uniqueWords.size / words.length : 0;

    return hasIndicators || hasTechnicalContent || (words.length >= 5 && wordDiversity > 0.6);
  }

  /**
   * Analyze title quality
   */
  private analyzeTitleQuality(title: string): number {
    if (!title || title.length === 0) return 0;

    const normalized = title.toLowerCase().trim();
    let score = 0.5; // Base score for having a title

    // Check length appropriateness
    if (title.length >= 10 && title.length <= 100) {
      score += 0.3;
    }

    // Check for specific keywords that indicate quality
    const qualityKeywords = [
      /fix/i,
      /add/i,
      /update/i,
      /implement/i,
      /remove/i,
      /refactor/i,
      /improve/i,
      /enhance/i,
      /optimize/i,
    ];

    if (qualityKeywords.some((pattern) => pattern.test(normalized))) {
      score += 0.2;
    }

    // Penalize very generic titles
    const genericPatterns = [/^(update|fix|change|test)\.?$/i, /^.{1,3}$/];

    if (genericPatterns.some((pattern) => pattern.test(normalized))) {
      score = Math.max(score - 0.4, 0);
    }

    return Math.min(score, 1.0);
  }

  /**
   * Analyze PR size and documentation ratio
   */
  private analyzePRCharacteristics(pr: PullRequestData): SpamFlags['pr_characteristics'] {
    const totalChanges = pr.additions + pr.deletions;
    const filesChanged = pr.changed_files || 0;
    const descriptionLength = (pr.body || '').length;

    // Calculate size vs documentation ratio
    let sizeDocRatio = 0;
    if (totalChanges > 0) {
      sizeDocRatio = descriptionLength / totalChanges;
    }

    // Check if PR has context
    const hasContext = this.prHasContext(pr);

    // Analyze commit quality (simplified - would need commit messages for full analysis)
    const commitQualityScore = this.estimateCommitQuality(pr);

    return {
      size_vs_documentation_ratio: sizeDocRatio,
      files_changed: filesChanged,
      has_context: hasContext,
      commit_quality_score: commitQualityScore,
    };
  }

  /**
   * Check if PR provides adequate context
   */
  private prHasContext(pr: PullRequestData): boolean {
    const description = pr.body || '';
    const title = pr.title || '';
    const combinedLength = description.length + title.length;

    // Very small PRs should have proportionally more description
    const totalChanges = pr.additions + pr.deletions;

    if (totalChanges <= 10) {
      return combinedLength >= 20; // Small changes need some explanation
    } else if (totalChanges <= 100) {
      return combinedLength >= 50; // Medium changes need more explanation
    } else {
      return combinedLength >= 100; // Large changes need substantial explanation
    }
  }

  /**
   * Estimate commit quality based on available PR data
   */
  private estimateCommitQuality(pr: PullRequestData): number {
    // This is a simplified estimation since we don't have commit messages
    // In a full implementation, we'd analyze actual commit messages

    let score = 0.5; // Base score

    // PRs with many small files might indicate focused changes
    const avgChangesPerFile =
      pr.changed_files > 0 ? (pr.additions + pr.deletions) / pr.changed_files : 0;

    if (avgChangesPerFile > 0 && avgChangesPerFile < 50) {
      score += 0.2; // Focused changes are generally better
    }

    // Very large PRs with many files might be problematic
    if (pr.changed_files > 20 && pr.additions + pr.deletions > 1000) {
      score -= 0.3;
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  /**
   * Analyze template matching with repository-specific patterns
   */
  private async analyzeTemplateMatch(pr: PullRequestData): Promise<SpamFlags['template_match']> {
    const description = pr.body || '';
    const title = pr.title || '';
    const combinedText = `${title}\n${description}`.trim();

    // First check repository-specific patterns
    let repositoryMatchResult = null;
    try {
      // Extract repository info from PR
      const repoFullName = pr.repository?.full_name;
      if (repoFullName) {
        const [owner, name] = repoFullName.split('/');
        if (owner && name) {
          // Get repository ID from database
          const { supabase } = await import('@/lib/supabase');
          const { data: repo } = await supabase
            .from('repositories')
            .select('id')
            .eq('owner', owner)
            .eq('name', name)
            .maybeSingle();

          if (repo?.id) {
            repositoryMatchResult = await this.prTemplateService.checkRepositorySpamPatterns(
              repo.id,
              combinedText,
            );
          }
        }
      }
    } catch () {
      console.warn('Failed to check repository-specific patterns:', _error);
    }

    // Fallback to common template detection
    const commonTemplateMatch = this.templateDetector.detectTemplateMatch(combinedText);

    // Use repository-specific results if available and confident
    if (repositoryMatchResult?.is_match && repositoryMatchResult.overall_confidence > 0.7) {
      return {
        is_match: true,
        template_id: `repository_specific_${repositoryMatchResult.matched_patterns[0]?.pattern_type}`,
        similarity_score: repositoryMatchResult.overall_confidence,
      };
    }

    // Otherwise use common template detection
    return {
      is_match: commonTemplateMatch.is_match,
      template_id: commonTemplateMatch.template_id,
      similarity_score: commonTemplateMatch.similarity_score,
    };
  }
}
