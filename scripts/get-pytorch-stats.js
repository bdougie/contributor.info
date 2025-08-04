#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

const octokit = new Octokit({
  auth: process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN
});

async function getPytorchStats() {
  try {
    console.log('📊 Fetching pytorch/pytorch repository stats...\n');
    
    const { data: repo } = await octokit.repos.get({
      owner: 'pytorch',
      repo: 'pytorch'
    });

    console.log('Repository Statistics:');
    console.log(`  Name: ${repo.full_name}`);
    console.log(`  Stars: ${repo.stargazers_count}`);
    console.log(`  Forks: ${repo.forks_count}`);
    console.log(`  Open Issues: ${repo.open_issues_count}`);
    console.log(`  Created: ${new Date(repo.created_at).toLocaleDateString()}`);
    console.log(`  Size: ${(repo.size / 1024).toFixed(2)} MB`);
    
    // Get PR counts
    console.log('\n📝 Fetching pull request counts...');
    
    // Get open PRs count
    const { data: openPRs } = await octokit.pulls.list({
      owner: 'pytorch',
      repo: 'pytorch',
      state: 'open',
      per_page: 1
    });
    
    // Get closed PRs count - use search API for better results
    const { data: searchResults } = await octokit.search.issuesAndPullRequests({
      q: 'repo:pytorch/pytorch type:pr',
      per_page: 1
    });
    
    console.log(`\nPull Request Statistics:`);
    console.log(`  Total PRs (all time): ${searchResults.total_count}`);
    
    // Get more detailed counts
    const { data: closedSearch } = await octokit.search.issuesAndPullRequests({
      q: 'repo:pytorch/pytorch type:pr state:closed',
      per_page: 1
    });
    
    const { data: openSearch } = await octokit.search.issuesAndPullRequests({
      q: 'repo:pytorch/pytorch type:pr state:open',
      per_page: 1
    });
    
    console.log(`  Open PRs: ${openSearch.total_count}`);
    console.log(`  Closed PRs: ${closedSearch.total_count}`);
    
    console.log('\n✅ This is the actual data from GitHub.');
    console.log('💡 The repository needs to be updated with the correct PR count.');
    
    return {
      totalPRs: searchResults.total_count,
      openPRs: openSearch.total_count,
      closedPRs: closedSearch.total_count
    };
    
  } catch (error) {
    console.error('❌ Error fetching repository stats:', error.message);
    if (error.status === 404) {
      console.error('   Repository not found. Check permissions.');
    } else if (error.status === 403) {
      console.error('   Rate limit exceeded or insufficient permissions.');
    }
  }
}

getPytorchStats();