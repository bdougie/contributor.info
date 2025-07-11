/**
 * Alert Manager for Rollout Metrics
 * 
 * Sends alerts and notifications based on rollout performance metrics
 * and defined thresholds.
 */

import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

class AlertManager {
  constructor() {
    // Initialize Sentry if DSN is provided
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.ENVIRONMENT || 'production',
        serverName: 'rollout-alert-manager'
      });
    }
    
    this.metricsType = process.env.METRICS_TYPE || 'performance';
    
    // Alert thresholds
    this.thresholds = {
      errorRate: {
        critical: 10,
        warning: 5
      },
      successRate: {
        critical: 80,
        warning: 90
      },
      processingTime: {
        critical: 300000, // 5 minutes
        warning: 180000  // 3 minutes
      },
      costIncrease: {
        critical: 50, // 50% increase
        warning: 20  // 20% increase
      }
    };
  }

  async processAlerts() {
    try {
      console.log('🚨 Processing alerts...');
      
      // Load metrics and analysis
      const metrics = this.loadLatestMetrics();
      const analysis = this.loadLatestAnalysis();
      
      if (!metrics && !analysis) {
        throw new Error('No metrics or analysis found to process');
      }
      
      // Check various alert conditions
      const alerts = [];
      
      if (metrics) {
        alerts.push(...this.checkMetricAlerts(metrics));
      }
      
      if (analysis) {
        alerts.push(...this.checkAnalysisAlerts(analysis));
      }
      
      // Send alerts
      if (alerts.length > 0) {
        await this.sendAlerts(alerts);
        console.log(`📤 Sent ${alerts.length} alerts`);
      } else {
        console.log('✅ No alerts to send - system healthy');
      }
      
      // Send regular health check
      await this.sendHealthCheck(metrics, analysis);
      
    } catch (error) {
      console.error('❌ Alert processing failed:', error.message);
      
      // Send critical error alert
      Sentry.captureException(error, {
        level: 'fatal',
        tags: {
          component: 'alert_manager',
          metrics_type: this.metricsType
        }
      });
      
      throw error;
    }
  }

  loadLatestMetrics() {
    try {
      const path = 'rollout-metrics-latest.json';
      if (fs.existsSync(path)) {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
    return null;
  }

  loadLatestAnalysis() {
    try {
      const path = 'performance-analysis-latest.json';
      if (fs.existsSync(path)) {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    }
    return null;
  }

  checkMetricAlerts(metrics) {
    const alerts = [];
    
    // Error rate alerts
    if (metrics.summary.errorRate >= this.thresholds.errorRate.critical) {
      alerts.push({
        level: 'critical',
        type: 'error_rate',
        message: `Critical error rate: ${metrics.summary.errorRate.toFixed(2)}%`,
        value: metrics.summary.errorRate,
        threshold: this.thresholds.errorRate.critical,
        recommendation: 'Consider emergency rollback'
      });
    } else if (metrics.summary.errorRate >= this.thresholds.errorRate.warning) {
      alerts.push({
        level: 'warning',
        type: 'error_rate',
        message: `High error rate: ${metrics.summary.errorRate.toFixed(2)}%`,
        value: metrics.summary.errorRate,
        threshold: this.thresholds.errorRate.warning,
        recommendation: 'Monitor closely and investigate errors'
      });
    }
    
    // Success rate alerts
    if (metrics.summary.successRate <= this.thresholds.successRate.critical) {
      alerts.push({
        level: 'critical',
        type: 'success_rate',
        message: `Critical success rate: ${metrics.summary.successRate.toFixed(2)}%`,
        value: metrics.summary.successRate,
        threshold: this.thresholds.successRate.critical,
        recommendation: 'Immediate investigation required'
      });
    }
    
    // Processing time alerts
    if (metrics.jobMetrics?.p95ProcessingTime >= this.thresholds.processingTime.critical) {
      alerts.push({
        level: 'warning',
        type: 'processing_time',
        message: `High P95 processing time: ${(metrics.jobMetrics.p95ProcessingTime / 1000).toFixed(1)}s`,
        value: metrics.jobMetrics.p95ProcessingTime,
        threshold: this.thresholds.processingTime.critical,
        recommendation: 'Review job complexity and optimize'
      });
    }
    
    // Error pattern alerts
    if (metrics.errorAnalysis?.errorPatterns) {
      Object.entries(metrics.errorAnalysis.errorPatterns).forEach(([pattern, count]) => {
        if (count > 10) {
          alerts.push({
            level: 'warning',
            type: 'error_pattern',
            message: `High ${pattern} error count: ${count} occurrences`,
            value: count,
            pattern: pattern,
            recommendation: `Investigate ${pattern} errors`
          });
        }
      });
    }
    
    return alerts;
  }

  checkAnalysisAlerts(analysis) {
    const alerts = [];
    
    // Bottleneck alerts
    if (analysis.bottlenecks) {
      analysis.bottlenecks
        .filter(b => b.severity === 'high')
        .forEach(bottleneck => {
          alerts.push({
            level: 'warning',
            type: 'bottleneck',
            message: bottleneck.description,
            severity: bottleneck.severity,
            impact: bottleneck.impact,
            recommendation: 'Address bottleneck to improve performance'
          });
        });
    }
    
    // Trend alerts
    if (analysis.trends) {
      // Error rate trending up
      if (analysis.trends.errorRate?.interpretation === 'significantly degrading') {
        alerts.push({
          level: 'critical',
          type: 'trend',
          message: 'Error rate is significantly increasing',
          trend: analysis.trends.errorRate,
          recommendation: 'Investigate recent changes and consider rollback'
        });
      }
      
      // Processing time trending up
      if (analysis.trends.processingTime?.interpretation === 'significantly degrading') {
        alerts.push({
          level: 'warning',
          type: 'trend',
          message: 'Processing time is significantly increasing',
          trend: analysis.trends.processingTime,
          recommendation: 'Review system load and optimize'
        });
      }
    }
    
    return alerts;
  }

  async sendAlerts(alerts) {
    // Group alerts by level
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    const warningAlerts = alerts.filter(a => a.level === 'warning');
    
    // Send critical alerts with high priority
    for (const alert of criticalAlerts) {
      Sentry.captureMessage(alert.message, {
        level: 'fatal',
        tags: {
          alert_type: alert.type,
          metrics_type: this.metricsType,
          environment: process.env.ENVIRONMENT || 'production'
        },
        extra: {
          ...alert,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Send warning alerts
    for (const alert of warningAlerts) {
      Sentry.captureMessage(alert.message, {
        level: 'warning',
        tags: {
          alert_type: alert.type,
          metrics_type: this.metricsType,
          environment: process.env.ENVIRONMENT || 'production'
        },
        extra: {
          ...alert,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Log alert summary
    console.log(`\n🚨 Alert Summary:`);
    console.log(`Critical: ${criticalAlerts.length}`);
    console.log(`Warnings: ${warningAlerts.length}`);
    
    if (criticalAlerts.length > 0) {
      console.log('\n🔴 Critical Alerts:');
      criticalAlerts.forEach(a => console.log(`- ${a.message}`));
    }
    
    if (warningAlerts.length > 0) {
      console.log('\n🟡 Warning Alerts:');
      warningAlerts.forEach(a => console.log(`- ${a.message}`));
    }
  }

  async sendHealthCheck(metrics, analysis) {
    const healthData = {
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'production',
      metricsType: this.metricsType,
      summary: {
        totalJobs: metrics?.summary?.totalJobs || 0,
        errorRate: metrics?.summary?.errorRate || 0,
        successRate: metrics?.summary?.successRate || 0,
        healthScore: metrics?.summary?.healthScore || 0,
        costSavings: analysis?.costSavings || 0
      },
      status: this.determineHealthStatus(metrics, analysis)
    };
    
    Sentry.withScope(scope => {
      scope.setTag('alert_type', 'health_check');
      scope.setTag('health_status', healthData.status);
      scope.setContext('health_data', healthData);
      
      Sentry.captureMessage(`Rollout health check: ${healthData.status}`, 'info');
    });
    
    console.log(`\n💊 Health Status: ${healthData.status.toUpperCase()}`);
  }

  determineHealthStatus(metrics, analysis) {
    if (!metrics) return 'unknown';
    
    const errorRate = metrics.summary?.errorRate || 0;
    const healthScore = metrics.summary?.healthScore || 0;
    
    if (errorRate >= this.thresholds.errorRate.critical || healthScore < 50) {
      return 'critical';
    } else if (errorRate >= this.thresholds.errorRate.warning || healthScore < 70) {
      return 'degraded';
    } else if (healthScore >= 90) {
      return 'excellent';
    } else {
      return 'healthy';
    }
  }
}

// Main execution
async function main() {
  const alertManager = new AlertManager();
  
  try {
    await alertManager.processAlerts();
    console.log('\n✅ Alert processing completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Alert manager failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AlertManager };