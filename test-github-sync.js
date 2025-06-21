#!/usr/bin/env node

// Test script to verify GitHub sync functionality
// Run with: node test-github-sync.js

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('VITE_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testTrackedRepositories() {
  console.log('\n=== Testing tracked_repositories table ===')
  
  const testRepo = {
    organization_name: 'test-org',
    repository_name: 'test-repo'
  }
  
  try {
    // Try to insert a test repository
    console.log('Inserting test repository...')
    const { data: insertData, error: insertError } = await supabase
      .from('tracked_repositories')
      .insert(testRepo)
      .select()
      .single()
    
    if (insertError) {
      console.error('Insert error:', insertError)
    } else {
      console.log('Insert successful:', insertData)
      
      // Clean up
      const { error: deleteError } = await supabase
        .from('tracked_repositories')
        .delete()
        .eq('id', insertData.id)
      
      if (deleteError) {
        console.error('Cleanup error:', deleteError)
      } else {
        console.log('Cleanup successful')
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

async function checkExistingData() {
  console.log('\n=== Checking existing data ===')
  
  try {
    // Check tracked repositories
    const { data: tracked, error: trackedError } = await supabase
      .from('tracked_repositories')
      .select('*')
      .limit(5)
    
    if (trackedError) {
      console.error('Error fetching tracked repos:', trackedError)
    } else {
      console.log(`Found ${tracked?.length || 0} tracked repositories`)
      tracked?.forEach((repo, i) => {
        console.log(`  ${i + 1}. ${repo.organization_name}/${repo.repository_name} (ID: ${repo.repository_id || 'none'})`)
      })
    }
    
    // Check repositories
    const { data: repos, error: reposError } = await supabase
      .from('repositories')
      .select('id, owner, name')
      .limit(5)
    
    if (reposError) {
      console.error('Error fetching repositories:', reposError)
    } else {
      console.log(`\nFound ${repos?.length || 0} repositories`)
      repos?.forEach((repo, i) => {
        console.log(`  ${i + 1}. ${repo.owner}/${repo.name} (ID: ${repo.id})`)
      })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

async function testGitHubSync() {
  console.log('\n=== Testing GitHub Sync Edge Function ===')
  
  const testRepo = {
    owner: 'continuedev',
    repository: 'continue'
  }
  
  try {
    console.log(`Testing sync for ${testRepo.owner}/${testRepo.repository}`)
    
    const response = await fetch(`${supabaseUrl}/functions/v1/github-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRepo)
    })
    
    const result = await response.json()
    console.log('Response status:', response.status)
    console.log('Response data:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Error calling edge function:', error)
  }
}

async function main() {
  console.log('Starting GitHub Sync Tests...')
  console.log('Supabase URL:', supabaseUrl)
  
  await checkExistingData()
  await testTrackedRepositories()
  await testGitHubSync()
  
  console.log('\nTests completed!')
}

main().catch(console.error)