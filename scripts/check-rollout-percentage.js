import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_TOKEN
);

async function checkAndUpdateRollout() {
  console.log('🔍 Checking rollout percentage in database...\n');

  // Get current rollout config
  const { data: config, error } = await supabase
    .from('rollout_configuration')
    .select('*')
    .eq('feature_name', 'hybrid_progressive_capture')
    .single();

  if (error) {
    console.error('Error fetching config:', error);
    return;
  }

  console.log('Current Database Values:');
  console.log(`- Rollout Percentage: ${config.rollout_percentage}%`);
  console.log(`- Emergency Stop: ${config.emergency_stop}`);
  console.log(`- Strategy: ${config.rollout_strategy}`);
  console.log(`- Last Updated: ${new Date(config.updated_at).toLocaleString()}`);

  if (config.rollout_percentage !== 10) {
    console.log('\n⚠️  Rollout is not at 10% as expected');
    console.log('Would you like to update it to 10%?');
    
    // Update to 10%
    const { error: updateError } = await supabase
      .from('rollout_configuration')
      .update({
        rollout_percentage: 10,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    if (updateError) {
      console.error('Error updating rollout:', updateError);
    } else {
      console.log('\n✅ Updated rollout to 10%');
      
      // Log the change
      await supabase
        .from('rollout_history')
        .insert({
          rollout_config_id: config.id,
          action: 'updated',
          previous_percentage: config.rollout_percentage,
          new_percentage: 10,
          reason: 'Reset to intended 10% rollout for GitHub Actions testing',
          triggered_by: 'manual',
          metadata: { timestamp: new Date().toISOString() }
        });
    }
  } else {
    console.log('\n✅ Rollout is already at 10%');
  }
}

checkAndUpdateRollout().catch(console.error);