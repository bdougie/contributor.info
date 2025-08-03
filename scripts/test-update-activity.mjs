#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdateActivity() {
  console.log('🔄 Testing PR activity update functionality...\n');

  // Find vitejs/vite repository
  const { data: repo } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .eq('owner', 'vitejs')
    .eq('name', 'vite')
    .single();

  if (!repo) {
    console.error('❌ vitejs/vite repository not found');
    return;
  }

  console.log(`📦 Found repository: ${repo.owner}/${repo.name}`);
  console.log(`   ID: ${repo.id}\n`);

  // Trigger update activity event
  const eventData = {
    eventName: 'update/pr.activity',
    data: {
      repositoryId: repo.id,
      days: 30 // Check PRs from last 30 days
    }
  };

  console.log('🚀 Sending update activity event...\n');

  try {
    const response = await fetch('http://localhost:8888/api/queue-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Update activity event sent successfully!');
      console.log('   Event ID:', result.eventId);
      console.log('\n📊 This will check all open PRs and recent PRs for new comments/reviews');
      console.log('   Check Inngest dashboard for progress');
    } else {
      console.error('❌ Failed:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUpdateActivity();