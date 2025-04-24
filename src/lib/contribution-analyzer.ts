import { PullRequest, QuadrantDistribution } from './types';

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
  // Track counts of each quadrant type for distribution calculation
  private static quadrantCounts = {
    refinement: 0,
    newStuff: 0,
    refactoring: 0,
    maintenance: 0
  };

  static analyze(pr: PullRequest): ContributionMetrics {
    const { isConfig, additions, deletions } = this.calculateMetrics(pr);
    
    if (isConfig) {
      this.quadrantCounts.maintenance++;
      return this.getMaintenanceMetrics();
    }

    const total = additions + deletions;
    if (total === 0) {
      this.quadrantCounts.maintenance++;
      return this.getMaintenanceMetrics();
    }

    const additionRatio = additions / total;
    const deletionRatio = deletions / total;

    if (additionRatio > 0.7) {
      this.quadrantCounts.newStuff++;
      return this.getNewStuffMetrics(additionRatio, deletionRatio);
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
      newStuff: 0,
      refactoring: 0,
      maintenance: 0
    };
  }

  // Get the distribution percentages for each quadrant
  static getDistribution(): QuadrantDistribution {
    const total = this.quadrantCounts.refinement + 
                  this.quadrantCounts.newStuff + 
                  this.quadrantCounts.refactoring + 
                  this.quadrantCounts.maintenance;
    
    if (total === 0) {
      return {
        label: "Contribution Distribution",
        value: 0,
        percentage: 0,
        refinement: 25,
        newStuff: 25,
        refactoring: 25,
        maintenance: 25
      };
    }

    // Create a distribution object conforming to the updated QuadrantDistribution interface
    return {
      label: "Contribution Distribution",
      value: total,
      percentage: 100,
      refinement: (this.quadrantCounts.refinement / total) * 100,
      newStuff: (this.quadrantCounts.newStuff / total) * 100,
      refactoring: (this.quadrantCounts.refactoring / total) * 100,
      maintenance: (this.quadrantCounts.maintenance / total) * 100
    };
  }

  // Get the raw counts for each quadrant
  static getCounts() {
    return { ...this.quadrantCounts };
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