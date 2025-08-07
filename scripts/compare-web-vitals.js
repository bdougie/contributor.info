#!/usr/bin/env node

/**
 * Compare Web Vitals between base branch and PR branch
 * Used in CI/CD to detect performance regressions
 */

import { getPageSpeedInsightsAPI } from '../src/lib/pagespeed-insights.js';
import chalk from 'chalk';

const BASE_URL = process.env.BASE_URL || 'https://contributor.info';
const PR_URL = process.env.PR_URL || 'https://deploy-preview-999--contributor-info.netlify.app';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const API_KEY = process.env.PAGESPEED_API_KEY;

// Regression thresholds (percentage change)
const REGRESSION_THRESHOLDS = {
  performanceScore: -5,  // 5% decrease
  LCP: 10,               // 10% increase (worse)
  FCP: 10,               // 10% increase (worse)
  CLS: 25,               // 25% increase (worse)
  TTI: 15,               // 15% increase (worse)
  TBT: 20,               // 20% increase (worse)
};

async function compareWebVitals() {
  console.log(chalk.blue('🔍 Comparing Web Vitals between base and PR...\n'));
  
  const api = getPageSpeedInsightsAPI(API_KEY);
  
  try {
    // Run tests for both URLs
    console.log(chalk.yellow('Testing base URL:'), BASE_URL);
    const baseResult = await api.runTest(BASE_URL);
    const baseMetrics = api.extractMetrics(baseResult);
    
    console.log(chalk.yellow('Testing PR URL:'), PR_URL);
    const prResult = await api.runTest(PR_URL);
    const prMetrics = api.extractMetrics(prResult);
    
    // Calculate changes
    const changes = calculateChanges(baseMetrics, prMetrics);
    
    // Check for regressions
    const regressions = checkRegressions(changes);
    
    // Generate report
    const report = generateReport(baseMetrics, prMetrics, changes, regressions);
    
    // Output report
    console.log(report);
    
    // Post to GitHub PR if token is available
    if (GITHUB_TOKEN && process.env.GITHUB_EVENT_NAME === 'pull_request') {
      await postToPR(report, regressions.length > 0);
    }
    
    // Exit with error if regressions found
    if (regressions.length > 0) {
      console.error(chalk.red(`\n❌ ${regressions.length} performance regression(s) detected!`));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ No performance regressions detected!'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error comparing Web Vitals:'), error);
    process.exit(1);
  }
}

function calculateChanges(base, pr) {
  return {
    performanceScore: {
      value: pr.performanceScore - base.performanceScore,
      percentage: ((pr.performanceScore - base.performanceScore) / base.performanceScore) * 100,
    },
    LCP: {
      value: pr.lcp - base.lcp,
      percentage: ((pr.lcp - base.lcp) / base.lcp) * 100,
    },
    FCP: {
      value: pr.fcp - base.fcp,
      percentage: ((pr.fcp - base.fcp) / base.fcp) * 100,
    },
    CLS: {
      value: pr.cls - base.cls,
      percentage: base.cls > 0 ? ((pr.cls - base.cls) / base.cls) * 100 : 0,
    },
    TTI: {
      value: pr.tti - base.tti,
      percentage: ((pr.tti - base.tti) / base.tti) * 100,
    },
    TBT: {
      value: pr.tbt - base.tbt,
      percentage: base.tbt > 0 ? ((pr.tbt - base.tbt) / base.tbt) * 100 : 0,
    },
  };
}

function checkRegressions(changes) {
  const regressions = [];
  
  // Check performance score (lower is worse)
  if (changes.performanceScore.percentage < REGRESSION_THRESHOLDS.performanceScore) {
    regressions.push({
      metric: 'Performance Score',
      change: changes.performanceScore.percentage,
      threshold: REGRESSION_THRESHOLDS.performanceScore,
    });
  }
  
  // Check metrics (higher is worse)
  const metrics = ['LCP', 'FCP', 'CLS', 'TTI', 'TBT'];
  metrics.forEach(metric => {
    if (changes[metric].percentage > REGRESSION_THRESHOLDS[metric]) {
      regressions.push({
        metric,
        change: changes[metric].percentage,
        threshold: REGRESSION_THRESHOLDS[metric],
      });
    }
  });
  
  return regressions;
}

