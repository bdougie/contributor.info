import { PullRequest, QuadrantDistribution } from './types';

export interface ContributionMetrics {
  x: number;
  y: number;
  quadrant: 'refinement' | 'new' | 'refactoring' | 'maintenance';
}

const NON_CODE_EXTENSIONS = new Set([
  'yaml',
  'yml',
  'json',
  'toml',
  'ini',
  'conf',
  'md',
  'txt',
  'dockerfile',
  'dockerignore',
  'gitignore',
  'env',
  'example',
  'template',
  'lock',
  'sum',
  'mod',
]);

export class ContributionAnalyzer {
  // Track counts of each quadrant type for distribution calculation
  private static quadrantCounts = {
    refinement: 0,
    new: 0,
    refactoring: 0,
    maintenance: 0,
  };

  static analyze(pr: PullRequest): ContributionMetrics {
    const { isConfig, isCodePresent, codeAdditions, codeDeletions } = this.calculateMetrics(pr);

    // If PR only contains configuration/documentation files, it's maintenance
    if (isConfig && !isCodePresent) {
      this.quadrantCounts.maintenance++;
      return this.getMaintenanceMetrics();
    }

    // If PR contains code, analyze based on code changes only
    const total = codeAdditions + codeDeletions;
    if (total === 0) {
      this.quadrantCounts.maintenance++;
      return this.getMaintenanceMetrics();
    }

    const additionRatio = codeAdditions / total;
    const deletionRatio = codeDeletions / total;

    if (additionRatio > 0.7) {
      this.quadrantCounts.new++;
      return this.getNewMetrics(additionRatio, deletionRatio);
    } else if (deletionRatio > 0.7) {
      this.quadrantCounts.refinement++;
      return this.getRefinementMetrics(additionRatio, deletionRatio);
    } else {
      this.quadrantCounts.refactoring++;
      return this.getRefactoringMetrics(additionRatio, deletionRatio);
    }
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
    let isConfig = true;
    let isCodePresent = false;
    let codeAdditions = 0;
    let codeDeletions = 0;
    let configAdditions = 0;
    let configDeletions = 0;
    let hasMdFile = false;

    if (pr.commits && pr.commits.length > 0) {
      for (const commit of pr.commits) {
        if (NON_CODE_EXTENSIONS.has(commit.language)) {
          // Track config file changes separately
          configAdditions += commit.additions;
          configDeletions += commit.deletions;

          // Specifically track if there are any .md files
          if (commit.language === 'md') {
            hasMdFile = true;
          }
        } else {
          // This is a code file
          isConfig = false;
          isCodePresent = true;
          codeAdditions += commit.additions;
          codeDeletions += commit.deletions;
        }
      }

      // If this is only .md files or other non-code files, ensure it's maintenance
      if (!isCodePresent && configAdditions + configDeletions > 0) {
        isConfig = true;
      }

      // Special case for documentation-only commits
      if (hasMdFile && !isCodePresent) {
        isConfig = true;
      }
    } else {
      // If no commits data, try to infer from PR title
      const prTitleLower = pr.title.toLowerCase();

      // Check if PR title suggests it's documentation/config only
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
        configAdditions = pr.additions;
        configDeletions = pr.deletions;
      } else {
        // If no hints in title, fall back to PR level metrics as code
        codeAdditions = pr.additions;
        codeDeletions = pr.deletions;
        isConfig = false;
        isCodePresent = pr.additions > 0 || pr.deletions > 0;
      }
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
