#!/usr/bin/env node

/**
 * Generate seed data for local development
 * Fetches 7-14 days of recent data from example repositories
 * Integrates with existing progressive capture infrastructure
 */

import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { ensureContributor } from '../progressive-capture/lib/contributor-utils.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { format } from 'date-fns';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });

// Configuration
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SEED_DATA_DAYS = parseInt(process.env.SEED_DATA_DAYS || '14', 10);
const SEED_REPOSITORIES = (
  process.env.SEED_REPOSITORIES ||
  'continuedev/continue,vitejs/vite,facebook/react,vercel/next.js,supabase/supabase'
).split(',');

// Progress tracking
let totalOperations = 0;
let completedOperations = 0;
const startTime = Date.now();

// Validation
if (!GITHUB_TOKEN) {
  console.error('❌ Missing GitHub token!');
  console.error('Please set VITE_GITHUB_TOKEN in your .env.local file');
  console.error('Create a token at: https://github.com/settings/tokens/new');
  console.error('Required scopes: public_repo, read:user');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Run: npm run env:local');
  process.exit(1);
}

// Initialize clients
const octokit = new Octokit({ auth: GITHUB_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Log progress with visual indicators
 */
function logProgress(message, type = 'info') {
  const icons = {
    info: '📊',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    processing: '🔄',
    complete: '🎉',
  };

  const percentage =
    totalOperations > 0 ? Math.round((completedOperations / totalOperations) * 100) : 0;
  const progressBar =
    '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

  console.log(`${icons[type]} ${message}`);
  if (type === 'processing' && totalOperations > 0) {
    console.log(
      `   Progress: [${progressBar}] ${percentage}% (${completedOperations}/${totalOperations})`
    );
  }
}

/**
 * Rate limiting helper with exponential backoff
 */
async function withRateLimit(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
        const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10) * 1000;
        const waitTime = Math.max(0, resetTime - Date.now() + 1000);

        logProgress(`Rate limited. Waiting ${Math.round(waitTime / 1000)}s...`, 'warning');
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else if (i === retries - 1) {
        throw error;
      } else {
        const backoffTime = Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }
  }
}

/**
 * Fetch repository data
 */
async function fetchRepository(owner, name) {
  logProgress(`Fetching repository ${owner}/${name}...`, 'processing');

  const { data: repo } = await withRateLimit(() => octokit.repos.get({ owner, repo: name }));

  return {
    github_id: repo.id,
    full_name: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    is_fork: repo.fork,
    github_created_at: repo.created_at,
    github_updated_at: repo.updated_at,
    default_branch: repo.default_branch,
    is_tracked: true,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Fetch contributors for a repository
 */
async function fetchContributors(owner, name, limit = 10) {
  logProgress(`Fetching top ${limit} contributors for ${owner}/${name}...`, 'processing');

  const { data: contributors } = await withRateLimit(() =>
    octokit.repos.listContributors({
      owner,
      repo: name,
      per_page: limit,
    })
  );

  const detailedContributors = [];

  for (const contributor of contributors) {
    if (contributor.type === 'User') {
      const { data: user } = await withRateLimit(() =>
        octokit.users.getByUsername({ username: contributor.login })
      );

      detailedContributors.push({
        github_id: user.id,
        username: user.login,
        display_name: user.name,
        avatar_url: user.avatar_url,
        profile_url: user.html_url,
        email: user.email,
        company: user.company,
        location: user.location,
        bio: user.bio,
        public_repos: user.public_repos,
        followers: user.followers,
        following: user.following,
        github_created_at: user.created_at,
        is_bot: false,
      });
    }

    completedOperations++;
  }

  return detailedContributors;
}

/**
 * Fetch recent pull requests
 */
async function fetchPullRequests(owner, name, repositoryId, days = SEED_DATA_DAYS) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  logProgress(`Fetching PRs from last ${days} days for ${owner}/${name}...`, 'processing');

  // Fetch both open and closed PRs
  const states = ['open', 'closed'];
  const allPRs = [];

  for (const state of states) {
    const { data: prs } = await withRateLimit(() =>
      octokit.pulls.list({
        owner,
        repo: name,
        state,
        sort: 'created',
        direction: 'desc',
        per_page: 30,
      })
    );

    // Filter by date
    const recentPRs = prs.filter((pr) => new Date(pr.created_at) >= new Date(since));
    allPRs.push(...recentPRs);
  }

  const pullRequests = [];
  const reviews = [];
  const comments = [];

  for (const pr of allPRs.slice(0, 50)) {
    // Limit to 50 PRs for seed data
    // Fetch detailed PR data
    const { data: detailedPR } = await withRateLimit(() =>
      octokit.pulls.get({
        owner,
        repo: name,
        pull_number: pr.number,
      })
    );

    // Ensure contributors exist and get their UUIDs
    const authorContributor = await ensureContributor(supabase, detailedPR.user, `${owner}/${name}`);
    
    pullRequests.push({
      github_id: detailedPR.id,
      repository_id: repositoryId,
      number: detailedPR.number,
      title: detailedPR.title,
      body: detailedPR.body,
      state: detailedPR.state,
      author_id: authorContributor.id, // Now using contributor UUID
      created_at: detailedPR.created_at,
      updated_at: detailedPR.updated_at,
      closed_at: detailedPR.closed_at,
      merged_at: detailedPR.merged_at,
      merged: detailedPR.merged,
      base_branch: detailedPR.base.ref,
      head_branch: detailedPR.head.ref,
      additions: detailedPR.additions,
      deletions: detailedPR.deletions,
      changed_files: detailedPR.changed_files,
      commits: detailedPR.commits,
      html_url: detailedPR.html_url,
    });

    // Fetch reviews (sample)
    try {
      const { data: prReviews } = await withRateLimit(() =>
        octokit.pulls.listReviews({
          owner,
          repo: name,
          pull_number: pr.number,
          per_page: 5,
        })
      );

      for (const review of prReviews) {
        // Ensure review author exists and get UUID
        let reviewAuthorId = null;
        if (review.user) {
          const reviewAuthor = await ensureContributor(supabase, review.user, `${owner}/${name}`);
          reviewAuthorId = reviewAuthor.id;
        }

        reviews.push({
          github_id: review.id,
          pull_request_id: detailedPR.id,
          author_id: reviewAuthorId, // Now using contributor UUID
          state: review.state,
          body: review.body,
          submitted_at: review.submitted_at,
          commit_id: review.commit_id,
        });
      }
    } catch (error) {
      // Skip reviews if there's an issue
    }

    // Fetch comments (sample)
    try {
      const { data: prComments } = await withRateLimit(() =>
        octokit.issues.listComments({
          owner,
          repo: name,
          issue_number: pr.number,
          per_page: 3,
        })
      );

      for (const comment of prComments) {
        // Ensure comment author exists and get UUID
        let commenterId = null;
        if (comment.user) {
          const commenter = await ensureContributor(supabase, comment.user, `${owner}/${name}`);
          commenterId = commenter.id;
        }

        comments.push({
          github_id: comment.id,
          pull_request_id: detailedPR.id,
          repository_id: repositoryId,
          commenter_id: commenterId, // Now using contributor UUID
          body: comment.body,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          comment_type: 'issue',
        });
      }
    } catch (error) {
      // Skip comments if there's an issue
    }

    completedOperations++;
  }

  return { pullRequests, reviews, comments };
}

/**
 * Insert data into Supabase
 */
async function insertData(table, data, conflictColumns = ['github_id']) {
  if (!data || data.length === 0) return;

  logProgress(`Inserting ${data.length} records into ${table}...`, 'processing');

  const { error } = await supabase.from(table).upsert(data, {
    onConflict: conflictColumns.join(','),
    ignoreDuplicates: false,
  });

  if (error) {
    logProgress(`Error inserting into ${table}: ${error.message}`, 'error');
    console.error(error);
  } else {
    logProgress(`Successfully inserted ${data.length} records into ${table}`, 'success');
  }
}

/**
 * Generate SQL file for seed data
 */
async function generateSQLFile(data) {
  logProgress('Generating seed.sql file...', 'processing');

  const sqlPath = join(__dirname, '../../supabase/seed-generated.sql');
  let sql = `-- Generated seed data for Contributor.info
-- Generated on: ${new Date().toISOString()}
-- Repositories: ${SEED_REPOSITORIES.join(', ')}
-- Data range: Last ${SEED_DATA_DAYS} days

-- This file contains realistic test data for local development
-- Run with: psql -h localhost -p 54322 -U postgres -d postgres < supabase/seed-generated.sql

`;

  // Add repository inserts
  if (data.repositories.length > 0) {
    sql += '-- Repositories\n';
    sql +=
      'INSERT INTO repositories (github_id, full_name, owner, name, description, language, stargazers_count, forks_count, open_issues_count, is_fork, github_created_at, github_updated_at, is_tracked) VALUES\n';
    const repoValues = data.repositories.map(
      (r) =>
        `(${r.github_id}, '${r.full_name}', '${r.owner}', '${r.name}', ${r.description ? `'${r.description.replace(/'/g, "''")}'` : 'NULL'}, ${r.language ? `'${r.language}'` : 'NULL'}, ${r.stargazers_count}, ${r.forks_count}, ${r.open_issues_count}, ${r.is_fork}, '${r.github_created_at}', '${r.github_updated_at}', true)`
    );
    sql += repoValues.join(',\n') + '\nON CONFLICT (github_id) DO UPDATE SET\n';
    sql += '  stargazers_count = EXCLUDED.stargazers_count,\n';
    sql += '  forks_count = EXCLUDED.forks_count,\n';
    sql += '  open_issues_count = EXCLUDED.open_issues_count,\n';
    sql += '  github_updated_at = EXCLUDED.github_updated_at,\n';
    sql += '  last_updated_at = NOW();\n\n';
  }

  // Add contributor inserts
  if (data.contributors.length > 0) {
    sql += '-- Contributors\n';
    sql +=
      'INSERT INTO contributors (github_id, username, display_name, avatar_url, profile_url, email, company, location, bio, public_repos, followers, following, github_created_at, is_bot) VALUES\n';
    const contribValues = data.contributors.map(
      (c) =>
        `(${c.github_id}, '${c.username}', ${c.display_name ? `'${c.display_name.replace(/'/g, "''")}'` : 'NULL'}, '${c.avatar_url}', '${c.profile_url}', ${c.email ? `'${c.email}'` : 'NULL'}, ${c.company ? `'${c.company.replace(/'/g, "''")}'` : 'NULL'}, ${c.location ? `'${c.location.replace(/'/g, "''")}'` : 'NULL'}, ${c.bio ? `'${c.bio.replace(/'/g, "''")}'` : 'NULL'}, ${c.public_repos}, ${c.followers}, ${c.following}, '${c.github_created_at}', false)`
    );
    sql += contribValues.join(',\n') + '\nON CONFLICT (github_id) DO UPDATE SET\n';
    sql += '  display_name = EXCLUDED.display_name,\n';
    sql += '  avatar_url = EXCLUDED.avatar_url,\n';
    sql += '  followers = EXCLUDED.followers,\n';
    sql += '  following = EXCLUDED.following;\n\n';
  }

  await fs.writeFile(sqlPath, sql, 'utf8');
  logProgress(`SQL file generated at: ${sqlPath}`, 'success');
}

/**
 * Main seed data generation
 */
async function generateSeedData() {
  console.log('🌱 Starting Seed Data Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Timeframe: Last ${SEED_DATA_DAYS} days`);
  console.log(`📦 Repositories: ${SEED_REPOSITORIES.join(', ')}`);
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allData = {
    repositories: [],
    contributors: [],
    pullRequests: [],
    reviews: [],
    comments: [],
  };

  // Calculate total operations for progress tracking
  totalOperations = SEED_REPOSITORIES.length * 60; // Rough estimate

  try {
    // Process each repository
    for (const repoPath of SEED_REPOSITORIES) {
      const [owner, name] = repoPath.trim().split('/');

      console.log(`\n📂 Processing ${owner}/${name}`);
      console.log('─'.repeat(40));

      // Fetch repository data
      const repository = await fetchRepository(owner, name);
      allData.repositories.push(repository);

      // Insert repository immediately to get ID
      await insertData('repositories', [repository]);

      // Get repository ID from database
      const { data: repoRecord } = await supabase
        .from('repositories')
        .select('id')
        .eq('github_id', repository.github_id)
        .single();

      if (!repoRecord) {
        logProgress(`Failed to get repository ID for ${owner}/${name}`, 'error');
        continue;
      }

      const repositoryId = repoRecord.id;

      // Fetch contributors
      const contributors = await fetchContributors(owner, name, 10);
      allData.contributors.push(...contributors);
      await insertData('contributors', contributors);

      // Fetch pull requests and related data
      const { pullRequests, reviews, comments } = await fetchPullRequests(
        owner,
        name,
        repositoryId
      );

      // Add repository_id to all PRs
      const prsWithRepoId = pullRequests.map((pr) => ({
        ...pr,
        repository_id: repositoryId,
      }));

      allData.pullRequests.push(...prsWithRepoId);
      allData.reviews.push(...reviews);
      allData.comments.push(...comments);

      // Insert PR data
      await insertData('pull_requests', prsWithRepoId, ['github_id', 'repository_id']);
      await insertData('reviews', reviews);
      await insertData('comments', comments);

      console.log(`✅ Completed ${owner}/${name}\n`);
    }

    // Generate SQL file for backup/sharing
    await generateSQLFile(allData);

    // Final statistics
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('\n🎉 Seed Data Generation Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Statistics:`);
    console.log(`  • Repositories: ${allData.repositories.length}`);
    console.log(`  • Contributors: ${allData.contributors.length}`);
    console.log(`  • Pull Requests: ${allData.pullRequests.length}`);
    console.log(`  • Reviews: ${allData.reviews.length}`);
    console.log(`  • Comments: ${allData.comments.length}`);
    console.log(`  • Time elapsed: ${elapsed}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Your local database is now populated with seed data!');
    console.log('🚀 Start the dev server with: npm run dev');
    console.log('🔍 View data in Supabase Studio: http://localhost:54323');
  } catch (error) {
    console.error('\n❌ Error generating seed data:', error);
    console.error('Please check your GitHub token and network connection');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSeedData().catch(console.error);
}

export { generateSeedData };
