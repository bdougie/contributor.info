import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_TOKEN;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateRollout(percentage) {
  try {
    // First, get the current configuration
    const { data: config, error: fetchError } = await supabase
      .from('rollout_configuration')
      .select('*')
      .eq('feature_name', 'hybrid_progressive_capture')
      .eq('is_active', true)
      .single();

    if (fetchError) {
      console.error('Error fetching rollout configuration:', fetchError);
      return;
    }

    console.log('Current rollout configuration:');
    console.log(`- Feature: ${config.feature_name}`);
    console.log(`- Current percentage: ${config.rollout_percentage}%`);
    console.log(`- Strategy: ${config.rollout_strategy}`);
    console.log(`- Emergency stop: ${config.emergency_stop}`);
    console.log(`- Auto rollback: ${config.auto_rollback_enabled}`);

    // Update the rollout percentage
    const { error: updateError } = await supabase
      .from('rollout_configuration')
      .update({
        rollout_percentage: percentage,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (updateError) {
      console.error('Error updating rollout percentage:', updateError);
      return;
    }

    // Log the change in rollout history
    const { error: historyError } = await supabase
      .from('rollout_history')
      .insert({
        rollout_config_id: config.id,
        action: 'updated',
        previous_percentage: config.rollout_percentage,
        new_percentage: percentage,
        reason: `Rollout percentage updated from ${config.rollout_percentage}% to ${percentage}%`,
        triggered_by: 'manual',
        metadata: { timestamp: new Date().toISOString() }
      });

    if (historyError) {
      console.error('Error logging rollout history:', historyError);
    }

    console.log(`\n✅ Successfully updated rollout percentage from ${config.rollout_percentage}% to ${percentage}%`);
  } catch (error) {
    console.error('Exception updating rollout:', error);
  }
}

// Update to 25%
updateRollout(25);