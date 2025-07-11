/**
 * Performance Analyzer for Rollout Metrics
 * 
 * Analyzes the performance trends from collected metrics and generates
 * actionable insights for rollout optimization.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

class PerformanceAnalyzer {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.timeWindowHours = parseInt(process.env.TIME_WINDOW_HOURS || '24');
  }

  async analyze() {
    try {
      console.log('🔍 Analyzing rollout performance...');
      
      // Load the latest metrics
      const metrics = this.loadLatestMetrics();
      if (!metrics) {
        throw new Error('No metrics found to analyze');
      }

      // Perform various analyses
      const analysis = {
        timeWindow: this.timeWindowHours,
        timestamp: new Date().toISOString(),
        totalJobs: metrics.summary.totalJobs,
        
        // Processor performance
        inngest: {
          successRate: metrics.processorMetrics.inngest.successRate.toFixed(2),
          avgProcessingTime: Math.round(metrics.processorMetrics.inngest.avgProcessingTime),
          jobsPerHour: (metrics.processorMetrics.inngest.totalJobs / this.timeWindowHours).toFixed(2)
        },
        
        githubActions: {
          successRate: metrics.processorMetrics.github_actions.successRate.toFixed(2),
          avgProcessingTime: Math.round(metrics.processorMetrics.github_actions.avgProcessingTime),
          jobsPerHour: (metrics.processorMetrics.github_actions.totalJobs / this.timeWindowHours).toFixed(2)
        },
        
        // Overall health metrics
        errorRate: metrics.summary.errorRate.toFixed(2),
        costSavings: metrics.summary.estimatedSavings.toFixed(2),
        repositoriesCount: metrics.repositoryMetrics.activeRepositoriesCount,
        repositoryParticipation: metrics.repositoryMetrics.repositoryParticipationRate.toFixed(2),
        
        // Trend analysis
        trends: this.analyzeTrends(metrics),
        
        // Bottlenecks and issues
        bottlenecks: this.identifyBottlenecks(metrics),
        
        // Recommendations
        recommendations: this.generateRecommendations(metrics)
      };

      // Save analysis results
      await this.saveAnalysis(analysis);
      
      console.log('✅ Performance analysis completed');
      return analysis;
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error.message);
      throw error;
    }
  }

  loadLatestMetrics() {
    try {
      const metricsPath = 'rollout-metrics-latest.json';
      if (fs.existsSync(metricsPath)) {
        return JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
      }
      return null;
    } catch (error) {
      console.error('Failed to load metrics:', error);
      return null;
    }
  }

  analyzeTrends(metrics) {
    const trends = metrics.trends || {};
    
    return {
      jobVolume: {
        ...trends.jobVolume,
        interpretation: this.interpretTrend(trends.jobVolume)
      },
      errorRate: {
        ...trends.errorRate,
        interpretation: this.interpretTrend(trends.errorRate, true) // inverse for error rate
      },
      processingTime: {
        ...trends.processingTime,
        interpretation: this.interpretTrend(trends.processingTime, true) // lower is better
      },
      costEfficiency: {
        current: metrics.costAnalysis?.savings?.percentage || 0,
        trend: metrics.costAnalysis?.savings?.percentage > 0 ? 'positive' : 'neutral'
      }
    };
  }

  interpretTrend(trend, inverse = false) {
    if (!trend) return 'unknown';
    
    const direction = trend.direction;
    const change = trend.change;
    
    if (direction === 'flat' || change < 5) {
      return 'stable';
    }
    
    const positive = inverse ? direction === 'down' : direction === 'up';
    
    if (change > 50) {
      return positive ? 'significantly improving' : 'significantly degrading';
    } else if (change > 20) {
      return positive ? 'improving' : 'degrading';
    } else {
      return positive ? 'slightly improving' : 'slightly degrading';
    }
  }

  identifyBottlenecks(metrics) {
    const bottlenecks = [];
    
    // Check error patterns
    if (metrics.errorAnalysis?.errorPatterns) {
      const topErrors = Object.entries(metrics.errorAnalysis.errorPatterns)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      for (const [type, count] of topErrors) {
        if (count > 5) {
          bottlenecks.push({
            type: 'error_pattern',
            severity: count > 20 ? 'high' : 'medium',
            description: `High ${type} error count: ${count} occurrences`,
            impact: `Affecting ${((count / metrics.summary.totalJobs) * 100).toFixed(1)}% of jobs`
          });
        }
      }
    }
    
    // Check processing time issues
    if (metrics.jobMetrics?.p95ProcessingTime > 300000) { // 5 minutes
      bottlenecks.push({
        type: 'slow_processing',
        severity: 'high',
        description: `P95 processing time is ${(metrics.jobMetrics.p95ProcessingTime / 1000).toFixed(1)}s`,
        impact: '5% of jobs taking over 5 minutes'
      });
    }
    
    // Check repository concentration
    if (metrics.repositoryMetrics?.repositoryJobDistribution) {
      const totalJobs = metrics.summary.totalJobs;
      const topRepo = Object.entries(metrics.repositoryMetrics.repositoryJobDistribution)
        .sort(([,a], [,b]) => b.total - a.total)[0];
      
      if (topRepo && topRepo[1].total > totalJobs * 0.5) {
        bottlenecks.push({
          type: 'repository_concentration',
          severity: 'medium',
          description: 'Over 50% of jobs from single repository',
          impact: 'Uneven load distribution'
        });
      }
    }
    
    return bottlenecks;
  }

  generateRecommendations(metrics) {
    const recommendations = [];
    
    // Error rate recommendations
    if (metrics.summary.errorRate > 10) {
      recommendations.push('🚨 Critical: Error rate exceeds 10% - consider emergency rollback');
    } else if (metrics.summary.errorRate > 5) {
      recommendations.push('⚠️ Warning: Error rate above 5% threshold - investigate error patterns');
    }
    
    // Rollout percentage recommendations
    if (metrics.summary.rolloutPercentage < 50 && metrics.summary.errorRate < 2) {
      recommendations.push('✅ Low error rate detected - consider increasing rollout percentage');
    }
    
    // Cost efficiency recommendations
    if (metrics.costAnalysis?.savings?.percentage < 0) {
      recommendations.push('💰 Hybrid approach is more expensive than Inngest-only - review GitHub Actions usage');
    } else if (metrics.costAnalysis?.savings?.percentage > 30) {
      recommendations.push('🎉 Excellent cost savings achieved - maintain current configuration');
    }
    
    // Repository participation
    if (metrics.repositoryMetrics?.repositoryParticipationRate < 20) {
      recommendations.push('📊 Low repository participation - many repos not utilizing the system');
    }
    
    // Processing time recommendations
    if (metrics.performanceMetrics?.latency?.github_actions?.avgMs > 180000) { // 3 minutes
      recommendations.push('⏱️ GitHub Actions processing time high - consider optimizing workflows');
    }
    
    // Bottleneck-based recommendations
    const highSeverityBottlenecks = (metrics.bottlenecks || [])
      .filter(b => b.severity === 'high');
    
    if (highSeverityBottlenecks.length > 0) {
      recommendations.push('🔧 High severity bottlenecks detected - immediate attention required');
    }
    
    return recommendations.length > 0 ? recommendations : ['✅ System operating within normal parameters'];
  }

  async saveAnalysis(analysis) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `performance-analysis-${timestamp}-${Date.now()}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(analysis, null, 2));
    console.log(`📄 Analysis saved: ${filename}`);
    
    // Also save a latest copy
    fs.writeFileSync('performance-analysis-latest.json', JSON.stringify(analysis, null, 2));
    
    // Store summary in database for historical tracking
    try {
      const { error } = await this.supabase
        .from('rollout_performance_history')
        .insert({
          analyzed_at: analysis.timestamp,
          time_window_hours: analysis.timeWindow,
          total_jobs: analysis.totalJobs,
          error_rate: parseFloat(analysis.errorRate),
          cost_savings_percentage: parseFloat(analysis.costSavings),
          inngest_success_rate: parseFloat(analysis.inngest.successRate),
          github_actions_success_rate: parseFloat(analysis.githubActions.successRate),
          recommendations: analysis.recommendations,
          bottlenecks: analysis.bottlenecks
        });
      
      if (error) {
        console.warn('Failed to store analysis in database:', error.message);
      }
    } catch (dbError) {
      console.warn('Database storage skipped:', dbError.message);
    }
  }
}

// Main execution
async function main() {
  const analyzer = new PerformanceAnalyzer();
  
  try {
    const analysis = await analyzer.analyze();
    
    console.log('\n📊 Performance Summary:');
    console.log(`Total Jobs: ${analysis.totalJobs}`);
    console.log(`Error Rate: ${analysis.errorRate}%`);
    console.log(`Cost Savings: ${analysis.costSavings}%`);
    console.log(`Active Repositories: ${analysis.repositoriesCount}`);
    
    if (analysis.bottlenecks.length > 0) {
      console.log('\n🚧 Bottlenecks Identified:');
      analysis.bottlenecks.forEach(b => {
        console.log(`- [${b.severity.toUpperCase()}] ${b.description}`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    analysis.recommendations.forEach(rec => console.log(`- ${rec}`));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PerformanceAnalyzer };