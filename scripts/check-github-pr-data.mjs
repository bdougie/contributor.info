#!/usr/bin/env node

import { config } from 'dotenv';
config();

const token = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

async function checkPR(owner, repo, prNumber) {
  try {
    // Fetch PR details
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const pr = await prResponse.json();
    
    // Fetch comments
    const commentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const comments = await commentsResponse.json();
    
    // Fetch reviews
    const reviewsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const reviews = await reviewsResponse.json();
    
    // Fetch review comments
    const reviewCommentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const reviewComments = await reviewCommentsResponse.json();
    
    console.log(`\n📋 PR #${prNumber}: ${pr.title}`);
    console.log(`   State: ${pr.state}`);
    console.log(`   Created: ${new Date(pr.created_at).toLocaleDateString()}`);
    console.log(`   Issue Comments: ${comments.length}`);
    console.log(`   Review Comments: ${reviewComments.length}`);
    console.log(`   Reviews: ${reviews.length}`);
    
    if (comments.length > 0) {
      console.log('\n   💬 Sample Comments:');
      comments.slice(0, 2).forEach(c => {
        console.log(`      - ${c.user.login}: "${c.body.substring(0, 50)}..."`);
      });
    }
    
    if (reviews.length > 0) {
      console.log('\n   👀 Reviews:');
      reviews.forEach(r => {
        console.log(`      - ${r.user.login}: ${r.state}`);
      });
    }
    
  } catch (error) {
    console.error(`Error checking PR #${prNumber}:`, error.message);
  }
}

console.log('🔍 Checking GitHub data for vitejs/vite PRs...\n');

// Check multiple PRs
const prsToCheck = [20528, 20527, 20526, 20525, 20478];

(async () => {
  for (const pr of prsToCheck) {
    await checkPR('vitejs', 'vite', pr);
  }
  
  console.log('\n\n🔍 Now checking a PR from a more active repo (that should have comments)...');
  
  // Check a kubernetes PR which usually has lots of activity
  await checkPR('kubernetes', 'kubernetes', 131918);
})();