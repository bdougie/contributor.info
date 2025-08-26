import { supabase } from '../supabase';
import { hybridQueueManager } from './hybrid-queue-manager';

export interface JobMetrics {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgProcessingTime: number;
  throughput: number; // jobs per hour
}

export interface ProcessorMetrics {
  inngest: JobMetrics;
  github_actions: JobMetrics;
  combined: JobMetrics;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  inngest: 'healthy' | 'degraded' | 'unhealthy';
  github_actions: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  recommendations: string[];
}

export interface CostAnalysis {
  inngest: {
    estimatedCost: number;
    jobsProcessed: number;
    costPerJob: number;
  };
  github_actions: {
    estimatedCost: number;
    jobsProcessed: number;
    costPerJob: number;
  };
  savings: {
    totalSavings: number;
    percentageSaving: number;
  };
}

export class HybridMonitoringDashboard {
  /**
   * Get comprehensive hybrid system stats
   */
  static async getSystemStats(): Promise<{
    current: Awaited<ReturnType<typeof hybridQueueManager.getHybridStats>>;
    metrics: ProcessorMetrics;
    health: SystemHealth;
    cost: CostAnalysis;
  }> {
    const [current, metrics, health, cost] = await Promise.all([
      hybridQueueManager.getHybridStats(),
      this.getProcessorMetrics(),
      this.getSystemHealth(),
      this.getCostAnalysis()
    ]);

    return { current, metrics, health, cost };
  }

  /**
   * Get detailed processor metrics over time
   */
  private static async getProcessorMetrics(): Promise<ProcessorMetrics> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      const { data: jobs, error } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .gte('created_at', twentyFourHoursAgo.toISOString());

      if (error) {
        console.error('[Monitoring] Database error fetching jobs:', error);
        throw error;
      }

      if (!jobs || jobs.length === 0) {
        const emptyMetrics: JobMetrics = {
          total: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
          avgProcessingTime: 0,
          throughput: 0
        };
        return {
          inngest: emptyMetrics,
          github_actions: emptyMetrics,
          combined: emptyMetrics
        };
      }

      const inngestJobs = jobs.filter(j => j.processor_type === 'inngest');
      const githubActionsJobs = jobs.filter(j => j.processor_type === 'github_actions');

      const inngestMetrics = this.calculateJobMetrics(inngestJobs);
      const githubActionsMetrics = this.calculateJobMetrics(githubActionsJobs);
      const combinedMetrics = this.calculateJobMetrics(jobs);

