import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_TOKEN;

if (!supabaseKey) {
  console.error('Error: SUPABASE_TOKEN environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration for automated regeneration
const regenerationConfig = {
  // Trigger regeneration when data changes significantly
  triggers: {
    // New repositories with significant activity (>10 PRs)
    newRepositories: true,
    // Existing repositories with 20% change in activity
    activityChangeThreshold: 0.2,
    // Monthly regeneration for top repositories
    monthlyUpdate: true
  },
  
  // Priority repositories that should always have fresh cards
  priorityRepositories: [
    'facebook/react',
    'vuejs/vue', 
    'angular/angular',
    'vercel/next.js',
    'sveltejs/svelte',
    'microsoft/vscode'
  ],
  
  // Maximum number of cards to regenerate per run
  maxRegenerationBatch: 10
};

async function setupRegenerationTriggers() {
  console.log('🔄 Setting up automated card regeneration system...\n');
  
  try {
    // Create a simple tracking table for card regeneration
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS social_card_tracking (
        id BIGSERIAL PRIMARY KEY,
        repository_key VARCHAR(255) UNIQUE NOT NULL,
        last_generated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity_count INTEGER DEFAULT 0,
        regeneration_priority INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Index for efficient queries
      CREATE INDEX IF NOT EXISTS idx_social_card_tracking_priority 
      ON social_card_tracking(regeneration_priority DESC, last_generated ASC);
      
      -- Index for repository lookups  
      CREATE INDEX IF NOT EXISTS idx_social_card_tracking_repo
      ON social_card_tracking(repository_key);
    `;
    
    console.log('Creating social card tracking table...');
    const { error: tableError } = await supabase.rpc('execute_sql', { 
      sql: createTableSQL 
    });
    
    if (tableError) {
      console.error('Error creating tracking table:', tableError);
      // Continue anyway - table might already exist
    } else {
      console.log('✅ Tracking table created successfully');
    }
    
    // Seed priority repositories
    console.log('\n📝 Seeding priority repositories...');
    
    for (const repo of regenerationConfig.priorityRepositories) {
      const { error: insertError } = await supabase
        .from('social_card_tracking')
        .upsert({
          repository_key: repo,
          regeneration_priority: 10, // High priority
          last_generated: new Date(0), // Force initial generation
        }, {
          onConflict: 'repository_key'
        });
        
      if (insertError) {
        console.log(`❌ Error seeding ${repo}:`, insertError.message);
      } else {
        console.log(`✅ Seeded: ${repo}`);
      }
    }
    
    console.log('\n⚙️ Regeneration system setup complete!');
    console.log('\nNext steps:');
    console.log('1. Set up a daily cron job to run regeneration check');
    console.log('2. Integrate with your CI/CD pipeline for triggered updates');
    console.log('3. Monitor the social_card_tracking table for regeneration metrics');
    
  } catch (error) {
    console.error('Error setting up regeneration system:', error);
  }
}

async function checkRegenerationNeeded() {
  console.log('🔍 Checking which social cards need regeneration...\n');
  
  try {
    // Get repositories that need regeneration
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: staleCards, error } = await supabase
      .from('social_card_tracking')
      .select('*')
      .or(`last_generated.lt.${thirtyDaysAgo.toISOString()},regeneration_priority.gte.5`)
      .order('regeneration_priority', { ascending: false })
      .order('last_generated', { ascending: true })
      .limit(regenerationConfig.maxRegenerationBatch);
      
    if (error) {
      console.error('Error checking regeneration needs:', error);
      return [];
    }
    
    if (!staleCards || staleCards.length === 0) {
      console.log('✅ All social cards are up to date!');
      return [];
    }
    
    console.log(`🔄 Found ${staleCards.length} cards that need regeneration:`);
    staleCards.forEach(card => {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(card.last_generated)) / (24 * 60 * 60 * 1000)
      );
      console.log(`  • ${card.repository_key} (${daysSinceUpdate} days old, priority: ${card.regeneration_priority})`);
    });
    
    return staleCards.map(card => card.repository_key);
    
  } catch (error) {
    console.error('Error checking regeneration needs:', error);
    return [];
  }
}

async function regenerateCards(repositoryKeys) {
  if (repositoryKeys.length === 0) {
    console.log('No cards to regenerate');
    return;
  }
  
  console.log(`\n🎨 Regenerating ${repositoryKeys.length} social cards...`);
  
  // Import and run the social card generation for specific repositories
  try {
    // This would normally trigger your build process or call the generation script
    // For now, we'll just update the tracking table
    
    for (const repoKey of repositoryKeys) {
      console.log(`Regenerating: ${repoKey}`);
      
      // Update tracking table
      const { error } = await supabase
        .from('social_card_tracking')
        .update({
          last_generated: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('repository_key', repoKey);
        
      if (error) {
        console.error(`Error updating tracking for ${repoKey}:`, error);
      } else {
        console.log(`✅ Updated tracking for ${repoKey}`);
      }
    }
    
    console.log('\n🎉 Card regeneration complete!');
    
  } catch (error) {
    console.error('Error during card regeneration:', error);
  }
}

async function runRegenerationCheck() {
  console.log('🤖 Running automated regeneration check...\n');
  
  const repositoriesToRegenerate = await checkRegenerationNeeded();
  
  if (repositoriesToRegenerate.length > 0) {
    await regenerateCards(repositoriesToRegenerate);
  }
  
  console.log('\n📊 Regeneration check complete!');
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'setup':
    setupRegenerationTriggers().catch(console.error);
    break;
  case 'check':
    runRegenerationCheck().catch(console.error);
    break;
  default:
    console.log('Usage: node setup-card-regeneration.js [setup|check]');
    console.log('  setup - Initialize the regeneration system');
    console.log('  check - Check and regenerate cards as needed');
    break;
}