#!/usr/bin/env node

const { config } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function triggerUpdates() {
  console.log('🔄 Starting PR activity update job...');
  
  // Get repository ID from environment variables (passed from GitHub Actions)
  const repositoryId = process.env.REPOSITORY_ID;
  const days = parseInt(process.env.DAYS) || 7;
  
  if (repositoryId) {
    // Update specific repository
    console.log('📦 Updating single repository: %s', repositoryId);
    await sendUpdateEvent(repositoryId, days);
  } else {
    // Update all tracked repositories
    const { data: repos, error } = await supabase
      .from('tracked_repositories')
      .select('repository_id, repositories!inner(owner, name)')
      .eq('is_active', true);
      
    if (error) {
      console.error('Failed to fetch tracked repositories:', error);
      process.exit(1);
    }
    
    console.log('📦 Found %d tracked repositories to update', repos?.length || 0);
    
    if (!repos || repos.length === 0) {
      console.log('⚠️  No active tracked repositories found');
      return;
    }
    
    for (const repo of repos) {
      const { owner, name } = repo.repositories;
      console.log('  - Updating %s/%s...', owner, name);
      await sendUpdateEvent(repo.repository_id, days);
      // Small delay to avoid overwhelming the API
      const delayMs = parseInt(process.env.UPDATE_DELAY_MS || '1000');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.log('✅ All update events sent successfully!');
}

async function sendUpdateEvent(repositoryId, days) {
  const eventData = {
    eventName: 'update/pr.activity',
    data: {
      repositoryId,
      days
    }
  };
  
  const apiEndpoint = process.env.API_ENDPOINT || 'https://contributor.info/api/queue-event';
  const authToken = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY;
  
  if (!authToken) {
    throw new Error('No authentication token found (INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY)');
  }
  
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(eventData)
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    }
    
    const result = await response.json();
    console.log('    ✓ Event ID: %s', result.eventId);
  } catch (error) {
    console.error('    ✗ Failed to send event: %s', error.message);
    throw error;
  }
}

// Run the main function
triggerUpdates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});