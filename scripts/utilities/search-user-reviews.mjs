#!/usr/bin/env node

/**
 * Script to find how many pull request reviews a specific user made in August 2024
 * Usage: node scripts/search-user-reviews.mjs <username>
 */

const GITHUB_API_BASE = 'https://api.github.com';
const username = process.argv[2] || 'sestinj';
const targetMonth = '2024-08';

// Date range for August 2024
const startDate = '2024-08-01T00:00:00Z';
const endDate = '2024-08-31T23:59:59Z';

console.log(`🔍 Searching for PR reviews by ${username} in August 2024...`);

async function searchPullRequestReviews(username, startDate, endDate) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'contributor-info-search'
  };

  // Get GitHub token from environment
  const token = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  } else {
    console.warn('⚠️  No GitHub token found. Rate limits will be very restrictive.');
  }

  try {
    // First, let's search for pull requests that the user has commented on
    // We'll use the GitHub search API to find issues/PRs with comments from the user
    const searchQuery = `commenter:${username} type:pr created:${targetMonth}`;
    const searchUrl = `${GITHUB_API_BASE}/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=100&sort=updated&order=desc`;
    
    console.log(`📡 Searching GitHub API: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, { headers });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      throw new Error(`GitHub Search API error: ${error.message || searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    console.log(`📊 Found ${searchData.total_count} PRs with comments/activity from ${username} in ${targetMonth}`);

    if (searchData.total_count === 0) {
      console.log(`❌ No PRs found with activity from ${username} in ${targetMonth}`);
      return [];
    }

    // Now let's check each PR to see if the user actually left reviews
    const reviewsFound = [];
    
    for (const pr of searchData.items) {
      // Extract owner and repo from the PR URL
      const urlParts = pr.html_url.split('/');
      const owner = urlParts[3];
      const repo = urlParts[4];
      const prNumber = pr.number;

      console.log(`🔍 Checking PR #${prNumber} in ${owner}/${repo}: ${pr.title}`);

      try {
        // Get reviews for this PR
        const reviewsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
        const reviewsResponse = await fetch(reviewsUrl, { headers });

        if (!reviewsResponse.ok) {
          console.log(`  ⚠️  Could not fetch reviews for ${owner}/${repo}#${prNumber}: ${reviewsResponse.statusText}`);
          continue;
        }

        const reviews = await reviewsResponse.json();
        
        // Filter reviews by the target user and date range
        const userReviews = reviews.filter(review => {
          if (review.user.login !== username) return false;
          
          const reviewDate = new Date(review.submitted_at);
          const reviewInRange = reviewDate >= new Date(startDate) && reviewDate <= new Date(endDate);
          
          return reviewInRange;
        });

        if (userReviews.length > 0) {
          console.log(`  ✅ Found ${userReviews.length} review(s) by ${username}`);
          
          for (const review of userReviews) {
            reviewsFound.push({
              repository: `${owner}/${repo}`,
              prNumber: prNumber,
              prTitle: pr.title,
              prUrl: pr.html_url,
              reviewId: review.id,
              reviewState: review.state,
              submittedAt: review.submitted_at,
              reviewUrl: `${pr.html_url}#pullrequestreview-${review.id}`
            });
            
            console.log(`    📝 Review: ${review.state} on ${review.submitted_at}`);
          }
        } else {
          console.log(`  ❌ No reviews by ${username} in date range`);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`  ⚠️  Error checking PR ${owner}/${repo}#${prNumber}:`, error.message);
      }
    }

    return reviewsFound;

  } catch (error) {
    console.error('❌ Error searching for reviews:', error.message);
    throw error;
  }
}

async function searchUserReviewsAlternative(username, startDate, endDate) {
  console.log(`🔄 Trying alternative search approach...`);
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'contributor-info-search'
  };

  const token = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    // Search for PRs where the user was mentioned or involved
    const searchQueries = [
      `involves:${username} type:pr created:${targetMonth}`,
      `mentions:${username} type:pr created:${targetMonth}`,
      `assignee:${username} type:pr created:${targetMonth}`,
      `author:${username} type:pr created:${targetMonth}`
    ];

    const allReviews = [];

    for (const query of searchQueries) {
      console.log(`📡 Searching with query: ${query}`);
      
      const searchUrl = `${GITHUB_API_BASE}/search/issues?q=${encodeURIComponent(query)}&per_page=100`;
      const response = await fetch(searchUrl, { headers });

      if (!response.ok) {
        console.log(`⚠️  Search failed for query: ${query}`);
        continue;
      }

      const data = await response.json();
      console.log(`📊 Found ${data.total_count} results for query`);

      // Check each PR for reviews
      for (const pr of data.items.slice(0, 20)) { // Limit to first 20 to avoid rate limits
        const urlParts = pr.html_url.split('/');
        const owner = urlParts[3];
        const repo = urlParts[4];
        const prNumber = pr.number;

        try {
          const reviewsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
          const reviewsResponse = await fetch(reviewsUrl, { headers });

          if (reviewsResponse.ok) {
            const reviews = await reviewsResponse.json();
            const userReviews = reviews.filter(review => {
              if (review.user.login !== username) return false;
              const reviewDate = new Date(review.submitted_at);
              return reviewDate >= new Date(startDate) && reviewDate <= new Date(endDate);
            });

            for (const review of userReviews) {
              // Avoid duplicates
              const isDuplicate = allReviews.some(r => r.reviewId === review.id);
              if (!isDuplicate) {
                allReviews.push({
                  repository: `${owner}/${repo}`,
                  prNumber: prNumber,
                  prTitle: pr.title,
                  prUrl: pr.html_url,
                  reviewId: review.id,
                  reviewState: review.state,
                  submittedAt: review.submitted_at,
                  reviewUrl: `${pr.html_url}#pullrequestreview-${review.id}`
                });
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.log(`Error checking ${owner}/${repo}#${prNumber}:`, error.message);
        }
      }

      // Delay between different search queries
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allReviews;

  } catch (error) {
    console.error('❌ Alternative search failed:', error.message);
    return [];
  }
}

async function main() {
  console.log(`🚀 Starting search for ${username}'s PR reviews in August 2024`);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);
  
  try {
    // Try the primary search method
    let reviews = await searchPullRequestReviews(username, startDate, endDate);
    
    // If we didn't find many results, try alternative approaches
    if (reviews.length === 0) {
      console.log(`🔄 No reviews found with primary method. Trying alternative search...`);
      const alternativeReviews = await searchUserReviewsAlternative(username, startDate, endDate);
      reviews = reviews.concat(alternativeReviews);
    }

    // Remove duplicates based on reviewId
    const uniqueReviews = reviews.filter((review, index, self) => 
      index === self.findIndex(r => r.reviewId === review.reviewId)
    );

    console.log('\n' + '='.repeat(60));
    console.log(`📊 FINAL RESULTS FOR ${username.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log(`📅 Period: August 2024`);
    console.log(`🎯 Total PR Reviews Found: ${uniqueReviews.length}`);
    
    if (uniqueReviews.length > 0) {
      console.log('\n📝 Review Details:');
      console.log('-'.repeat(60));
      
      // Group by repository
      const reviewsByRepo = {};
      uniqueReviews.forEach(review => {
        if (!reviewsByRepo[review.repository]) {
          reviewsByRepo[review.repository] = [];
        }
        reviewsByRepo[review.repository].push(review);
      });

      Object.entries(reviewsByRepo).forEach(([repo, repoReviews]) => {
        console.log(`\n📁 ${repo} (${repoReviews.length} review${repoReviews.length !== 1 ? 's' : ''})`);
        
        repoReviews
          .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
          .forEach(review => {
            const date = new Date(review.submittedAt).toLocaleDateString();
            console.log(`  • PR #${review.prNumber}: ${review.reviewState} on ${date}`);
            console.log(`    ${review.prTitle}`);
            console.log(`    🔗 ${review.reviewUrl}`);
          });
      });

      // Summary by review type
      console.log('\n📈 Review Summary:');
      const reviewStates = {};
      uniqueReviews.forEach(review => {
        reviewStates[review.reviewState] = (reviewStates[review.reviewState] || 0) + 1;
      });
      
      Object.entries(reviewStates).forEach(([state, count]) => {
        console.log(`  ${state}: ${count}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Search completed successfully!`);
    console.log(`📊 ${username} made ${uniqueReviews.length} pull request reviews in August 2024`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Search failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);