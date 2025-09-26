#!/usr/bin/env node

/**
 * Cost Analysis & Monitoring System
 *
 * Tracks and analyzes costs for both Inngest and GitHub Actions processing
 * to validate the expected 60-85% cost reduction from the hybrid approach.
 */

const { createClient } = require('@supabase/supabase-js');

class CostAnalyzer {
  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Cost models for different processors
    this.costModels = {
      inngest: {
        baseCostPerExecution: 0.0001, // $0.0001 per function execution
        dataCostPerMB: 0.000001, // $0.000001 per MB processed
        rateLimitPenalty: 0.001, // Additional cost when hitting rate limits
        concurrencyMultiplier: 1.2, // 20% overhead for concurrency management
      },
      github_actions: {
        costPerMinute: 0.008, // $0.008 per minute for Linux runners
        setupOverhead: 2, // 2 minutes average setup time
        storageCostPerGB: 0.25, // $0.25 per GB per month for artifacts
        networkCostPerGB: 0.09, // $0.09 per GB for data transfer
      },
      hybrid: {
        routingOverhead: 0.0001, // Small overhead for routing decisions
        monitoringCost: 0.00001, // Cost for tracking and monitoring
      },
    };
  }

  /**
   * Run comprehensive cost analysis
   */
  async analyzeCosts() {
    console.log('💰 Starting comprehensive cost analysis...\n');

    try {
      // Analyze historical costs (pre-hybrid)
      const historicalCosts = await this.analyzeHistoricalCosts();
      console.log('📊 Historical cost analysis (Inngest-only):');
      this.displayCostAnalysis(historicalCosts);

      // Analyze current hybrid costs
      const currentCosts = await this.analyzeCurrentCosts();
      console.log('\n📊 Current hybrid cost analysis:');
      this.displayCostAnalysis(currentCosts);

      // Calculate savings and efficiency
      const savings = this.calculateSavings(historicalCosts, currentCosts);
      console.log('\n💡 Cost savings analysis:');
      this.displaySavings(savings);

      // Project future costs
      const projections = await this.projectFutureCosts(currentCosts);
      console.log('\n📈 Cost projections:');
      this.displayProjections(projections);

      // Generate cost optimization recommendations
      const recommendations = this.generateCostOptimizations(currentCosts, savings);
      console.log('\n💡 Cost optimization recommendations:');
      this.displayRecommendations(recommendations);

      // Save cost analysis report
      await this.generateCostReport(
        historicalCosts,
        currentCosts,
        savings,
        projections,
        recommendations
      );
    } catch (error) {
      console.error('❌ Cost analysis failed:', error);
      process.exit(1);
    }
  }

  /**
   * Analyze historical costs (Inngest-only period)
   */
  async analyzeHistoricalCosts() {
    const endDate = new Date('2024-12-01'); // Before hybrid implementation
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30); // Last 30 days of Inngest-only

    const { data: historicalJobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .eq('processor_type', 'inngest')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString());

    if (!historicalJobs || historicalJobs.length === 0) {
      // Use estimated historical costs based on typical usage
      return this.estimateHistoricalCosts();
    }

    return this.calculateCosts(historicalJobs, 'historical');
  }

  /**
   * Analyze current hybrid costs
   */
  async analyzeCurrentCosts() {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const { data: currentJobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (!currentJobs || currentJobs.length === 0) {
      throw new Error('No current job data available for cost analysis');
    }

    return this.calculateCosts(currentJobs, 'current');
  }

  /**
   * Calculate costs for a set of jobs
   */
  calculateCosts(jobs, period) {
    const costs = {
      period,
      totalJobs: jobs.length,
      inngest: { jobs: 0, cost: 0, avgCostPerJob: 0, avgCostPerItem: 0 },
      github_actions: { jobs: 0, cost: 0, avgCostPerJob: 0, avgCostPerItem: 0 },
      hybrid: { overhead: 0 },
      total: 0,
      breakdown: {
        execution: 0,
        data: 0,
        storage: 0,
        network: 0,
        overhead: 0,
      },
    };

    const inngestJobs = jobs.filter((job) => job.processor_type === 'inngest');
    const actionsJobs = jobs.filter((job) => job.processor_type === 'github_actions');

    // Calculate Inngest costs
    if (inngestJobs.length > 0) {
      costs.inngest.jobs = inngestJobs.length;
      costs.inngest.cost = this.calculateInngestCosts(inngestJobs);
      costs.inngest.avgCostPerJob = costs.inngest.cost / inngestJobs.length;

      const totalItems = inngestJobs.reduce(
        (sum, job) => sum + (job.metadata?.processed_items || job.metadata?.max_items || 10),
        0
      );
      costs.inngest.avgCostPerItem = totalItems > 0 ? costs.inngest.cost / totalItems : 0;
    }

    // Calculate GitHub Actions costs
    if (actionsJobs.length > 0) {
      costs.github_actions.jobs = actionsJobs.length;
      costs.github_actions.cost = this.calculateGitHubActionsCosts(actionsJobs);
      costs.github_actions.avgCostPerJob = costs.github_actions.cost / actionsJobs.length;

      const totalItems = actionsJobs.reduce(
        (sum, job) => sum + (job.metadata?.processed_items || job.metadata?.max_items || 100),
        0
      );
      costs.github_actions.avgCostPerItem =
        totalItems > 0 ? costs.github_actions.cost / totalItems : 0;
    }

    // Calculate hybrid overhead
    if (period === 'current') {
      costs.hybrid.overhead =
        jobs.length * this.costModels.hybrid.routingOverhead +
        jobs.length * this.costModels.hybrid.monitoringCost;
    }

    // Calculate total and breakdown
    costs.total = costs.inngest.cost + costs.github_actions.cost + costs.hybrid.overhead;

    costs.breakdown.execution = costs.inngest.cost + costs.github_actions.cost;
    costs.breakdown.overhead = costs.hybrid.overhead;

    return costs;
  }

  /**
   * Calculate Inngest-specific costs
   */
  calculateInngestCosts(jobs) {
    let totalCost = 0;

    for (const job of jobs) {
      const duration = this.getJobDuration(job);
      const itemsProcessed = job.metadata?.processed_items || job.metadata?.max_items || 10;

      // Base execution cost
      let jobCost = this.costModels.inngest.baseCostPerExecution;

      // Data processing cost (estimate 1KB per item)
      const dataSizeMB = (itemsProcessed * 1024) / (1024 * 1024);
      jobCost += dataSizeMB * this.costModels.inngest.dataCostPerMB;

      // Rate limit penalties (if job took longer than expected)
      const expectedDuration = itemsProcessed * 100; // 100ms per item expected
      if (duration > expectedDuration * 2) {
        jobCost += this.costModels.inngest.rateLimitPenalty;
      }

      // Concurrency overhead
      jobCost *= this.costModels.inngest.concurrencyMultiplier;

      totalCost += jobCost;
    }

    return totalCost;
  }

  /**
   * Calculate GitHub Actions-specific costs
   */
  calculateGitHubActionsCosts(jobs) {
    let totalCost = 0;

    for (const job of jobs) {
      const durationMinutes = this.getJobDuration(job) / (1000 * 60);
      const actualDuration = Math.max(
        durationMinutes,
        this.costModels.github_actions.setupOverhead
      );

      // Execution cost
      let jobCost = actualDuration * this.costModels.github_actions.costPerMinute;

      // Storage cost for artifacts (estimate 10MB per job, prorated for 1 week retention)
      const storageCost = (10 / 1024) * this.costModels.github_actions.storageCostPerGB * (7 / 30);
      jobCost += storageCost;

      // Network cost (estimate 1MB data transfer per job)
      const networkCost = (1 / 1024) * this.costModels.github_actions.networkCostPerGB;
      jobCost += networkCost;

      totalCost += jobCost;
    }

    return totalCost;
  }

  /**
   * Calculate savings from hybrid approach
   */
  calculateSavings(historical, current) {
    // Normalize costs to same period and job volume
    const normalizedHistorical = this.normalizeCosts(historical, current.totalJobs);

    return {
      absolute: {
        monthly: normalizedHistorical.total - current.total,
        annual: (normalizedHistorical.total - current.total) * 12,
      },
      percentage: {
        overall: ((normalizedHistorical.total - current.total) / normalizedHistorical.total) * 100,
        inngest:
          ((normalizedHistorical.inngest.cost - current.inngest.cost) /
            normalizedHistorical.inngest.cost) *
          100,
        efficiency:
          current.github_actions.avgCostPerItem < current.inngest.avgCostPerItem
            ? ((current.inngest.avgCostPerItem - current.github_actions.avgCostPerItem) /
                current.inngest.avgCostPerItem) *
              100
            : 0,
      },
      breakdown: {
        executionSavings: normalizedHistorical.breakdown.execution - current.breakdown.execution,
        hybridOverhead: current.breakdown.overhead,
        netSavings: normalizedHistorical.total - current.total - current.breakdown.overhead,
      },
    };
  }

  /**
   * Project future costs based on current trends
   */
  async projectFutureCosts(currentCosts) {
    // Get growth trends
    const growthRate = await this.calculateGrowthRate();

    const projections = {
      threeDays: this.projectCost(currentCosts, 3, growthRate),
      oneWeek: this.projectCost(currentCosts, 7, growthRate),
      oneMonth: this.projectCost(currentCosts, 30, growthRate),
      threeMonths: this.projectCost(currentCosts, 90, growthRate),
      oneYear: this.projectCost(currentCosts, 365, growthRate),
    };

    projections.growthRate = growthRate;
    return projections;
  }

  /**
   * Generate cost optimization recommendations
   */
  generateCostOptimizations(currentCosts, savings) {
    const recommendations = [];

    // Routing optimization
    if (currentCosts.inngest.avgCostPerItem > currentCosts.github_actions.avgCostPerItem * 2) {
      recommendations.push({
        type: 'routing_optimization',
        priority: 'high',
        description: 'Route more jobs to GitHub Actions for better cost efficiency',
        potential_savings: '$' + (currentCosts.inngest.cost * 0.3).toFixed(4) + '/month',
        actions: [
          'Lower the threshold for GitHub Actions routing',
          'Route jobs with >25 items to GitHub Actions',
          'Implement smarter cost-based routing',
        ],
      });
    }

    // Batch optimization
    if (currentCosts.github_actions.avgCostPerJob > 0.05) {
      recommendations.push({
        type: 'batch_optimization',
        priority: 'medium',
        description: 'Increase batch sizes for GitHub Actions jobs',
        potential_savings: '$' + (currentCosts.github_actions.cost * 0.2).toFixed(4) + '/month',
        actions: [
          'Increase max items per GitHub Actions job to 5000',
          'Implement intelligent job combining',
          'Optimize setup overhead amortization',
        ],
      });
    }

    // Caching optimization
    recommendations.push({
      type: 'caching_optimization',
      priority: 'medium',
      description: 'Implement aggressive caching to reduce duplicate processing',
      potential_savings: '$' + (currentCosts.total * 0.15).toFixed(4) + '/month',
      actions: [
        'Cache repository metadata and contributor data',
        'Implement intelligent cache invalidation',
        'Use Redis for high-frequency data caching',
      ],
    });

    // Infrastructure optimization
    if (currentCosts.total > 50) {
      // If monthly costs > $50
      recommendations.push({
        type: 'infrastructure_optimization',
        priority: 'high',
        description: 'Optimize infrastructure for high-volume processing',
        potential_savings: '$' + (currentCosts.total * 0.25).toFixed(4) + '/month',
        actions: [
          'Consider self-hosted GitHub Actions runners',
          'Implement spot instance pricing for non-critical jobs',
          'Optimize database queries and connections',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  getJobDuration(job) {
    if (job.started_at && job.completed_at) {
      return new Date(job.completed_at) - new Date(job.started_at);
    }
    // Estimate based on processor type and items
    const items = job.metadata?.max_items || 10;
    return job.processor_type === 'inngest' ? items * 100 : items * 1000; // ms
  }

  normalizeCosts(costs, targetJobCount) {
    const ratio = targetJobCount / costs.totalJobs;
    return {
      ...costs,
      totalJobs: targetJobCount,
      inngest: {
        ...costs.inngest,
        cost: costs.inngest.cost * ratio,
      },
      github_actions: {
        ...costs.github_actions,
        cost: costs.github_actions.cost * ratio,
      },
      total: costs.total * ratio,
      breakdown: {
        execution: costs.breakdown.execution * ratio,
        data: costs.breakdown.data * ratio,
        storage: costs.breakdown.storage * ratio,
        network: costs.breakdown.network * ratio,
        overhead: costs.breakdown.overhead * ratio,
      },
    };
  }

  async calculateGrowthRate() {
    // Calculate job growth rate over last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: recentJobs } = await this.supabase
      .from('progressive_capture_jobs')
      .select('created_at')
      .gte('created_at', threeMonthsAgo.toISOString());

    if (!recentJobs || recentJobs.length < 30) {
      return 0.1; // 10% growth rate default
    }

    // Simple linear growth calculation
    const jobsPerDay = recentJobs.length / 90;
    const growthRate = Math.min(0.5, jobsPerDay / 100); // Cap at 50% growth

    return growthRate;
  }

  projectCost(currentCosts, days, growthRate) {
    const dailyCost = currentCosts.total / 30; // Convert monthly to daily
    const growthFactor = Math.pow(1 + growthRate, days / 30);

    return {
      cost: dailyCost * days * growthFactor,
      jobs: Math.round(currentCosts.totalJobs * (days / 30) * growthFactor),
      breakdown: {
        inngest: currentCosts.inngest.cost * (days / 30) * growthFactor * 0.3,
        github_actions: currentCosts.github_actions.cost * (days / 30) * growthFactor * 0.7,
        overhead: currentCosts.hybrid.overhead * (days / 30) * growthFactor,
      },
    };
  }

  estimateHistoricalCosts() {
    // Estimate historical Inngest-only costs
    return {
      period: 'historical_estimated',
      totalJobs: 1000,
      inngest: {
        jobs: 1000,
        cost: 45.0, // Estimated $45/month for all processing
        avgCostPerJob: 0.045,
        avgCostPerItem: 0.001,
      },
      github_actions: { jobs: 0, cost: 0, avgCostPerJob: 0, avgCostPerItem: 0 },
      hybrid: { overhead: 0 },
      total: 45.0,
      breakdown: {
        execution: 45.0,
        data: 0,
        storage: 0,
        network: 0,
        overhead: 0,
      },
    };
  }

  /**
   * Display methods
   */
  displayCostAnalysis(costs) {
    console.log(`  📊 Period: ${costs.period}`);
    console.log(`  🔢 Total Jobs: ${costs.totalJobs}`);
    console.log(`  💰 Total Cost: $${costs.total.toFixed(4)}/month`);
    console.log(
      `  ⚡ Inngest: ${costs.inngest.jobs} jobs, $${costs.inngest.cost.toFixed(4)} ($${costs.inngest.avgCostPerItem.toFixed(6)}/item)`
    );
    console.log(
      `  🔧 GitHub Actions: ${costs.github_actions.jobs} jobs, $${costs.github_actions.cost.toFixed(4)} ($${costs.github_actions.avgCostPerItem.toFixed(6)}/item)`
    );
    if (costs.hybrid.overhead > 0) {
      console.log(`  🔄 Hybrid Overhead: $${costs.hybrid.overhead.toFixed(4)}`);
    }
  }

  displaySavings(savings) {
    console.log(`  💵 Monthly Savings: $${savings.absolute.monthly.toFixed(2)}`);
    console.log(`  📈 Annual Savings: $${savings.absolute.annual.toFixed(2)}`);
    console.log(`  📊 Overall Reduction: ${savings.percentage.overall.toFixed(1)}%`);
    console.log(`  ⚡ Inngest Reduction: ${savings.percentage.inngest.toFixed(1)}%`);
    console.log(`  🎯 Efficiency Gain: ${savings.percentage.efficiency.toFixed(1)}%`);
    console.log(`  ✅ Net Savings: $${savings.breakdown.netSavings.toFixed(4)}/month`);
  }

  displayProjections(projections) {
    console.log(`  📈 Growth Rate: ${(projections.growthRate * 100).toFixed(1)}%/month`);
    console.log(`  📅 3 Days: $${projections.threeDays.cost.toFixed(4)}`);
    console.log(`  📅 1 Week: $${projections.oneWeek.cost.toFixed(4)}`);
    console.log(`  📅 1 Month: $${projections.oneMonth.cost.toFixed(2)}`);
    console.log(`  📅 3 Months: $${projections.threeMonths.cost.toFixed(2)}`);
    console.log(`  📅 1 Year: $${projections.oneYear.cost.toFixed(2)}`);
  }

  displayRecommendations(recommendations) {
    recommendations.forEach((rec, index) => {
      console.log(
        `\n  ${index + 1}. ${rec.type.replace('_', ' ').toUpperCase()} (${rec.priority} priority)`
      );
      console.log(`     ${rec.description}`);
      console.log(`     💰 Potential Savings: ${rec.potential_savings}`);
      console.log(`     Actions:`);
      rec.actions.forEach((action) => console.log(`       • ${action}`));
    });
  }

  async generateCostReport(historical, current, savings, projections, recommendations) {
    const report = {
      timestamp: new Date().toISOString(),
      analysis: {
        historical,
        current,
        savings,
        projections,
        recommendations,
      },
      summary: {
        monthlySavings: savings.absolute.monthly,
        annualSavings: savings.absolute.annual,
        savingsPercentage: savings.percentage.overall,
        roiMonths: Math.abs(savings.absolute.monthly) > 0 ? 0 : 'N/A', // Implementation cost recovery
        efficiency: savings.percentage.efficiency,
      },
      targets: {
        achieved: savings.percentage.overall >= 60,
        targetRange: '60-85%',
        actualSavings: savings.percentage.overall,
      },
    };

    // Save report
    const fs = require('fs');
    const reportsDir = './cost-analysis-reports';
    fs.mkdirSync(reportsDir, { recursive: true });

    const reportPath = `${reportsDir}/cost-analysis-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Cost analysis report saved: ${reportPath}`);
    console.log(
      `💯 Target achieved: ${report.targets.achieved ? 'YES' : 'NO'} (${report.targets.actualSavings.toFixed(1)}% vs ${report.targets.targetRange})`
    );

    return report;
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new CostAnalyzer();
  analyzer.analyzeCosts().catch(console.error);
}

module.exports = { CostAnalyzer };
