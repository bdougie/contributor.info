#!/usr/bin/env node

/**
 * Phase 5 Master Test Runner
 *
 * Coordinates and executes all Phase 5 testing and optimization tasks:
 * - Parallel testing
 * - Performance comparison
 * - Data gap validation
 * - Edge case testing
 * - System optimization
 * - Cost analysis
 */

const { HybridSystemTester } = require('./hybrid-system-test');
const { InngestOptimizer } = require('../optimization/inngest-optimizer');
const { GitHubActionsOptimizer } = require('../optimization/github-actions-optimizer');
const { CostAnalyzer } = require('../monitoring/cost-analyzer');
const { DataGapValidator } = require('../validation/data-gap-validator');
const { EdgeCaseTester } = require('./edge-case-tester');

class Phase5TestRunner {
  constructor() {
    this.results = {
      hybridSystemTest: null,
      inngestOptimization: null,
      githubActionsOptimization: null,
      costAnalysis: null,
      dataGapValidation: null,
      edgeCaseTesting: null,
      overallStatus: 'unknown',
    };

    this.startTime = Date.now();
  }

  /**
   * Run complete Phase 5 testing and optimization suite
   */
  async runPhase5() {
    console.log('🚀 Starting Phase 5: Testing & Optimization\n');
    console.log('='.repeat(60));

    try {
      // Step 1: Parallel System Testing
      console.log('\n📊 Step 1: Hybrid System Testing');
      console.log('-'.repeat(40));
      await this.runHybridSystemTest();

      // Step 2: Performance Optimization
      console.log('\n⚡ Step 2: Performance Optimization');
      console.log('-'.repeat(40));
      await this.runPerformanceOptimizations();

      // Step 3: Data Validation
      console.log('\n🔍 Step 3: Data Gap Validation');
      console.log('-'.repeat(40));
      await this.runDataValidation();

      // Step 4: Edge Case Testing
      console.log('\n🧪 Step 4: Edge Case Testing');
      console.log('-'.repeat(40));
      await this.runEdgeCaseTesting();

      // Step 5: Cost Analysis
      console.log('\n💰 Step 5: Cost Analysis');
      console.log('-'.repeat(40));
      await this.runCostAnalysis();

      // Step 6: Final Assessment
      console.log('\n📋 Step 6: Final Assessment');
      console.log('-'.repeat(40));
      await this.generateFinalAssessment();

      console.log('\n' + '='.repeat(60));
      console.log('✅ Phase 5 completed successfully!');
      console.log(`⏱️  Total duration: ${this.formatDuration(Date.now() - this.startTime)}`);

      return this.results.overallStatus === 'success';
    } catch (error) {
      console.error('\n❌ Phase 5 failed:', error);
      this.results.overallStatus = 'failed';
      return false;
    }
  }

  /**
   * Run hybrid system testing
   */
  async runHybridSystemTest() {
    try {
      console.log('Running comprehensive hybrid system tests...');
      const tester = new HybridSystemTester();
      await tester.runTests();

      this.results.hybridSystemTest = {
        status: 'completed',
        success: true,
        message: 'Hybrid system testing completed successfully',
      };
      console.log('✅ Hybrid system testing completed');
    } catch (error) {
      this.results.hybridSystemTest = {
        status: 'failed',
        success: false,
        error: error.message,
      };
      console.error('❌ Hybrid system testing failed:', error.message);
    }
  }

  /**
   * Run performance optimizations for both systems
   */
  async runPerformanceOptimizations() {
    const optimizations = [];

    // Optimize Inngest
    try {
      console.log('Optimizing Inngest for recent data processing...');
      const inngestOptimizer = new InngestOptimizer();
      await inngestOptimizer.optimize();

      optimizations.push({
        system: 'inngest',
        status: 'completed',
        success: true,
      });
      console.log('✅ Inngest optimization completed');
    } catch (error) {
      optimizations.push({
        system: 'inngest',
        status: 'failed',
        success: false,
        error: error.message,
      });
      console.error('❌ Inngest optimization failed:', error.message);
    }

    // Optimize GitHub Actions
    try {
      console.log('Optimizing GitHub Actions for historical data processing...');
      const actionsOptimizer = new GitHubActionsOptimizer();
      await actionsOptimizer.optimize();

      optimizations.push({
        system: 'github_actions',
        status: 'completed',
        success: true,
      });
      console.log('✅ GitHub Actions optimization completed');
    } catch (error) {
      optimizations.push({
        system: 'github_actions',
        status: 'failed',
        success: false,
        error: error.message,
      });
      console.error('❌ GitHub Actions optimization failed:', error.message);
    }

    this.results.inngestOptimization = optimizations.find((o) => o.system === 'inngest');
    this.results.githubActionsOptimization = optimizations.find(
      (o) => o.system === 'github_actions'
    );

    const successCount = optimizations.filter((o) => o.success).length;
    console.log(
      `📊 Performance optimization: ${successCount}/${optimizations.length} systems optimized`
    );
  }

  /**
   * Run data gap validation
   */
  async runDataValidation() {
    try {
      console.log('Validating data consistency and completeness...');
      const validator = new DataGapValidator();
      const success = await validator.validateDataGaps();

      this.results.dataGapValidation = {
        status: 'completed',
        success,
        message: success ? 'Data validation passed' : 'Data validation found issues',
      };

      if (success) {
        console.log('✅ Data validation completed - no gaps detected');
      } else {
        console.log('⚠️ Data validation completed - issues found (see report)');
      }
    } catch (error) {
      this.results.dataGapValidation = {
        status: 'failed',
        success: false,
        error: error.message,
      };
      console.error('❌ Data validation failed:', error.message);
    }
  }

