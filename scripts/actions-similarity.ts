#!/usr/bin/env tsx

import { Octokit } from '@octokit/rest';
import { generateIssueEmbedding, calculateContentHash, cosineSimilarity } from '../src/lib/ml-utils';
import fs from 'fs';
import path from 'path';

interface SimilarityItem {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  type: 'issue' | 'pull_request';
  embedding?: number[];
  contentHash?: string;
}

interface SimilarityResult {
  item: SimilarityItem;
  similarity: number;
}

interface ProcessingOptions {
  owner: string;
  repo: string;
  maxItems?: number;
  itemType?: 'issues' | 'pull_request';
  itemNumber?: number;
  similarityThreshold?: number;
}

interface TargetItemSummary {
  number: number;
  title: string;
  type: 'issue' | 'pull_request';
}

interface SimilarItemSummary {
  number: number;
  title: string;
  state: string;
  html_url: string;
  type: 'issue' | 'pull_request';
  similarity: number;
}

interface SimilarityPair {
  item1: {
    number: number;
    title: string;
    type: 'issue' | 'pull_request';
  };
  item2: {
    number: number;
    title: string;
    type: 'issue' | 'pull_request';
  };
  similarity: number;
}

interface SimilarityResults {
  repository: string;
  processedItems: number;
  timestamp: string;
  targetItem?: TargetItemSummary;
  similarItems?: SimilarItemSummary[];
  similarityPairs?: SimilarityPair[];
}

// Cosine similarity function is now imported from ml-utils

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute GitHub API call with rate limit handling and exponential backoff
 */
async function withRateLimitHandling<T>(
  apiCall: () => Promise<T>,
  attempt: number = 1,
  maxAttempts: number = 5
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; response?: { headers?: { 'x-ratelimit-remaining'?: string; 'x-ratelimit-reset'?: string } } };
    
    // Check if it's a rate limit error
    if (err.status === 403 || err.status === 429) {
      if (attempt >= maxAttempts) {
        throw new Error(`Rate limit exceeded after ${maxAttempts} attempts`);
      }
      
      // Calculate backoff time
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
      
      // If we have rate limit headers, wait until reset time
      const resetTime = err.response?.headers?.['x-ratelimit-reset'];
      if (resetTime) {
        const waitTime = Math.max(0, parseInt(resetTime) * 1000 - Date.now());
        console.log(`Rate limit hit. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset...`);
        await sleep(waitTime + 1000); // Add 1 second buffer
      } else {
        console.log(`Rate limit hit. Waiting ${backoffMs / 1000} seconds (attempt ${attempt}/${maxAttempts})...`);
        await sleep(backoffMs);
      }
      
      // Retry the API call
      return withRateLimitHandling(apiCall, attempt + 1, maxAttempts);
    }
    
    // Re-throw non-rate-limit errors
    throw error;
  }
}

/**
 * Fetch issues and PRs from GitHub API with rate limit handling
 */
async function fetchRepositoryItems(
  octokit: Octokit,
  owner: string,
  repo: string,
  maxItems: number = 100
): Promise<SimilarityItem[]> {
  console.log(`Fetching up to ${maxItems} items from ${owner}/${repo}...`);

  const itemsPerType = Math.floor(maxItems / 2);
  const items: SimilarityItem[] = [];

  try {
    // Fetch issues (excluding PRs) with rate limit handling
    console.log(`Fetching ${itemsPerType} issues...`);
    const issuesResponse = await withRateLimitHandling(() => 
      octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: itemsPerType,
      })
    );

    // Filter out pull requests from issues
    const issues = issuesResponse.data.filter(item => !item.pull_request);
    
    for (const issue of issues) {
      items.push({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        html_url: issue.html_url,
        created_at: issue.created_at,
        type: 'issue',
      });
    }

    // Fetch PRs with rate limit handling
    console.log(`Fetching ${itemsPerType} pull requests...`);
    const prsResponse = await withRateLimitHandling(() =>
      octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: itemsPerType,
      })
    );

    for (const pr of prsResponse.data) {
      items.push({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        html_url: pr.html_url,
        created_at: pr.created_at,
        type: 'pull_request',
      });
    }

    console.log(`Fetched ${items.length} items total`);
    return items;

  } catch (error) {
    console.error('Error fetching repository items:', error);
    throw error;
  }
}

/**
 * Process items in batches with concurrency control
 */
async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = 5
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    
    // Progress indicator
    const processed = Math.min(i + batchSize, items.length);
    if (processed % 10 === 0 || processed === items.length) {
      console.log(`Processed ${processed}/${items.length} items`);
    }
  }
}

