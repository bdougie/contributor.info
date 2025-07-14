import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_TOKEN
);

async function checkRolloutHealth() {
  console.log('🔍 Checking Rollout Health...\n');

  // Get current rollout config
  const { data: config, error: configError } = await supabase
    .from('rollout_configuration')
    .select('*')
    .eq('feature_name', 'hybrid_progressive_capture')
    .single();

  if (configError) {
    console.error('Error fetching config:', configError);
    return;
  }

  console.log('📊 Current Rollout Configuration:');
  console.log(`   Percentage: ${config.rollout_percentage}%`);
  console.log(`   Emergency Stop: ${config.emergency_stop ? '🚨 ACTIVE' : '✅ Inactive'}`);
  console.log(`   Auto Rollback: ${config.auto_rollback_enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Strategy: ${config.rollout_strategy}`);
  console.log(`   Max Error Rate: ${config.max_error_rate}%`);

  // Get recent metrics
  const { data: metrics, error: metricsError } = await supabase
    .from('rollout_metrics')
    .select('*')
    .eq('rollout_config_id', config.id)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (!metricsError && metrics && metrics.length > 0) {
    console.log('\n📈 Recent Metrics (Last 24 hours):');
    
    // Aggregate metrics by processor type
    const aggregated = metrics.reduce((acc, m) => {
      if (!acc[m.processor_type]) {
        acc[m.processor_type] = { success: 0, errors: 0, total: 0 };
      }
      acc[m.processor_type].success += m.success_count;
      acc[m.processor_type].errors += m.error_count;
      acc[m.processor_type].total += m.total_jobs;
      return acc;
    }, {});

    Object.entries(aggregated).forEach(([processor, stats]) => {
      const errorRate = stats.total > 0 ? (stats.errors / stats.total * 100).toFixed(2) : 0;
      console.log(`   ${processor}: ${stats.success}/${stats.total} success (${errorRate}% error rate)`);
    });

    // Show recent errors
    const recentErrors = metrics.filter(m => m.last_error_message);
    if (recentErrors.length > 0) {
      console.log('\n❌ Recent Errors:');
      recentErrors.slice(0, 3).forEach(m => {
        console.log(`   ${m.processor_type}: ${m.last_error_message}`);
      });
    }
  }

  // Check rollout history
  const { data: history, error: historyError } = await supabase
    .from('rollout_history')
    .select('*')
    .eq('rollout_config_id', config.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!historyError && history && history.length > 0) {
    console.log('\n📜 Recent Rollout History:');
    history.forEach(h => {
      const time = new Date(h.created_at).toLocaleString();
      console.log(`   ${h.action}: ${h.previous_percentage}% → ${h.new_percentage}%`);
      console.log(`   Reason: ${h.reason}`);
      console.log(`   By: ${h.triggered_by} at ${time}`);
      console.log('');
    });
  }

  // Check recent jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('progressive_capture_jobs')
    .select('*')
    .eq('processor_type', 'github_actions')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!jobsError && jobs && jobs.length > 0) {
    console.log('\n🚀 Recent GitHub Actions Jobs:');
    jobs.forEach(job => {
      console.log(`   ${job.job_type} - ${job.status} (${job.repository_id})`);
      if (job.error) {
        console.log(`   Error: ${job.error}`);
      }
    });
  }

  // Diagnosis
  console.log('\n🔍 Diagnosis:');
  if (config.rollout_percentage === 0) {
    console.log('⚠️  Rollout is at 0% - likely due to auto-rollback');
    console.log('   Check error rates and GitHub Actions failures');
  }
  if (config.emergency_stop) {
    console.log('🚨 Emergency stop is ACTIVE - manual intervention required');
    console.log('   Run: rollout.resume() to restart');
  }
}

checkRolloutHealth().catch(console.error);