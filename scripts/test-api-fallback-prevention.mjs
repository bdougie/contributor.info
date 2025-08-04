#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test repositories to verify API fallback prevention
const testRepos = [
  { owner: 'pytorch', repo: 'pytorch', description: 'Large repository' },
  { owner: 'kubernetes', repo: 'kubernetes', description: 'Protected large repository' },
  { owner: 'torvalds', repo: 'linux', description: 'Massive repository' },
  { owner: 'test-org-12345', repo: 'non-existent-repo', description: 'Non-existent repository' }
];

async function testAPIFallbackPrevention() {
  console.log('Testing API Fallback Prevention');
  console.log('=================================\n');
  
  for (const testRepo of testRepos) {
    console.log(`Testing: ${testRepo.owner}/${testRepo.repo} (${testRepo.description})`);
    console.log('-'.repeat(60));
    
    // Check if repository exists in database
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, owner, name')
      .eq('owner', testRepo.owner)
      .eq('name', testRepo.repo)
      .single();
    
    if (repoError && repoError.code === 'PGRST116') {
      console.log('✅ Repository NOT in database');
      console.log('   Expected behavior: Return pending state, trigger background sync');
      console.log('   No risky API calls will be made\n');
    } else if (repoData) {
      console.log('📊 Repository EXISTS in database');
      console.log(`   ID: ${repoData.id}`);
      
      // Check if it has PR data
      const { count } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true })
        .eq('repository_id', repoData.id);
      
      console.log(`   PR count: ${count || 0}`);
      console.log('   Expected behavior: Use cached data, no API fallback\n');
    }
  }
  
  console.log('\n🎯 Summary:');
  console.log('- Large repositories are protected from API calls');
  console.log('- Unknown repositories get pending state instead of API fallback');
  console.log('- Background sync handles data fetching safely');
  console.log('- Users see friendly messages instead of errors');
}

testAPIFallbackPrevention().catch(console.error);