/**
 * Generate embeddings for all items with parallel processing
 */
async function generateEmbeddings(items: SimilarityItem[], concurrency: number = 5): Promise<void> {
  console.log(`Generating embeddings for ${items.length} items (concurrency: ${concurrency})...`);
  
  const processor = async (item: SimilarityItem) => {
    try {
      console.log(`Processing ${item.type} #${item.number}: ${item.title.substring(0, 50)}...`);
      
      item.embedding = await generateIssueEmbedding(item.title, item.body);
      item.contentHash = calculateContentHash(item.title, item.body);
    } catch (error) {
      console.error(`Error generating embedding for ${item.type} #${item.number}: %s`, error);
      // Continue with other items - don't throw
    }
  };
  
  await processBatch(items, processor, concurrency);
  console.log('Embedding generation complete');
}

/**
 * Find similar items for a target item
 */
function findSimilarItems(
  targetItem: SimilarityItem,
  allItems: SimilarityItem[],
  threshold: number = 0.8,
  limit: number = 5
): SimilarityResult[] {
  if (!targetItem.embedding) {
    return [];
  }

  const similarities: SimilarityResult[] = [];

  for (const item of allItems) {
    // Skip the target item itself
    if (item.number === targetItem.number && item.type === targetItem.type) {
      continue;
    }

    if (!item.embedding) {
      continue;
    }

    try {
      const similarity = cosineSimilarity(targetItem.embedding, item.embedding);
      
      if (similarity >= threshold) {
        similarities.push({
          item,
          similarity,
        });
      }
    } catch (error) {
      console.error(`Error calculating similarity for ${item.type} #${item.number}:`, error);
    }
  }

  // Sort by similarity descending and return top matches
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Process similarity check
 */
async function processSimilarityCheck(options: ProcessingOptions): Promise<void> {
  const {
    owner,
    repo,
    maxItems = 100,
    itemType,
    itemNumber,
    similarityThreshold = 0.85,
  } = options;

  // Initialize GitHub API client
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  try {
    // Fetch repository items
    const items = await fetchRepositoryItems(octokit, owner, repo, maxItems);

    if (items.length === 0) {
      console.log('No items found to process');
      return;
    }

    // Generate embeddings
    await generateEmbeddings(items);

    // Find the target item if specified
    let targetItem: SimilarityItem | undefined;
    
    if (itemType && itemNumber) {
      const type = itemType === 'issues' ? 'issue' : 'pull_request';
      targetItem = items.find(
        item => item.number === itemNumber && item.type === type
      );

      if (!targetItem) {
        console.log(`Target ${type} #${itemNumber} not found in processed items`);
        // Fetch the specific item
        try {
          let targetData;
          if (type === 'issue') {
            const response = await withRateLimitHandling(() =>
              octokit.rest.issues.get({
                owner,
                repo,
                issue_number: itemNumber,
              })
            );
            targetData = response.data;
          } else {
            const response = await withRateLimitHandling(() =>
              octokit.rest.pulls.get({
                owner,
                repo,
                pull_number: itemNumber,
              })
            );
            targetData = response.data;
          }

          targetItem = {
            number: targetData.number,
            title: targetData.title,
            body: targetData.body,
            state: targetData.state,
            html_url: targetData.html_url,
            created_at: targetData.created_at,
            type,
            embedding: await generateIssueEmbedding(targetData.title, targetData.body),
            contentHash: calculateContentHash(targetData.title, targetData.body),
          };
        } catch (error) {
          console.error('Error fetching target item:', error);
          return;
        }
      }
    }

    // Find similarities
    const results: SimilarityResults = {
      repository: `${owner}/${repo}`,
      processedItems: items.length,
      timestamp: new Date().toISOString(),
    };

    if (targetItem) {
      // Find similar items for the specific target
      console.log(`Finding similar items for ${targetItem.type} #${targetItem.number}...`);
      
      const similarItems = findSimilarItems(
        targetItem,
        items,
        similarityThreshold,
        5
      );

      results.targetItem = {
        number: targetItem.number,
        title: targetItem.title,
        type: targetItem.type,
      };
      
      results.similarItems = similarItems.map(result => ({
        number: result.item.number,
        title: result.item.title,
        state: result.item.state,
        html_url: result.item.html_url,
        type: result.item.type,
        similarity: result.similarity,
      }));

      console.log(`Found ${similarItems.length} similar items`);
    } else {
      // General analysis - find all high-similarity pairs
      console.log('Performing general similarity analysis...');
      
      // Use a Map for O(1) duplicate checking and limit memory usage
      const pairKey = (n1: number, t1: string, n2: number, t2: string) => {
        // Ensure consistent ordering for the key
        if (n1 < n2 || (n1 === n2 && t1 < t2)) {
          return `${n1}-${t1}-${n2}-${t2}`;
        }
        return `${n2}-${t2}-${n1}-${t1}`;
      };
      
      const processedPairs = new Set<string>();
      const maxPairs = 100; // Limit memory usage
      const topPairs: Array<{
        item1: SimilarityItem;
        item2: SimilarityItem;
        similarity: number;
      }> = [];

      for (let i = 0; i < items.length; i++) {
        const similar = findSimilarItems(items[i], items, similarityThreshold, 10);
        
        for (const result of similar) {
          // Check for duplicates using O(1) Set lookup
          const key = pairKey(items[i].number, items[i].type, result.item.number, result.item.type);
          
          if (!processedPairs.has(key)) {
            processedPairs.add(key);
            
            // Add to topPairs, maintaining size limit
            topPairs.push({
              item1: items[i],
              item2: result.item,
              similarity: result.similarity,
            });
            
            // Keep only the top N pairs to limit memory
            if (topPairs.length > maxPairs) {
              topPairs.sort((a, b) => b.similarity - a.similarity);
              topPairs.length = maxPairs;
            }
          }
        }
      }

      // Final sort
      topPairs.sort((a, b) => b.similarity - a.similarity);
      
      results.similarityPairs = topPairs
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20) // Top 20 most similar pairs
        .map(pair => ({
          item1: {
            number: pair.item1.number,
            title: pair.item1.title,
            type: pair.item1.type,
            html_url: pair.item1.html_url,
          },
          item2: {
            number: pair.item2.number,
            title: pair.item2.title,
            type: pair.item2.type,
            html_url: pair.item2.html_url,
          },
          similarity: pair.similarity,
        }));

      console.log(`Found ${processedPairs.size} similarity pairs above threshold (showing top ${Math.min(20, topPairs.length)})`);
    }

    // Save results for GitHub Actions to use
    const outputPath = path.join(process.cwd(), 'similarity-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${outputPath}`);

    // Also log a summary
    console.log('\n=== SIMILARITY CHECK SUMMARY ===');
    console.log(`Repository: ${owner}/${repo}`);
    console.log(`Items processed: ${items.length}`);
    console.log(`Similarity threshold: ${similarityThreshold}`);
    
    if (results.similarItems) {
      console.log(`Similar items found: ${results.similarItems.length}`);
      if (results.similarItems.length > 0) {
        console.log('Top matches:');
        results.similarItems.slice(0, 3).forEach((item: any) => {
          console.log(`  - #${item.number}: ${item.title} (${Math.round(item.similarity * 100)}% similar)`);
        });
      }
    }
    
    if (results.similarityPairs) {
      console.log(`Similarity pairs found: ${results.similarityPairs.length}`);
    }

  } catch (error) {
    console.error('Error during similarity check:', error);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): ProcessingOptions {
  const args = process.argv.slice(2);
  const options: ProcessingOptions = {
    owner: '',
    repo: '',
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--owner':
        options.owner = value;
        break;
      case '--repo':
        options.repo = value;
        break;
      case '--max-items':
        options.maxItems = parseInt(value, 10);
        break;
      case '--item-type':
        options.itemType = value as 'issues' | 'pull_request';
        break;
      case '--item-number':
        options.itemNumber = parseInt(value, 10);
        break;
      case '--similarity-threshold':
        options.similarityThreshold = parseFloat(value);
        break;
    }
  }

  return options;
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  if (!options.owner || !options.repo) {
    console.error('Usage: npm run similarity:check -- --owner <owner> --repo <repo> [--max-items <number>] [--item-type <issues|pull_request>] [--item-number <number>]');
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('🔍 Starting similarity check...');
  console.log(`Repository: ${options.owner}/${options.repo}`);
  
  if (options.itemType && options.itemNumber) {
    console.log(`Target: ${options.itemType} #${options.itemNumber}`);
  }
  
  console.log(`Max items: ${options.maxItems || 100}`);
  console.log(`Similarity threshold: ${options.similarityThreshold || 0.85}`);
  console.log('');

  await processSimilarityCheck(options);
  
  console.log('\n✅ Similarity check complete!');
}

// Run the script if executed directly
// For ES modules, check if this file is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { processSimilarityCheck, findSimilarItems, generateEmbeddings };