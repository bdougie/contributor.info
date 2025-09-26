export class RateLimitMonitor {
  constructor() {
    this.history = [];
    this.alerts = [];
    this.thresholds = {
      warning: 1000, // Warn when less than 1000 points remaining
      critical: 100, // Critical when less than 100 points remaining
      efficiency: 5, // Alert if average cost per query > 5 points
    };
  }

  track(rateLimit, queryType = 'unknown', itemsProcessed = 1) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      queryType,
      itemsProcessed,
      ...rateLimit,
    };

    this.history.push(entry);

    // Check thresholds
    this.checkThresholds(entry);

    // Clean old entries (keep last 24 hours)
    this.cleanOldEntries();

    return entry;
  }

  checkThresholds(entry) {
    const { remaining, cost } = entry;

    // Check remaining points
    if (remaining < this.thresholds.critical) {
      this.addAlert('critical', `Rate limit critical: ${remaining} points remaining`);
    } else if (remaining < this.thresholds.warning) {
      this.addAlert('warning', `Rate limit warning: ${remaining} points remaining`);
    }

    // Check query efficiency
    const efficiency = cost / entry.itemsProcessed;
    if (efficiency > this.thresholds.efficiency) {
      this.addAlert('info', `Query efficiency alert: ${efficiency.toFixed(2)} points per item`);
    }
  }

  addAlert(level, message) {
    const alert = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    this.alerts.push(alert);

    // Log to console
    const logFunc =
      level === 'critical' ? console.error : level === 'warning' ? console.warn : console.info;
    logFunc(`[RATE LIMIT ${level.toUpperCase()}] ${message}`);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  cleanOldEntries() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    this.history = this.history.filter((entry) => new Date(entry.timestamp) > cutoff);
  }

  getStats() {
    if (this.history.length === 0) {
      return null;
    }

    const recent = this.history.slice(-10); // Last 10 entries
    const totalCost = recent.reduce((sum, entry) => sum + entry.cost, 0);
    const totalItems = recent.reduce((sum, entry) => sum + entry.itemsProcessed, 0);

    return {
      totalQueries: this.history.length,
      recentQueries: recent.length,
      averageCost: totalCost / recent.length,
      averageEfficiency: totalItems > 0 ? totalCost / totalItems : 0,
      currentRemaining: this.history[this.history.length - 1]?.remaining || 0,
      currentLimit: this.history[this.history.length - 1]?.limit || 5000,
      alerts: this.alerts.length,
      lastUpdate: this.history[this.history.length - 1]?.timestamp,
    };
  }

  getEfficiencyReport() {
    const queryTypes = {};

    this.history.forEach((entry) => {
      if (!queryTypes[entry.queryType]) {
        queryTypes[entry.queryType] = {
          count: 0,
          totalCost: 0,
          totalItems: 0,
        };
      }

      const type = queryTypes[entry.queryType];
      type.count++;
      type.totalCost += entry.cost;
      type.totalItems += entry.itemsProcessed;
    });

    // Calculate efficiency for each query type
    const report = Object.entries(queryTypes).map(([type, data]) => ({
      queryType: type,
      count: data.count,
      averageCost: data.totalCost / data.count,
      efficiency: data.totalItems > 0 ? data.totalCost / data.totalItems : 0,
      totalPointsUsed: data.totalCost,
    }));

    // Sort by efficiency (ascending - lower is better)
    report.sort((a, b) => a.efficiency - b.efficiency);

    return report;
  }

  getAlerts(level = null) {
    if (level) {
      return this.alerts.filter((alert) => alert.level === level);
    }
    return this.alerts;
  }

  predict(queriesRemaining) {
    if (this.history.length === 0) {
      return null;
    }

    const recent = this.history.slice(-10);
    const averageCost = recent.reduce((sum, entry) => sum + entry.cost, 0) / recent.length;
    const currentRemaining = this.history[this.history.length - 1]?.remaining || 0;

    const predictedCost = queriesRemaining * averageCost;
    const willExceed = predictedCost > currentRemaining;

    return {
      queriesRemaining,
      averageCost: averageCost.toFixed(2),
      predictedCost: predictedCost.toFixed(0),
      currentRemaining,
      willExceedLimit: willExceed,
      safeQueries: Math.floor(currentRemaining / averageCost),
    };
  }

  generateReport() {
    const stats = this.getStats();
    const efficiency = this.getEfficiencyReport();
    const criticalAlerts = this.getAlerts('critical');
    const warningAlerts = this.getAlerts('warning');

    return {
      summary: stats,
      efficiency,
      alerts: {
        critical: criticalAlerts,
        warning: warningAlerts,
        total: this.alerts.length,
      },
      recommendations: this.generateRecommendations(),
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    const efficiency = this.getEfficiencyReport();

    if (!stats) {
      return recommendations;
    }

    // Check overall efficiency
    if (stats.averageEfficiency > 3) {
      recommendations.push({
        type: 'efficiency',
        priority: 'high',
        message: 'Consider using more specific GraphQL queries to reduce point usage',
      });
    }

    // Check for high-cost query types
    const highCostQueries = efficiency.filter((q) => q.averageCost > 10);
    if (highCostQueries.length > 0) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        message: `High-cost queries detected: ${highCostQueries.map((q) => q.queryType).join(', ')}`,
      });
    }

    // Check remaining rate limit
    if (stats.currentRemaining < 500) {
      recommendations.push({
        type: 'throttling',
        priority: 'critical',
        message: 'Consider implementing additional rate limiting or switching to REST API',
      });
    }

    return recommendations;
  }

  // Set custom thresholds
  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}
