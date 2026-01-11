import { PullRequest, QuadrantDistribution } from './types';

export interface ContributionMetrics {
  x: number;
  y: number;
  quadrant: 'refinement' | 'new' | 'refactoring' | 'maintenance';
}

export class ContributionAnalyzer {
  // Track counts of each quadrant type for distribution calculation
  private static quadrantCounts = {
    refinement: 0,
    new: 0,
    refactoring: 0,
    maintenance: 0,
  };

  // Cache for PR analysis results to avoid re-computing (WeakMap allows GC of unused PRs)
  private static analysisCache = new WeakMap<PullRequest, ContributionMetrics>();

  static analyze(pr: PullRequest): ContributionMetrics {
    // Check cache first to avoid re-analyzing the same PR
    const cached = this.analysisCache.get(pr);
    if (cached) {
      // Still increment the quadrant count for distribution tracking
      this.quadrantCounts[cached.quadrant]++;
      return cached;
    }

    const { isConfig, isCodePresent, codeAdditions, codeDeletions } = this.calculateMetrics(pr);

    let result: ContributionMetrics;

    // If PR only contains configuration/documentation files, it's maintenance
    if (isConfig && !isCodePresent) {
      this.quadrantCounts.maintenance++;
      result = this.getMaintenanceMetrics();
      this.analysisCache.set(pr, result);
      return result;
    }

    // If PR contains code, analyze based on code changes only
    const total = codeAdditions + codeDeletions;
    if (total === 0) {
      this.quadrantCounts.maintenance++;
      result = this.getMaintenanceMetrics();
      this.analysisCache.set(pr, result);
      return result;
    }

    const additionRatio = codeAdditions / total;
    const deletionRatio = codeDeletions / total;

    if (additionRatio > 0.7) {
      this.quadrantCounts.new++;
      result = this.getNewMetrics(additionRatio, deletionRatio);
    } else if (deletionRatio > 0.7) {
      this.quadrantCounts.refinement++;
      result = this.getRefinementMetrics(additionRatio, deletionRatio);
    } else {
      this.quadrantCounts.refactoring++;
      result = this.getRefactoringMetrics(additionRatio, deletionRatio);
    }

    // Cache and return the result
    this.analysisCache.set(pr, result);
    return result;
  }

  // Reset counts before analyzing a new set of PRs
  static resetCounts(): void {
    this.quadrantCounts = {
      refinement: 0,
      new: 0,
      refactoring: 0,
      maintenance: 0,
    };
  }

  // Get the distribution percentages for each quadrant
  static getDistribution(): QuadrantDistribution {
    const total =
      this.quadrantCounts.refinement +
      this.quadrantCounts.new +
      this.quadrantCounts.refactoring +
      this.quadrantCounts.maintenance;

    if (total === 0) {
      return {
        label: 'Contribution Distribution',
        value: 0,
        percentage: 0,
        refinement: 25,
        new: 25,
        refactoring: 25,
        maintenance: 25,
      };
    }

    // Create a distribution object conforming to the updated QuadrantDistribution interface
    return {
      label: 'Contribution Distribution',
      value: total,
      percentage: 100,
      refinement: (this.quadrantCounts.refinement / total) * 100,
      new: (this.quadrantCounts.new / total) * 100,
      refactoring: (this.quadrantCounts.refactoring / total) * 100,
      maintenance: (this.quadrantCounts.maintenance / total) * 100,
    };
  }

  // Get the raw counts for each quadrant
  static getCounts() {
    return { ...this.quadrantCounts };
  }

  private static calculateMetrics(pr: PullRequest) {
    let isConfig = false;
    let isCodePresent = true;
    let codeAdditions = pr.additions || 0;
    let codeDeletions = pr.deletions || 0;
    let configAdditions = 0;
    let configDeletions = 0;

    // Check if PR title suggests it's documentation/config only
    const prTitleLower = pr.title.toLowerCase();
    if (
      prTitleLower.includes('readme') ||
      prTitleLower.includes('documentation') ||
      prTitleLower.includes('docs') ||
      prTitleLower.includes('config') ||
      prTitleLower.includes('.md') ||
      prTitleLower.includes('markdown')
    ) {
      isConfig = true;
      isCodePresent = false;
      configAdditions = pr.additions || 0;
      configDeletions = pr.deletions || 0;
      codeAdditions = 0;
      codeDeletions = 0;
    }

    return {
      isConfig,
      isCodePresent,
      codeAdditions,
      codeDeletions,
      configAdditions,
      configDeletions,
    };
  }

  private static getMaintenanceMetrics(): ContributionMetrics {
    // Maintenance is spread across the bottom-left quadrant
    return {
      x: Math.random() * 40 + 5, // 5-45%
      y: Math.random() * 40 + 55, // 55-95%
      quadrant: 'maintenance',
    };
  }

  private static getNewMetrics(additionRatio: number, deletionRatio: number): ContributionMetrics {
    return {
      // Higher x (more additions) with some variance
      x: Math.min(95, additionRatio * 100 + Math.random() * 10),
      // Lower y (fewer deletions) with some variance
      y: Math.max(5, (1 - deletionRatio) * 50 - Math.random() * 10),
      quadrant: 'new',
    };
  }

  private static getRefinementMetrics(
    additionRatio: number,
    deletionRatio: number
  ): ContributionMetrics {
    return {
      // Lower x (fewer additions) with some variance
      x: Math.max(5, additionRatio * 100 - Math.random() * 10),
      // Lower y (more focused changes) with some variance
      y: Math.max(5, deletionRatio * 50 - Math.random() * 10),
      quadrant: 'refinement',
    };
  }

  private static getRefactoringMetrics(
    additionRatio: number,
    deletionRatio: number
  ): ContributionMetrics {
    return {
      // Higher x (more additions) with some variance
      x: Math.min(95, additionRatio * 100 + Math.random() * 10),
      // Lower y (fewer deletions) with some variance
      y: Math.max(5, deletionRatio * 100 - Math.random() * 10),
      quadrant: 'refactoring',
    };
  }
}