  /**
   * Run edge case testing
   */
  async runEdgeCaseTesting() {
    try {
      console.log('Running comprehensive edge case tests...');
      const tester = new EdgeCaseTester();
      const success = await tester.runAllTests();

      this.results.edgeCaseTesting = {
        status: 'completed',
        success,
        message: success ? 'All edge cases handled correctly' : 'Some edge cases need attention',
      };

      if (success) {
        console.log('✅ Edge case testing completed - all scenarios passed');
      } else {
        console.log('⚠️ Edge case testing completed - some failures detected');
      }
    } catch (error) {
      this.results.edgeCaseTesting = {
        status: 'failed',
        success: false,
        error: error.message,
      };
      console.error('❌ Edge case testing failed:', error.message);
    }
  }

  /**
   * Run cost analysis
   */
  async runCostAnalysis() {
    try {
      console.log('Analyzing cost efficiency and savings...');
      const analyzer = new CostAnalyzer();
      await analyzer.analyzeCosts();

      this.results.costAnalysis = {
        status: 'completed',
        success: true,
        message: 'Cost analysis completed successfully',
      };
      console.log('✅ Cost analysis completed');
    } catch (error) {
      this.results.costAnalysis = {
        status: 'failed',
        success: false,
        error: error.message,
      };
      console.error('❌ Cost analysis failed:', error.message);
    }
  }

  /**
   * Generate final assessment and recommendations
   */
  async generateFinalAssessment() {
    console.log('Generating final Phase 5 assessment...');

    const completedTasks = Object.values(this.results).filter(
      (r) => r && r.status === 'completed'
    ).length;
    const successfulTasks = Object.values(this.results).filter(
      (r) => r && r.success === true
    ).length;
    const totalTasks = Object.keys(this.results).length - 1; // Exclude overallStatus

    const assessment = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 5: Testing & Optimization',
      duration: this.formatDuration(Date.now() - this.startTime),
      summary: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        successful_tasks: successfulTasks,
        completion_rate: (completedTasks / totalTasks) * 100,
        success_rate: (successfulTasks / totalTasks) * 100,
      },
      results: this.results,
      status: this.determineOverallStatus(successfulTasks, totalTasks),
      recommendations: this.generateRecommendations(),
      next_steps: this.generateNextSteps(),
    };

    this.results.overallStatus = assessment.status;

    // Save assessment
    const fs = require('fs');
    const reportsDir = './phase5-reports';
    fs.mkdirSync(reportsDir, { recursive: true });

    const assessmentPath = `${reportsDir}/phase5-final-assessment-${Date.now()}.json`;
    fs.writeFileSync(assessmentPath, JSON.stringify(assessment, null, 2));

    // Display summary
    console.log('\n📊 Final Assessment Summary:');
    console.log(`  🎯 Overall Status: ${assessment.status.toUpperCase()}`);
    console.log(`  ✅ Completion Rate: ${assessment.summary.completion_rate.toFixed(1)}%`);
    console.log(`  🏆 Success Rate: ${assessment.summary.success_rate.toFixed(1)}%`);
    console.log(`  ⏱️  Total Duration: ${assessment.duration}`);

    if (assessment.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:');
      assessment.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    if (assessment.next_steps.length > 0) {
      console.log('\n🚀 Next Steps:');
      assessment.next_steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`);
      });
    }

    console.log(`\n📊 Detailed assessment saved: ${assessmentPath}`);

    return assessment;
  }

  /**
   * Determine overall status based on task completion
   */
  determineOverallStatus(successfulTasks, totalTasks) {
    const successRate = (successfulTasks / totalTasks) * 100;

    if (successRate >= 90) {
      return 'success';
    } else if (successRate >= 75) {
      return 'mostly_successful';
    } else if (successRate >= 50) {
      return 'partial_success';
    } else {
      return 'needs_improvement';
    }
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.results.hybridSystemTest && !this.results.hybridSystemTest.success) {
      recommendations.push(
        'Review and address hybrid system testing failures before production deployment'
      );
    }

    if (this.results.dataGapValidation && !this.results.dataGapValidation.success) {
      recommendations.push('Implement additional data consistency checks and monitoring');
    }

    if (this.results.edgeCaseTesting && !this.results.edgeCaseTesting.success) {
      recommendations.push('Strengthen error handling and edge case resilience');
    }

    if (this.results.inngestOptimization && !this.results.inngestOptimization.success) {
      recommendations.push('Apply manual Inngest optimizations for better performance');
    }

    if (this.results.githubActionsOptimization && !this.results.githubActionsOptimization.success) {
      recommendations.push('Optimize GitHub Actions workflows for better efficiency');
    }

    // Always recommend monitoring
    recommendations.push('Implement continuous monitoring and alerting for production');
    recommendations.push('Schedule regular performance reviews and optimizations');

    return recommendations;
  }

  /**
   * Generate next steps based on assessment
   */
  generateNextSteps() {
    const steps = [];

    if (this.results.overallStatus === 'success') {
      steps.push('Proceed to Phase 6: Production Deployment');
      steps.push('Set up production monitoring and alerting');
      steps.push('Plan gradual rollout strategy');
    } else {
      steps.push('Address failed tasks before proceeding to production');
      steps.push('Re-run testing suite after fixes are implemented');
      steps.push('Consider extending testing period for critical systems');
    }

    steps.push('Document lessons learned and best practices');
    steps.push('Plan regular optimization cycles');

    return steps;
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Main execution
if (require.main === module) {
  const runner = new Phase5TestRunner();
  runner
    .runPhase5()
    .then((success) => {
      console.log(`\n🎯 Phase 5 ${success ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH ISSUES'}`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Phase 5 execution failed:', error);
      process.exit(1);
    });
}

module.exports = { Phase5TestRunner };
