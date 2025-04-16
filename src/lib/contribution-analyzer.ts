import { PullRequest } from './types';

export interface ContributionMetrics {
  x: number;
  y: number;
  quadrant: 'refinement' | 'newStuff' | 'refactoring' | 'maintenance';
}

const NON_CODE_EXTENSIONS = new Set([
  'yaml', 'yml', 'json', 'toml', 'ini', 'conf',
  'md', 'txt', 'dockerfile', 'dockerignore',
  'gitignore', 'env', 'example', 'template',
  'lock', 'sum', 'mod'
]);

export class ContributionAnalyzer {
  static analyze(pr: PullRequest): ContributionMetrics {
    const { isConfig, additions, deletions } = this.calculateMetrics(pr);
    
    if (isConfig) {
      return this.getMaintenanceMetrics();
    }

    const total = additions + deletions;
    if (total === 0) return this.getMaintenanceMetrics();

    const additionRatio = additions / total;
    const deletionRatio = deletions / total;

    if (additionRatio > 0.7) {
      return this.getNewStuffMetrics(additionRatio, deletionRatio);
    } else if (deletionRatio > 0.7) {
      return this.getRefinementMetrics(additionRatio, deletionRatio);
    } else {
      return this.getRefactoringMetrics(additionRatio, deletionRatio);
    }
  }

  private static calculateMetrics(pr: PullRequest) {
    let isConfig = true;
    let additions = 0;
    let deletions = 0;

    if (pr.commits) {
      for (const commit of pr.commits) {
        if (!NON_CODE_EXTENSIONS.has(commit.language)) {
          isConfig = false;
        }
        additions += commit.additions;
        deletions += commit.deletions;
      }
    } else {
      // If no commits data, fall back to PR level metrics
      additions = pr.additions;
      deletions = pr.deletions;
      isConfig = false; // Assume it's not just configuration changes
    }

    return { isConfig, additions, deletions };
  }

  private static getMaintenanceMetrics(): ContributionMetrics {
    // Maintenance is spread across the bottom-left quadrant
    return {
      x: Math.random() * 40 + 5, // 5-45%
      y: Math.random() * 40 + 55, // 55-95%
      quadrant: 'maintenance'
    };
  }

  private static getNewStuffMetrics(additionRatio: number, deletionRatio: number): ContributionMetrics {
    return {
      // Higher x (more additions) with some variance
      x: Math.min(95, additionRatio * 100 + Math.random() * 10),
      // Lower y (fewer deletions) with some variance
      y: Math.max(5, deletionRatio * 100 - Math.random() * 10),
      quadrant: 'newStuff'
    };
  }

  private static getRefinementMetrics(additionRatio: number, deletionRatio: number): ContributionMetrics {
    return {
      // Lower x (fewer additions) with some variance
      x: Math.max(5, additionRatio * 100 - Math.random() * 10),
      // Lower y (more focused changes) with some variance
      y: Math.max(5, deletionRatio * 50 - Math.random() * 10),
      quadrant: 'refinement'
    };
  }

  private static getRefactoringMetrics(additionRatio: number, deletionRatio: number): ContributionMetrics {
    return {
      // Balanced x and y with some variance
      x: Math.min(95, Math.max(5, additionRatio * 100 + Math.random() * 20 - 10)),
      y: Math.min(95, Math.max(5, deletionRatio * 100 + Math.random() * 20 - 10)),
      quadrant: 'refactoring'
    };
  }
}