#!/usr/bin/env node

// Simple rate limit checker for GitHub Actions
// This script checks the GitHub API rate limit and outputs it in a format
// that can be consumed by GitHub Actions

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Fetch rate limit from GitHub API
fetch('https://api.github.com/rate_limit', {
  headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  }
})
.then(response => response.json())
.then(data => {
  const remaining = data.rate.remaining;
  const limit = data.rate.limit;
  
  // GitHub Actions output format
  console.log(`remaining=${remaining}`);
  console.log(`limit=${limit}`);
  
  // Warning if rate limit is low
  if (remaining < 500) {
    console.log(`::warning::Low rate limit remaining: ${remaining}`);
  }
  
  // Log for debugging
  console.error(`Rate limit: ${remaining}/${limit}`);
})
.catch(error => {
  console.error('Error checking rate limit:', error.message);
  // Default to high values to not block the workflow
  console.log('remaining=5000');
  console.log('limit=5000');
});