      return {
        inngest: inngestMetrics,
        github_actions: githubActionsMetrics,
        combined: combinedMetrics
      };
    } catch (error) {
      console.error('[Monitoring] Error getting processor metrics:', error);
      const emptyMetrics: JobMetrics = {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        avgProcessingTime: 0,
        throughput: 0
      };
      return {
        inngest: emptyMetrics,
        github_actions: emptyMetrics,
        combined: emptyMetrics
      };
    }
  }

  /**
   * Calculate metrics for a set of jobs
   */
  private static calculateJobMetrics(jobs: any[]): JobMetrics {
    const total = jobs.length;
    const successful = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Calculate average processing time
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.started_at && j.completed_at);
    const avgProcessingTime = completedJobs.length > 0 
      ? completedJobs.reduce((sum, job) => {
          const start = new Date(job.started_at).getTime();
          const end = new Date(job.completed_at).getTime();
          return sum + (end - start);
        }, 0) / completedJobs.length / 1000 // Convert to seconds
      : 0;

    // Calculate throughput (jobs per hour)
    const throughput = total * (60 * 60) / (24 * 60 * 60); // jobs per hour over 24 hours

    return {
      total,
      successful,
      failed,
      successRate,
      avgProcessingTime,
      throughput
    };
  }

  /**
   * Assess system health
   */
  private static async getSystemHealth(): Promise<SystemHealth> {
    const stats = await hybridQueueManager.getHybridStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for high failure rates
    const inngestFailureRate = stats.inngest.failed / (stats.inngest.completed + stats.inngest.failed + 1) * 100;
    const githubActionsFailureRate = stats.github_actions.failed / (stats.github_actions.completed + stats.github_actions.failed + 1) * 100;

    let inngestHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let githubActionsHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Assess Inngest health
    if (inngestFailureRate > 20) {
      inngestHealth = 'unhealthy';
      issues.push(`Inngest has high failure rate: ${inngestFailureRate.toFixed(1)}%`);
      recommendations.push('Check Inngest dashboard for error details');
    } else if (inngestFailureRate > 10) {
      inngestHealth = 'degraded';
      issues.push(`Inngest has elevated failure rate: ${inngestFailureRate.toFixed(1)}%`);
    }

    // Assess GitHub Actions health
    if (githubActionsFailureRate > 20) {
      githubActionsHealth = 'unhealthy';
      issues.push(`GitHub Actions has high failure rate: ${githubActionsFailureRate.toFixed(1)}%`);
      recommendations.push('Check GitHub Actions workflow logs');
    } else if (githubActionsFailureRate > 10) {
      githubActionsHealth = 'degraded';
      issues.push(`GitHub Actions has elevated failure rate: ${githubActionsFailureRate.toFixed(1)}%`);
    }

    // Check for processing bottlenecks
    if (stats.total.pending > 100) {
      issues.push(`High queue backlog: ${stats.total.pending} jobs pending`);
      recommendations.push('Consider increasing concurrency limits');
    }

    // Overall health assessment
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (inngestHealth === 'unhealthy' || githubActionsHealth === 'unhealthy') {
      overall = 'unhealthy';
    } else if (inngestHealth === 'degraded' || githubActionsHealth === 'degraded') {
      overall = 'degraded';
    }

    return {
      overall,
      inngest: inngestHealth,
      github_actions: githubActionsHealth,
      issues,
      recommendations
    };
  }

  /**
   * Calculate cost analysis and savings
   */
  private static async getCostAnalysis(): Promise<CostAnalysis> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      const { data: jobs, error } = await supabase
        .from('progressive_capture_jobs')
        .select('processor_type, status')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .eq('status', 'completed');

      if (error) {
        console.error('[Monitoring] Database error fetching completed jobs:', error);
        throw error;
      }

      if (!jobs || jobs.length === 0) {
        return {
          inngest: { estimatedCost: 0, jobsProcessed: 0, costPerJob: 0 },
          github_actions: { estimatedCost: 0, jobsProcessed: 0, costPerJob: 0 },
          savings: { totalSavings: 0, percentageSaving: 0 }
        };
      }

      const inngestJobs = jobs.filter(j => j.processor_type === 'inngest').length;
      const githubActionsJobs = jobs.filter(j => j.processor_type === 'github_actions').length;

      // Cost estimates (rough approximations)
      const inngestCostPerJob = 0.02; // $0.02 per job
      const githubActionsCostPerJob = 0.005; // $0.005 per job (cheaper for bulk)

      const inngestCost = inngestJobs * inngestCostPerJob;
      const githubActionsCost = githubActionsJobs * githubActionsCostPerJob;

      // Calculate what it would cost if everything ran on Inngest
      const totalJobs = inngestJobs + githubActionsJobs;
      const allInngestCost = totalJobs * inngestCostPerJob;
      const actualCost = inngestCost + githubActionsCost;
      const savings = allInngestCost - actualCost;
      const percentageSaving = allInngestCost > 0 ? (savings / allInngestCost) * 100 : 0;

      return {
        inngest: {
          estimatedCost: inngestCost,
          jobsProcessed: inngestJobs,
          costPerJob: inngestCostPerJob
        },
        github_actions: {
          estimatedCost: githubActionsCost,
          jobsProcessed: githubActionsJobs,
          costPerJob: githubActionsCostPerJob
        },
        savings: {
          totalSavings: savings,
          percentageSaving
        }
      };
    } catch (error) {
      console.error('[Monitoring] Error calculating cost analysis:', error);
      return {
        inngest: { estimatedCost: 0, jobsProcessed: 0, costPerJob: 0 },
        github_actions: { estimatedCost: 0, jobsProcessed: 0, costPerJob: 0 },
        savings: { totalSavings: 0, percentageSaving: 0 }
      };
    }
  }

  /**
   * Get routing effectiveness metrics
   */
  static async getRoutingEffectiveness(): Promise<{
    correctRouting: number;
    suboptimalRouting: number;
    routingAccuracy: number;
    suggestions: string[];
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      const { data: jobs, error } = await supabase
        .from('progressive_capture_jobs')
        .select('processor_type, time_range_days, metadata')
        .gte('created_at', twentyFourHoursAgo.toISOString());

      if (error) {
        console.error('[Monitoring] Database error fetching jobs for routing analysis:', error);
        throw error;
      }

      if (!jobs || jobs.length === 0) {
        return {
          correctRouting: 0,
          suboptimalRouting: 0,
          routingAccuracy: 0,
          suggestions: []
        };
      }

      let correctRouting = 0;
      let suboptimalRouting = 0;
      const suggestions: string[] = [];

      jobs.forEach(job => {
        const isRecent = job.time_range_days && job.time_range_days <= 1;
        const isHistorical = job.time_range_days && job.time_range_days > 1;
        const isSmallBatch = job.metadata?.max_items && job.metadata.max_items <= 50;

        // Check if routing decision was optimal
        if (job.processor_type === 'inngest' && (isRecent || isSmallBatch)) {
          correctRouting++;
        } else if (job.processor_type === 'github_actions' && isHistorical) {
          correctRouting++;
        } else {
          suboptimalRouting++;
        }
      });

      const routingAccuracy = (correctRouting / jobs.length) * 100;

      if (routingAccuracy < 80) {
        suggestions.push('Review routing logic - accuracy is below 80%');
      }

      if (suboptimalRouting > 0) {
        suggestions.push(`${suboptimalRouting} jobs may have been routed suboptimally`);
      }

      return {
        correctRouting,
        suboptimalRouting,
        routingAccuracy,
        suggestions
      };
    } catch (error) {
      console.error('[Monitoring] Error getting routing effectiveness:', error);
      return {
        correctRouting: 0,
        suboptimalRouting: 0,
        routingAccuracy: 0,
        suggestions: ['Error analyzing routing effectiveness']
      };
    }
  }

  /**
   * Get recent job errors for debugging
   */
  static async getJobErrors(limit: number = 20): Promise<{
    errors: Array<{
      id: string;
      job_type: string;
      processor_type: string;
      repository_id: string;
      error: string;
      created_at: string;
      metadata: any;
    }>;
    errorSummary: Record<string, number>;
    topErrors: Array<{ error: string; count: number }>;
  }> {
    try {
      const { data: failedJobs, error } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('status', 'failed')
        .not('error', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Monitoring] Database error fetching failed jobs:', error);
        throw error;
      }

      if (!failedJobs || failedJobs.length === 0) {
        return {
          errors: [],
          errorSummary: {},
          topErrors: []
        };
      }

      // Categorize errors
      const errorSummary: Record<string, number> = {};
      const errorCounts: Record<string, number> = {};

      failedJobs.forEach(job => {
        // Categorize by processor type
        errorSummary[job.processor_type] = (errorSummary[job.processor_type] || 0) + 1;
        
        // Count specific errors
        const errorMessage = typeof job.error === 'string' 
          ? job.error 
          : job.error 
            ? JSON.stringify(job.error) 
            : 'Unknown error';
        const errorKey = errorMessage.substring(0, 100);
        errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
      });

      // Get top errors
      const topErrors = Object.entries(errorCounts)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        errors: failedJobs.map(job => ({
          id: job.id,
          job_type: job.job_type,
          processor_type: job.processor_type,
          repository_id: job.repository_id,
          error: job.error,
          created_at: job.created_at,
          metadata: job.metadata
        })),
        errorSummary,
        topErrors
      };
    } catch (error) {
      console.error('[Monitoring] Error fetching job errors:', error);
      return {
        errors: [],
        errorSummary: {},
        topErrors: []
      };
    }
  }

  /**
   * Generate a formatted monitoring report
   */
  static async generateReport(): Promise<string> {
    const stats = await this.getSystemStats();
    const routing = await this.getRoutingEffectiveness();

    return `
📊 Hybrid Progressive Capture System Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Current Queue Status:
  • Total Pending: ${stats.current.total.pending}
  • Total Processing: ${stats.current.total.processing}
  • Total Completed: ${stats.current.total.completed}
  • Total Failed: ${stats.current.total.failed}

⚡ Inngest (Real-time Processing):
  • Pending: ${stats.current.inngest.pending}
  • Processing: ${stats.current.inngest.processing}
  • Completed: ${stats.current.inngest.completed}
  • Failed: ${stats.current.inngest.failed}

🏗️ GitHub Actions (Bulk Processing):
  • Pending: ${stats.current.github_actions.pending}
  • Processing: ${stats.current.github_actions.processing}
  • Completed: ${stats.current.github_actions.completed}
  • Failed: ${stats.current.github_actions.failed}

📈 24-Hour Performance Metrics:
  • Inngest Success Rate: ${stats.metrics.inngest.successRate.toFixed(1)}%
  • GitHub Actions Success Rate: ${stats.metrics.github_actions.successRate.toFixed(1)}%
  • Combined Success Rate: ${stats.metrics.combined.successRate.toFixed(1)}%
  • Average Processing Time: ${stats.metrics.combined.avgProcessingTime.toFixed(1)}s
  • Throughput: ${stats.metrics.combined.throughput.toFixed(1)} jobs/hour

🎯 Routing Effectiveness:
  • Routing Accuracy: ${routing.routingAccuracy.toFixed(1)}%
  • Correct Routing: ${routing.correctRouting} jobs
  • Suboptimal Routing: ${routing.suboptimalRouting} jobs

💰 Cost Analysis (24h):
  • Inngest Cost: $${stats.cost.inngest.estimatedCost.toFixed(3)}
  • GitHub Actions Cost: $${stats.cost.github_actions.estimatedCost.toFixed(3)}
  • Total Savings: $${stats.cost.savings.totalSavings.toFixed(3)} (${stats.cost.savings.percentageSaving.toFixed(1)}%)

🏥 System Health: ${stats.health.overall.toUpperCase()}
  • Inngest: ${stats.health.inngest.toUpperCase()}
  • GitHub Actions: ${stats.health.github_actions.toUpperCase()}

${stats.health.issues.length > 0
? `
⚠️ Issues Detected:
${stats.health.issues.map(issue => `  • ${issue}`).join('\n')}`
: ''}

${stats.health.recommendations.length > 0
? `
💡 Recommendations:
${stats.health.recommendations.map(rec => `  • ${rec}`).join('\n')}`
: ''}

${routing.suggestions.length > 0
? `
🔧 Routing Suggestions:
${routing.suggestions.map(sug => `  • ${sug}`).join('\n')}`
: ''}

Report generated at: ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).HybridMonitoring = HybridMonitoringDashboard;
  
  // Enable console tools in development
  if (import.meta.env?.DEV) {
    console.log('📊 Hybrid monitoring dashboard available in console:');
    console.log('   HybridMonitoring.generateReport() - Full system report');
    console.log('   HybridMonitoring.getSystemStats() - Detailed stats');
    console.log('   HybridMonitoring.getRoutingEffectiveness() - Routing analysis');
  }
}