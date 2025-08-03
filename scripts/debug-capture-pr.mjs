#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function debugCapture() {
  console.log('🔍 Debug PR Capture for vitejs/vite #20525\n');

  // Get repository and PR info
  const { data: repo } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', 'vitejs')
    .eq('name', 'vite')
    .single();

  const { data: pr } = await supabase
    .from('pull_requests')
    .select('id, github_id')
    .eq('repository_id', repo.id)
    .eq('number', 20525)
    .single();

  console.log('Repository ID:', repo.id);
  console.log('PR ID:', pr.id);
  console.log('PR GitHub ID:', pr.github_id);

  // Send GraphQL details event
  const event = {
    eventName: 'capture/pr.details.graphql',
    data: {
      repositoryId: repo.id,
      prNumber: '20525',
      prId: pr.id,
      priority: 'high'
    }
  };

  console.log('\n📨 Sending event:', JSON.stringify(event, null, 2));

  try {
    const response = await fetch('http://localhost:8888/api/queue-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    const result = await response.json();
    console.log('\n✅ Response:', result);
    
    if (result.success) {
      console.log('\n⏳ Wait a few seconds then check:');
      console.log('1. Inngest dashboard for function execution');
      console.log('2. Database for new comments/reviews');
      console.log('3. Sync logs table for execution details');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCapture();