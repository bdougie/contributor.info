#!/usr/bin/env node

/**
 * Automated PR Data Corruption Monitor
 * Run this script periodically (e.g., every hour via cron) to detect and alert on data corruption
 *
 * Usage:
 *   node corruption-monitor.js                    # Run all checks
 *   node corruption-monitor.js --alert-only       # Only run critical alert checks
 *   node corruption-monitor.js --webhook <url>    # Send alerts to webhook
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  console.error('Please set VITE_SUPABASE_URL to your Supabase project URL');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  console.error('Please set VITE_SUPABASE_ANON_KEY to your Supabase anonymous key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const alertOnly = args.includes('--alert-only');
const webhookUrl = args.includes('--webhook') ? args[args.indexOf('--webhook') + 1] : null;

// Corruption detection thresholds
const THRESHOLDS = {
  CRITICAL_COUNT: 20, // More than 20 corrupted PRs in an hour
  WARNING_PERCENTAGE: 50, // More than 50% corruption rate
  ALERT_PERCENTAGE: 10, // More than 10% corruption rate for alerts
};

async function checkRecentCorruption() {
  const { data, error } = await supabase
    .from('pull_requests')
    .select(
      `
      id, number, 
      additions, deletions, changed_files, commits,
      repositories!inner(owner, name)
    `
    )
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    .eq('additions', 0)
    .eq('deletions', 0)
    .eq('changed_files', 0)
    .eq('commits', 0);

  if (error) {
    console.error('Error checking recent corruption:', error);
    return { status: 'ERROR', message: error.message };
  }

  const corruptedCount = data?.length || 0;

  if (corruptedCount > THRESHOLDS.CRITICAL_COUNT) {
    return {
      status: 'CRITICAL',
      message: `Found ${corruptedCount} corrupted PRs in the last hour`,
      data: data.map((pr) => `${pr.repositories.owner}/${pr.repositories.name}#${pr.number}`),
    };
  }

  if (corruptedCount > 0) {
    return {
      status: 'WARNING',
      message: `Found ${corruptedCount} corrupted PRs in the last hour`,
      data: data.map((pr) => `${pr.repositories.owner}/${pr.repositories.name}#${pr.number}`),
    };
  }

  return { status: 'OK', message: 'No corrupted PRs found in the last hour' };
}

async function checkRepositoryHealth() {
  // Get active repositories
  const { data: repos, error: repoError } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .eq('is_active', true);

  if (repoError) {
    console.error('Error fetching repositories:', repoError);
    return { status: 'ERROR', message: repoError.message };
  }

  const unhealthyRepos = [];

  for (const repo of repos || []) {
    // Check last 2 hours of PRs for this repo
    const { data: prs, error: prError } = await supabase
      .from('pull_requests')
      .select('id, additions, deletions, changed_files, commits')
      .eq('repository_id', repo.id)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (prError) {
      console.error(`Error fetching PRs for ${repo.owner}/${repo.name}:`, prError.message);
      continue;
    }

    const total = prs?.length || 0;
    if (total === 0) continue;

    const corrupted = prs.filter(
      (pr) => pr.additions === 0 && pr.deletions === 0 && pr.changed_files === 0 && pr.commits === 0
    ).length;

    const corruptionRate = (corrupted / total) * 100;

    if (corruptionRate > THRESHOLDS.WARNING_PERCENTAGE) {
      unhealthyRepos.push({
        repo: `${repo.owner}/${repo.name}`,
        total,
        corrupted,
        rate: corruptionRate.toFixed(2),
      });
    }
  }

  if (unhealthyRepos.length > 0) {
    return {
      status: 'WARNING',
      message: `${unhealthyRepos.length} repositories have high corruption rates`,
      data: unhealthyRepos,
    };
  }

  return { status: 'OK', message: 'All repositories healthy' };
}

async function checkCorruptionTrend() {
  const hourlyStats = [];

  for (let i = 0; i < 24; i++) {
    const startTime = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
    const endTime = new Date(Date.now() - i * 60 * 60 * 1000);

    try {
      const { count: total, error: totalError } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startTime.toISOString())
        .lt('created_at', endTime.toISOString());

      if (totalError) {
        console.error(`Error fetching total count for hour ${i}:`, totalError.message);
        continue;
      }

      const { count: corrupted, error: corruptedError } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startTime.toISOString())
        .lt('created_at', endTime.toISOString())
        .eq('additions', 0)
        .eq('deletions', 0)
        .eq('changed_files', 0)
        .eq('commits', 0);

      if (corruptedError) {
        console.error(`Error fetching corrupted count for hour ${i}:`, corruptedError.message);
        continue;
      }

      hourlyStats.push({
        hour: `${i}h ago`,
        total: total || 0,
        corrupted: corrupted || 0,
        rate: total ? (((corrupted || 0) / total) * 100).toFixed(2) : 0,
      });
    } catch (error) {
      console.error(`Error processing hour ${i} stats:`, error.message);
      continue;
    }
  }

  // Check if corruption is increasing
  const recentHours = hourlyStats.slice(0, 3);
  const olderHours = hourlyStats.slice(3, 6);

  const recentAvg = recentHours.reduce((sum, h) => sum + parseFloat(h.rate), 0) / 3;
  const olderAvg = olderHours.reduce((sum, h) => sum + parseFloat(h.rate), 0) / 3;

  if (recentAvg > olderAvg * 2 && recentAvg > THRESHOLDS.ALERT_PERCENTAGE) {
    return {
      status: 'WARNING',
      message: `Corruption rate increasing: ${recentAvg.toFixed(2)}% (recent) vs ${olderAvg.toFixed(2)}% (older)`,
      data: hourlyStats.slice(0, 6),
    };
  }

  return {
    status: 'OK',
    message: 'Corruption trend stable',
    recentRate: recentAvg.toFixed(2),
    historicalRate: olderAvg.toFixed(2),
  };
}

async function sendAlert(alertData) {
  if (!webhookUrl) {
    console.log('📢 Alert:', JSON.stringify(alertData, null, 2));
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `PR Data Corruption Alert: ${alertData.status}`,
        ...alertData,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send webhook alert:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending webhook alert:', error);
  }
}

async function runMonitoring() {
  console.log('🔍 PR Data Corruption Monitor - Starting checks...');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('─'.repeat(50));

  const results = {
    timestamp: new Date().toISOString(),
    checks: [],
  };

  // Check 1: Recent corruption
  console.log('\n📊 Checking recent corruption...');
  const recentCheck = await checkRecentCorruption();
  results.checks.push({ name: 'Recent Corruption', ...recentCheck });
  console.log(`  Status: ${recentCheck.status}`);
  console.log(`  ${recentCheck.message}`);

  if (!alertOnly) {
    // Check 2: Repository health
    console.log('\n🏥 Checking repository health...');
    const healthCheck = await checkRepositoryHealth();
    results.checks.push({ name: 'Repository Health', ...healthCheck });
    console.log(`  Status: ${healthCheck.status}`);
    console.log(`  ${healthCheck.message}`);

    // Check 3: Corruption trend
    console.log('\n📈 Checking corruption trend...');
    const trendCheck = await checkCorruptionTrend();
    results.checks.push({ name: 'Corruption Trend', ...trendCheck });
    console.log(`  Status: ${trendCheck.status}`);
    console.log(`  ${trendCheck.message}`);
  }

  // Determine overall status
  const criticalChecks = results.checks.filter((c) => c.status === 'CRITICAL');
  const warningChecks = results.checks.filter((c) => c.status === 'WARNING');

  if (criticalChecks.length > 0) {
    results.overallStatus = 'CRITICAL';
    console.log('\n🚨 CRITICAL: Immediate action required!');
    await sendAlert({ ...results, severity: 'CRITICAL' });
  } else if (warningChecks.length > 0) {
    results.overallStatus = 'WARNING';
    console.log('\n⚠️ WARNING: Potential issues detected');
    await sendAlert({ ...results, severity: 'WARNING' });
  } else {
    results.overallStatus = 'OK';
    console.log('\n✅ OK: No corruption issues detected');
  }

  console.log('\n' + '─'.repeat(50));
  console.log('Monitor check complete\n');

  return results;
}

// Run the monitoring
runMonitoring()
  .then((results) => {
    if (results.overallStatus === 'CRITICAL') {
      process.exit(2); // Exit code 2 for critical
    } else if (results.overallStatus === 'WARNING') {
      process.exit(1); // Exit code 1 for warning
    } else {
      process.exit(0); // Exit code 0 for OK
    }
  })
  .catch((error) => {
    console.error('Monitor failed:', error);
    process.exit(3); // Exit code 3 for error
  });