function generateReport(base, pr, changes, regressions) {
  let report = '## 🚀 Web Vitals Comparison Report\n\n';
  
  // Summary
  const emoji = regressions.length === 0 ? '✅' : '⚠️';
  const status = regressions.length === 0 ? 'No regressions detected' : `${regressions.length} regression(s) found`;
  report += `**Status:** ${emoji} ${status}\n\n`;
  
  // Performance Score
  report += '### Performance Score\n';
  report += `- **Base:** ${base.performanceScore}/100\n`;
  report += `- **PR:** ${pr.performanceScore}/100\n`;
  report += `- **Change:** ${formatChange(changes.performanceScore)}\n\n`;
  
  // Core Web Vitals Table
  report += '### Core Web Vitals\n';
  report += '| Metric | Base | PR | Change | Status |\n';
  report += '|--------|------|----|--------|--------|\n';
  
  // LCP
  report += `| LCP | ${formatTime(base.lcp)} | ${formatTime(pr.lcp)} | ${formatChange(changes.LCP)} | ${getStatus('LCP', changes.LCP.percentage)} |\n`;
  
  // FCP
  report += `| FCP | ${formatTime(base.fcp)} | ${formatTime(pr.fcp)} | ${formatChange(changes.FCP)} | ${getStatus('FCP', changes.FCP.percentage)} |\n`;
  
  // CLS
  report += `| CLS | ${base.cls.toFixed(3)} | ${pr.cls.toFixed(3)} | ${formatChange(changes.CLS)} | ${getStatus('CLS', changes.CLS.percentage)} |\n`;
  
  // TTI
  report += `| TTI | ${formatTime(base.tti)} | ${formatTime(pr.tti)} | ${formatChange(changes.TTI)} | ${getStatus('TTI', changes.TTI.percentage)} |\n`;
  
  // TBT
  report += `| TBT | ${formatTime(base.tbt)} | ${formatTime(pr.tbt)} | ${formatChange(changes.TBT)} | ${getStatus('TBT', changes.TBT.percentage)} |\n`;
  
  // Regressions
  if (regressions.length > 0) {
    report += '\n### ⚠️ Performance Regressions\n';
    regressions.forEach(regression => {
      report += `- **${regression.metric}**: ${regression.change.toFixed(1)}% change exceeds ${regression.threshold}% threshold\n`;
    });
    
    report += '\n### Recommendations\n';
    report += '- Review recent changes that might impact performance\n';
    report += '- Run `npm run build:analyze` to check bundle sizes\n';
    report += '- Use Chrome DevTools Performance tab to identify bottlenecks\n';
    report += '- Consider implementing code splitting or lazy loading\n';
  } else {
    report += '\n### ✅ Performance Check Passed\n';
    report += 'All metrics are within acceptable thresholds.\n';
  }
  
  // Links
  report += '\n### 📊 Full Reports\n';
  report += `- [Base PageSpeed Report](https://pagespeed.web.dev/report?url=${encodeURIComponent(base.url)})\n`;
  report += `- [PR PageSpeed Report](https://pagespeed.web.dev/report?url=${encodeURIComponent(pr.url)})\n`;
  
  return report;
}

function formatTime(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatChange(change) {
  const sign = change.value > 0 ? '+' : '';
  const percentage = change.percentage.toFixed(1);
  
  if (Math.abs(change.percentage) < 1) {
    return '~0%';
  }
  
  return `${sign}${percentage}%`;
}

function getStatus(metric, changePercentage) {
  const threshold = REGRESSION_THRESHOLDS[metric];
  
  if (metric === 'performanceScore') {
    // Lower is worse for score
    if (changePercentage < -threshold) return '❌';
    if (changePercentage > 5) return '✅';
    return '➖';
  } else {
    // Higher is worse for metrics
    if (changePercentage > threshold) return '❌';
    if (changePercentage < -10) return '✅';
    return '➖';
  }
}

async function postToPR(report, hasRegressions) {
  try {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    
    const context = JSON.parse(process.env.GITHUB_CONTEXT || '{}');
    const { owner, repo } = context.repository;
    const prNumber = context.event.pull_request.number;
    
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: report,
    });
    
    // Add label if regressions found
    if (hasRegressions) {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels: ['performance-regression'],
      });
    }
    
  } catch (error) {
    console.error('Failed to post to PR:', error);
  }
}

// Run comparison
compareWebVitals();