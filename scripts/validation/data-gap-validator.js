#!/usr/bin/env node

/**
 * Data Gap Validation System
 *
 * Validates that there are no data gaps between Inngest and GitHub Actions processing
 * Ensures data consistency and completeness across both systems
 */

const { createClient } = require('@supabase/supabase-js');

class DataGapValidator {
  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    this.validationRules = {
      temporal: {
        maxGapMinutes: 60, // Max acceptable gap between jobs
        overlapToleranceMinutes: 5, // Acceptable overlap between jobs
      },
      data: {
        minDataPoints: 1, // Minimum data points per job
        maxDuplicateRate: 0.05, // Max 5% duplicate data acceptable
        requiredFields: ['repository_id', 'created_at', 'status'],
      },
      consistency: {
        maxTimeDifference: 300000, // 5 minutes max difference for same data
        requiredCoverage: 0.95, // 95% data coverage required
      },
    };
  }

  /**
   * Run comprehensive data gap validation
   */
  async validateDataGaps() {
    console.log('🔍 Starting comprehensive data gap validation...\n');

    try {
      const validationResults = {
        temporal: await this.validateTemporalGaps(),
        consistency: await this.validateDataConsistency(),
        completeness: await this.validateDataCompleteness(),
        duplicates: await this.validateDuplicates(),
        cross_system: await this.validateCrossSystemConsistency(),
      };

      console.log('📊 Validation Results Summary:');
      this.displayValidationResults(validationResults);

      const overallStatus = this.calculateOverallStatus(validationResults);
      console.log(`\n🎯 Overall Data Integrity: ${overallStatus.status.toUpperCase()}`);
      console.log(`   Score: ${overallStatus.score}/100`);

      // Generate recommendations
      const recommendations = this.generateRecommendations(validationResults);
      if (recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }

      // Save validation report
      await this.generateValidationReport(validationResults, overallStatus, recommendations);

      return overallStatus.status === 'excellent' || overallStatus.status === 'good';
    } catch (error) {
      console.error('❌ Data gap validation failed:', error);
      return false;
    }
  }

  /**
   * Validate temporal gaps between jobs
   */
  async validateTemporalGaps() {
    console.log('⏰ Validating temporal gaps...');

    const results = {
      gaps: [],
      overlaps: [],
      totalGaps: 0,
      maxGapMinutes: 0,
      avgGapMinutes: 0,
      status: 'unknown',
    };

    // Get all jobs from last 7 days
    const { data: jobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (!jobs || jobs.length < 2) {
      results.status = 'insufficient_data';
      return results;
    }

    // Group jobs by repository
    const jobsByRepo = jobs.reduce((acc, job) => {
      const repoId = job.repository_id;
      if (!acc[repoId]) acc[repoId] = [];
      acc[repoId].push(job);
      return acc;
    }, {});

    const allGaps = [];

    // Check gaps within each repository
    for (const [repoId, repoJobs] of Object.entries(jobsByRepo)) {
      for (let i = 1; i < repoJobs.length; i++) {
        const prevJob = repoJobs[i - 1];
        const currentJob = repoJobs[i];

        const gap =
          new Date(currentJob.created_at) - new Date(prevJob.completed_at || prevJob.created_at);
        const gapMinutes = gap / (1000 * 60);

        if (gapMinutes > this.validationRules.temporal.maxGapMinutes) {
          results.gaps.push({
            repository_id: repoId,
            gap_minutes: gapMinutes,
            prev_job: prevJob.id,
            current_job: currentJob.id,
            severity: gapMinutes > 240 ? 'high' : 'medium', // 4+ hours is high severity
          });
        }

        if (gapMinutes < -this.validationRules.temporal.overlapToleranceMinutes) {
          results.overlaps.push({
            repository_id: repoId,
            overlap_minutes: Math.abs(gapMinutes),
            job1: prevJob.id,
            job2: currentJob.id,
          });
        }

        allGaps.push(gapMinutes);
      }
    }

    // Calculate statistics
    results.totalGaps = results.gaps.length;
    results.maxGapMinutes = allGaps.length > 0 ? Math.max(...allGaps) : 0;
    results.avgGapMinutes =
      allGaps.length > 0 ? allGaps.reduce((a, b) => a + b, 0) / allGaps.length : 0;

    // Determine status
    if (results.totalGaps === 0) {
      results.status = 'excellent';
    } else if (results.totalGaps <= 5 && results.maxGapMinutes <= 120) {
      results.status = 'good';
    } else if (results.totalGaps <= 10 && results.maxGapMinutes <= 240) {
      results.status = 'acceptable';
    } else {
      results.status = 'poor';
    }

    console.log(
      `  ✅ Found ${results.totalGaps} temporal gaps (max: ${results.maxGapMinutes.toFixed(1)}min)`
    );
    return results;
  }

  /**
   * Validate data consistency between systems
   */
  async validateDataConsistency() {
    console.log('🔄 Validating cross-system consistency...');

    const results = {
      inconsistencies: [],
      totalInconsistencies: 0,
      consistencyRate: 0,
      status: 'unknown',
    };

    // Get jobs that should have produced similar data
    const { data: recentJobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'completed');

    if (!recentJobs || recentJobs.length === 0) {
      results.status = 'insufficient_data';
      return results;
    }

    // Group jobs by repository and time period
    const jobGroups = this.groupJobsForConsistencyCheck(recentJobs);

    for (const group of jobGroups) {
      if (group.inngest.length > 0 && group.github_actions.length > 0) {
        const inconsistency = await this.checkDataConsistency(group);
        if (inconsistency) {
          results.inconsistencies.push(inconsistency);
        }
      }
    }

    results.totalInconsistencies = results.inconsistencies.length;
    results.consistencyRate =
      jobGroups.length > 0
        ? ((jobGroups.length - results.totalInconsistencies) / jobGroups.length) * 100
        : 100;

    // Determine status
    if (results.consistencyRate >= 98) {
      results.status = 'excellent';
    } else if (results.consistencyRate >= 95) {
      results.status = 'good';
    } else if (results.consistencyRate >= 90) {
      results.status = 'acceptable';
    } else {
      results.status = 'poor';
    }

    console.log(`  ✅ Consistency rate: ${results.consistencyRate.toFixed(1)}%`);
    return results;
  }

  /**
   * Validate data completeness
   */
  async validateDataCompleteness() {
    console.log('📊 Validating data completeness...');

    const results = {
      missing_data: [],
      completion_rate: 0,
      total_expected: 0,
      total_found: 0,
      status: 'unknown',
    };

    // Check expected vs actual data for each processor
    const processors = ['inngest', 'github_actions'];

    for (const processor of processors) {
      const completeness = await this.checkProcessorCompleteness(processor);
      results.missing_data.push(...completeness.missing);
      results.total_expected += completeness.expected;
      results.total_found += completeness.found;
    }

    results.completion_rate =
      results.total_expected > 0 ? (results.total_found / results.total_expected) * 100 : 100;

    // Determine status
    if (results.completion_rate >= 99) {
      results.status = 'excellent';
    } else if (results.completion_rate >= 95) {
      results.status = 'good';
    } else if (results.completion_rate >= 90) {
      results.status = 'acceptable';
    } else {
      results.status = 'poor';
    }

    console.log(`  ✅ Completion rate: ${results.completion_rate.toFixed(1)}%`);
    return results;
  }

  /**
   * Validate duplicate data
   */
  async validateDuplicates() {
    console.log('🔍 Validating duplicate data...');

    const results = {
      duplicates: [],
      duplicate_rate: 0,
      total_records: 0,
      duplicate_records: 0,
      status: 'unknown',
    };

    // Check for duplicates in main data tables
    const tables = ['pull_requests', 'pull_request_reviews', 'pull_request_comments'];

    for (const table of tables) {
      const duplicates = await this.findDuplicatesInTable(table);
      results.duplicates.push(...duplicates);

      const { count: totalCount } = await this.supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      results.total_records += totalCount || 0;
      results.duplicate_records += duplicates.length;
    }

    results.duplicate_rate =
      results.total_records > 0 ? (results.duplicate_records / results.total_records) * 100 : 0;

    // Determine status
    if (results.duplicate_rate <= 1) {
      results.status = 'excellent';
    } else if (results.duplicate_rate <= 3) {
      results.status = 'good';
    } else if (results.duplicate_rate <= 5) {
      results.status = 'acceptable';
    } else {
      results.status = 'poor';
    }

    console.log(`  ✅ Duplicate rate: ${results.duplicate_rate.toFixed(2)}%`);
    return results;
  }

  /**
   * Validate cross-system consistency
   */
  async validateCrossSystemConsistency() {
    console.log('🔗 Validating cross-system consistency...');

    const results = {
      sync_issues: [],
      consistency_score: 0,
      last_sync_diff: 0,
      status: 'unknown',
    };

    // Check if both systems are processing data for the same repositories
    const { data: inngestRepos } = await this.supabase
      .from('progressive_capture_jobs')
      .select('repository_id')
      .eq('processor_type', 'inngest')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { data: actionsRepos } = await this.supabase
      .from('progressive_capture_jobs')
      .select('repository_id')
      .eq('processor_type', 'github_actions')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const inngestRepoIds = new Set((inngestRepos || []).map((r) => r.repository_id));
    const actionsRepoIds = new Set((actionsRepos || []).map((r) => r.repository_id));

    // Find repositories processed by only one system
    const onlyInngest = [...inngestRepoIds].filter((id) => !actionsRepoIds.has(id));
    const onlyActions = [...actionsRepoIds].filter((id) => !inngestRepoIds.has(id));

    if (onlyInngest.length > 0) {
      results.sync_issues.push({
        type: 'inngest_only',
        repositories: onlyInngest,
        count: onlyInngest.length,
      });
    }

    if (onlyActions.length > 0) {
      results.sync_issues.push({
        type: 'actions_only',
        repositories: onlyActions,
        count: onlyActions.length,
      });
    }

    // Calculate consistency score
    const totalRepos = new Set([...inngestRepoIds, ...actionsRepoIds]).size;
    const sharedRepos = [...inngestRepoIds].filter((id) => actionsRepoIds.has(id)).length;

    results.consistency_score = totalRepos > 0 ? (sharedRepos / totalRepos) * 100 : 100;

    // Determine status
    if (results.consistency_score >= 90) {
      results.status = 'excellent';
    } else if (results.consistency_score >= 80) {
      results.status = 'good';
    } else if (results.consistency_score >= 70) {
      results.status = 'acceptable';
    } else {
      results.status = 'poor';
    }

    console.log(`  ✅ Cross-system consistency: ${results.consistency_score.toFixed(1)}%`);
    return results;
  }

  /**
   * Helper methods
   */
  groupJobsForConsistencyCheck(jobs) {
    const groups = [];
    const repoGroups = jobs.reduce((acc, job) => {
      const key = `${job.repository_id}`;
      if (!acc[key]) {
        acc[key] = { inngest: [], github_actions: [] };
      }
      acc[key][job.processor_type].push(job);
      return acc;
    }, {});

    for (const [repoId, group] of Object.entries(repoGroups)) {
      if (group.inngest.length > 0 || group.github_actions.length > 0) {
        groups.push({
          repository_id: repoId,
          ...group,
        });
      }
    }

    return groups;
  }

  async checkDataConsistency(group) {
    // Check if both processors produced consistent data for the same repository
    // This is a simplified check - in practice, you'd compare actual data records

    const inngestItems = group.inngest.reduce(
      (sum, job) => sum + (job.metadata?.processed_items || 0),
      0
    );
    const actionsItems = group.github_actions.reduce(
      (sum, job) => sum + (job.metadata?.processed_items || 0),
      0
    );

    const difference = Math.abs(inngestItems - actionsItems);
    const totalItems = Math.max(inngestItems, actionsItems);

    if (totalItems > 0 && difference / totalItems > 0.1) {
      // >10% difference
      return {
        repository_id: group.repository_id,
        inngest_items: inngestItems,
        actions_items: actionsItems,
        difference_percentage: (difference / totalItems) * 100,
        severity: difference / totalItems > 0.25 ? 'high' : 'medium',
      };
    }

    return null;
  }

  async checkProcessorCompleteness(processor) {
    const result = { expected: 0, found: 0, missing: [] };

    // Get jobs for this processor
    const { data: jobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .eq('processor_type', processor)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!jobs) return result;

    for (const job of jobs) {
      result.expected++;

      // Check if job has required fields and data
      const hasRequiredFields = this.validationRules.data.requiredFields.every(
        (field) => job[field] !== null && job[field] !== undefined
      );

      const hasMinData =
        (job.metadata?.processed_items || 0) >= this.validationRules.data.minDataPoints;

      if (hasRequiredFields && hasMinData) {
        result.found++;
      } else {
        result.missing.push({
          job_id: job.id,
          repository_id: job.repository_id,
          processor,
          missing_fields: this.validationRules.data.requiredFields.filter(
            (field) => job[field] === null || job[field] === undefined
          ),
          has_min_data: hasMinData,
        });
      }
    }

    return result;
  }

  async findDuplicatesInTable(tableName) {
    // This is a simplified duplicate check
    // In practice, you'd need to define what constitutes a duplicate for each table

    const duplicateCheckQueries = {
      pull_requests: 'number, repository_id',
      pull_request_reviews: 'pr_number, repository_id, user_login',
      pull_request_comments: 'pr_number, repository_id, comment_id',
    };

    const fields = duplicateCheckQueries[tableName];
    if (!fields) return [];

    try {
      const { data: duplicates } = await this.supabase.rpc('find_duplicates', {
        table_name: tableName,
        check_fields: fields.split(', '),
      });

      return duplicates || [];
    } catch (error) {
      console.warn(`Could not check duplicates in ${tableName}:`, error.message);
      return [];
    }
  }

  calculateOverallStatus(validationResults) {
    const statusScores = {
      excellent: 100,
      good: 80,
      acceptable: 60,
      poor: 30,
      unknown: 0,
      insufficient_data: 50,
    };

    const weights = {
      temporal: 0.2,
      consistency: 0.3,
      completeness: 0.3,
      duplicates: 0.1,
      cross_system: 0.1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [category, result] of Object.entries(validationResults)) {
      const score = statusScores[result.status] || 0;
      const weight = weights[category] || 0;
      totalScore += score * weight;
      totalWeight += weight;
    }

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    let status;
    if (finalScore >= 90) status = 'excellent';
    else if (finalScore >= 75) status = 'good';
    else if (finalScore >= 60) status = 'acceptable';
    else status = 'poor';

    return { score: finalScore, status };
  }

  generateRecommendations(validationResults) {
    const recommendations = [];

    if (validationResults.temporal.status === 'poor') {
      recommendations.push('Reduce temporal gaps by implementing more frequent job scheduling');
    }

    if (validationResults.consistency.status === 'poor') {
      recommendations.push('Improve cross-system consistency with better data synchronization');
    }

    if (validationResults.completeness.status === 'poor') {
      recommendations.push('Enhance data completeness checks and retry mechanisms');
    }

    if (validationResults.duplicates.status === 'poor') {
      recommendations.push('Implement better duplicate detection and prevention');
    }

    if (validationResults.cross_system.status === 'poor') {
      recommendations.push('Improve cross-system coordination and shared repository processing');
    }

    return recommendations;
  }

  displayValidationResults(results) {
    for (const [category, result] of Object.entries(results)) {
      const statusEmoji =
        {
          excellent: '🟢',
          good: '🟡',
          acceptable: '🟠',
          poor: '🔴',
          unknown: '⚪',
          insufficient_data: '⚫',
        }[result.status] || '❓';

      console.log(`  ${statusEmoji} ${category.replace('_', ' ').toUpperCase()}: ${result.status}`);
    }
  }

  async generateValidationReport(validationResults, overallStatus, recommendations) {
    const report = {
      timestamp: new Date().toISOString(),
      validation_results: validationResults,
      overall_status: overallStatus,
      recommendations,
      summary: {
        total_categories: Object.keys(validationResults).length,
        excellent_categories: Object.values(validationResults).filter(
          (r) => r.status === 'excellent'
        ).length,
        poor_categories: Object.values(validationResults).filter((r) => r.status === 'poor').length,
        data_integrity_score: overallStatus.score,
      },
    };

    // Save report
    const fs = require('fs');
    const reportsDir = './validation-reports';
    fs.mkdirSync(reportsDir, { recursive: true });

    const reportPath = `${reportsDir}/data-gap-validation-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Validation report saved: ${reportPath}`);
    return report;
  }
}

// Main execution
if (require.main === module) {
  const validator = new DataGapValidator();
  validator
    .validateDataGaps()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { DataGapValidator };
