#!/usr/bin/env node

/**
 * Updates the tracked-repositories.txt file with the current list of repositories from Supabase
 * This script is run during the release process to ensure the list is always up-to-date
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTrackedRepositories() {
  try {
    console.log('📊 Fetching tracked repositories from Supabase...');

    // Fetch all repositories
    const { data: repositories, error } = await supabase
      .from('repositories')
      .select('owner, name')
      .not('owner', 'is', null)
      .not('name', 'is', null)
      .order('owner', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }

    console.log(`✅ Found ${repositories.length} repositories`);

    // Format repositories as owner/name
    const repoList = repositories.map((repo) => `${repo.owner}/${repo.name}`).join('\n');

    // Write to file
    const outputPath = path.join(__dirname, '..', 'tracked-repositories.txt');
    await fs.writeFile(outputPath, repoList + '\n', 'utf-8');

    console.log(`✅ Updated tracked-repositories.txt with ${repositories.length} repositories`);

    // Also create a JSON version for programmatic access
    const jsonPath = path.join(__dirname, '..', 'tracked-repositories.json');
    await fs.writeFile(jsonPath, JSON.stringify(repositories, null, 2) + '\n', 'utf-8');

    console.log('✅ Also created tracked-repositories.json');

    // Generate statistics
    const stats = {
      total_repositories: repositories.length,
      organizations: [...new Set(repositories.map((r) => r.owner))].length,
      generated_at: new Date().toISOString(),
    };

    console.log('\n📈 Statistics:');
    console.log(`   Total repositories: ${stats.total_repositories}`);
    console.log(`   Unique organizations: ${stats.organizations}`);

    // Write stats to a separate file
    const statsPath = path.join(__dirname, '..', 'tracked-repositories-stats.json');
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2) + '\n', 'utf-8');

    return stats;
  } catch (error) {
    console.error('❌ Error updating tracked repositories:', error.message);
    process.exit(1);
  }
}

// Run the update
updateTrackedRepositories()
  .then((stats) => {
    console.log('\n✨ Successfully updated tracked repositories list');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to update tracked repositories:', error);
    process.exit(1);
  });
