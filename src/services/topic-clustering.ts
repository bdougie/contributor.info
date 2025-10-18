/**
 * Topic Clustering Service
 *
 * Implements both content-based and contributor-based clustering:
 * 1. Content Clustering: Groups issues/PRs/discussions by technical topics
 * 2. Contributor Clustering: Groups contributors by similar expertise
 *
 * Uses existing 384-dimension embeddings and K-means algorithm
 */

import { supabase } from '@/lib/supabase';
import { llmService } from '@/lib/llm/llm-service';
import type {
  TopicCluster,
  ContributorCluster,
  EmbeddingCluster,
  ClusteringOptions,
  ClusteringResult,
} from '@/lib/llm/contributor-enrichment-types';

/**
 * Default clustering parameters
 */
const DEFAULT_CLUSTERING_OPTIONS = {
  k: 7, // Default number of clusters
  minClusterSize: 3, // Minimum items per cluster
  maxIterations: 50, // Maximum k-means iterations
  convergenceThreshold: 0.01, // When to stop iterating
};

/**
 * Cluster contributions (issues, PRs, discussions) by content similarity
 * Uses embeddings to find technical topic groupings
 */
export async function clusterContributionsByTopic(
  workspaceId: string,
  options: Partial<ClusteringOptions> = {}
): Promise<TopicCluster[]> {
  const opts = { ...DEFAULT_CLUSTERING_OPTIONS, workspaceId, ...options };

  try {
    // Step 1: Fetch all embeddings for workspace items
    const embeddings = await fetchWorkspaceEmbeddings(workspaceId);

    if (embeddings.length === 0) {
      console.log('[Topic Clustering] No embeddings found for workspace:', workspaceId);
      return [];
    }

    console.log(`[Topic Clustering] Clustering ${embeddings.length} items into ${opts.k} topics`);

    // Step 2: Run K-means clustering
    const clusteringResult = await kMeansClustering(embeddings, opts);

    if (!clusteringResult.converged) {
      console.warn('[Topic Clustering] Clustering did not converge, using best result');
    }

    // Step 3: Generate topic labels using LLM
    const topicClusters = await Promise.all(
      clusteringResult.clusters.map(async (cluster) => {
        // Get ALL cluster members for contributor counting
        const allClusterItems = embeddings.filter((e) => cluster.itemIds.includes(e.id));

        // Get sample titles for LLM labeling (first 10)
        const sampleItems = allClusterItems.slice(0, 10);
        const sampleTitles = sampleItems.map((item) => item.title);

        // Generate topic label using LLM
        const topicLabel = await generateTopicLabels(cluster, sampleTitles);

        // Get contributor count from ALL cluster members, not just samples
        const contributorUsernames = new Set(
          allClusterItems
            .map((item) => item.contributorUsername)
            .filter((u): u is string => Boolean(u))
        );

        return {
          id: `topic-${cluster.id}`,
          label: topicLabel.primary,
          keywords: topicLabel.keywords,
          contributorCount: contributorUsernames.size,
          topContributors: Array.from(contributorUsernames).slice(0, 5),
          centroid: cluster.centroid,
          confidence: calculateClusterConfidence(cluster.variance),
          sampleTitles: sampleTitles.slice(0, 5),
        };
      })
    );

    // Filter out low-quality clusters
    return topicClusters
      .filter((cluster) => cluster.contributorCount >= opts.minClusterSize!)
      .sort((a, b) => b.contributorCount - a.contributorCount);
  } catch (error) {
    console.error('[Topic Clustering] Error clustering contributions:', error);
    throw error;
  }
}

/**
 * Cluster contributors by expertise and activity patterns
 * Groups people with similar contribution focus areas
 */
export async function clusterContributorsByExpertise(
  workspaceId: string,
  options: Partial<ClusteringOptions> = {}
): Promise<ContributorCluster[]> {
  const opts = { ...DEFAULT_CLUSTERING_OPTIONS, k: 5, workspaceId, ...options }; // Fewer contributor clusters

  try {
    // Step 1: Build aggregated contributor embeddings
    const contributorEmbeddings = await buildContributorEmbeddings(workspaceId);

    if (contributorEmbeddings.length === 0) {
      console.log('[Contributor Clustering] No contributors found for workspace:', workspaceId);
      return [];
    }

    console.log(
      `[Contributor Clustering] Clustering ${contributorEmbeddings.length} contributors into ${opts.k} groups`
    );

    // Step 2: Run K-means clustering
    const clusteringResult = await kMeansClustering(contributorEmbeddings, opts);

    // Step 3: Analyze each cluster to identify expertise
    const contributorClusters = await Promise.all(
      clusteringResult.clusters.map(async (cluster) => {
        // Get contributors in this cluster
        const clusterMembers = contributorEmbeddings
          .filter((e) => cluster.itemIds.includes(e.id))
          .map((e) => e.contributorUsername)
          .filter((username): username is string => Boolean(username));

        // Get common topics across contributors
        const commonTopics = await extractCommonTopics(workspaceId, clusterMembers);

        return {
          id: `contributor-group-${cluster.id}`,
          expertise: commonTopics.slice(0, 3), // Top 3 common topics
          contributors: clusterMembers,
          centroid: cluster.centroid,
          cohesion: calculateClusterConfidence(cluster.variance),
          commonTopics,
        };
      })
    );

    // Filter out single-person clusters
    return contributorClusters
      .filter((cluster) => cluster.contributors.length >= opts.minClusterSize!)
      .sort((a, b) => b.contributors.length - a.contributors.length);
  } catch (error) {
    console.error('[Contributor Clustering] Error clustering contributors:', error);
    throw error;
  }
}

/**
 * Fetch all embeddings for workspace items (issues, PRs, discussions)
 */
async function fetchWorkspaceEmbeddings(workspaceId: string) {
  // Get workspace repository IDs
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return [];
  }

  const repoIds = workspaceRepos.map((r) => r.repository_id);

  // Fetch embeddings from all entity types
  const [issues, pullRequests, discussions] = await Promise.all([
    // Issues with embeddings
    supabase
      .from('issues')
      .select('id, title, embedding, author_id, contributors!inner(username)')
      .in('repository_id', repoIds)
      .not('embedding', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000),

    // Pull requests with embeddings
    supabase
      .from('pull_requests')
      .select('id, title, embedding, author_id, contributors!inner(username)')
      .in('repository_id', repoIds)
      .not('embedding', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000),

    // Discussions with embeddings
    supabase
      .from('discussions')
      .select('id, title, embedding, author_id, contributors!inner(username)')
      .in('repository_id', repoIds)
      .not('embedding', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000),
  ]);

  // Combine all embeddings with metadata
  const allEmbeddings = [
    ...(issues.data || []).map(
      (item: {
        id: string;
        title: string;
        embedding: number[];
        contributors: { username?: string }[] | { username?: string };
      }) => ({
        id: item.id,
        title: item.title,
        embedding: item.embedding,
        type: 'issue' as const,
        contributorUsername: Array.isArray(item.contributors)
          ? item.contributors[0]?.username
          : item.contributors?.username,
      })
    ),
    ...(pullRequests.data || []).map(
      (item: {
        id: string;
        title: string;
        embedding: number[];
        contributors: { username?: string }[] | { username?: string };
      }) => ({
        id: item.id,
        title: item.title,
        embedding: item.embedding,
        type: 'pr' as const,
        contributorUsername: Array.isArray(item.contributors)
          ? item.contributors[0]?.username
          : item.contributors?.username,
      })
    ),
    ...(discussions.data || []).map(
      (item: {
        id: string;
        title: string;
        embedding: number[];
        contributors: { username?: string }[] | { username?: string };
      }) => ({
        id: item.id,
        title: item.title,
        embedding: item.embedding,
        type: 'discussion' as const,
        contributorUsername: Array.isArray(item.contributors)
          ? item.contributors[0]?.username
          : item.contributors?.username,
      })
    ),
  ];

  return allEmbeddings;
}

/**
 * Build aggregated embeddings for each contributor
 * Averages all their contribution embeddings into a single expertise vector
 */
async function buildContributorEmbeddings(workspaceId: string) {
  // Get all workspace contributors
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return [];
  }

  // Fetch all contributions with embeddings, grouped by contributor
  const embeddings = await fetchWorkspaceEmbeddings(workspaceId);

  // Group by contributor and average their embeddings
  const contributorMap = new Map<
    string,
    { username: string; embeddings: number[][]; titles: string[] }
  >();

  for (const item of embeddings) {
    if (!item.contributorUsername || !item.embedding) continue;

    const existing = contributorMap.get(item.contributorUsername) || {
      username: item.contributorUsername,
      embeddings: [],
      titles: [],
    };

    existing.embeddings.push(item.embedding);
    existing.titles.push(item.title);
    contributorMap.set(item.contributorUsername, existing);
  }

  // Create aggregated embeddings
  const contributorEmbeddings = Array.from(contributorMap.entries())
    .filter(([, data]) => data.embeddings.length >= 3) // Need at least 3 contributions
    .map(([username, data]) => ({
      id: username,
      title: `${username}'s expertise`,
      embedding: averageEmbeddings(data.embeddings),
      type: 'contributor' as const,
      contributorUsername: username,
    }));

  return contributorEmbeddings;
}

/**
 * K-means clustering algorithm
 */
async function kMeansClustering(
  embeddings: Array<{ id: string; embedding: number[] }>,
  options: ClusteringOptions
): Promise<ClusteringResult> {
  const { k = 7, maxIterations = 50, convergenceThreshold = 0.01 } = options;

  // Initialize centroids randomly
  let centroids = initializeCentroids(embeddings, k);
  let clusters: EmbeddingCluster[] = [];
  let previousVariance = Infinity;
  let iterations = 0;
  let converged = false;

  // K-means iterations
  for (iterations = 0; iterations < maxIterations; iterations++) {
    // Assign each point to nearest centroid
    clusters = assignToClusters(embeddings, centroids);

    // Calculate new centroids
    const newCentroids = calculateNewCentroids(clusters, embeddings);

    // Check convergence
    const currentVariance = calculateTotalVariance(clusters, embeddings);
    const varianceChange = Math.abs(previousVariance - currentVariance) / previousVariance;

    if (varianceChange < convergenceThreshold) {
      converged = true;
      break;
    }

    centroids = newCentroids;
    previousVariance = currentVariance;
  }

  return {
    clusters,
    iterations,
    finalVariance: previousVariance,
    converged,
  };
}

/**
 * Initialize k centroids randomly from data points
 */
function initializeCentroids(embeddings: Array<{ embedding: number[] }>, k: number): number[][] {
  const shuffled = [...embeddings].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k).map((e) => e.embedding);
}

/**
 * Assign each embedding to the nearest centroid
 */
function assignToClusters(
  embeddings: Array<{ id: string; embedding: number[] }>,
  centroids: number[][]
): EmbeddingCluster[] {
  const clusters: EmbeddingCluster[] = centroids.map((centroid, id) => ({
    id,
    centroid,
    itemIds: [],
    variance: 0,
  }));

  for (const item of embeddings) {
    // Find nearest centroid
    let minDistance = Infinity;
    let nearestCluster = 0;

    for (let i = 0; i < centroids.length; i++) {
      const distance = cosineSimilarity(item.embedding, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCluster = i;
      }
    }

    clusters[nearestCluster].itemIds.push(item.id);
  }

  return clusters;
}

/**
 * Calculate new centroids as mean of cluster members
 */
function calculateNewCentroids(
  clusters: EmbeddingCluster[],
  embeddings: Array<{ id: string; embedding: number[] }>
): number[][] {
  return clusters.map((cluster) => {
    if (cluster.itemIds.length === 0) {
      return cluster.centroid; // Keep old centroid if empty
    }

    const clusterEmbeddings = embeddings
      .filter((e) => cluster.itemIds.includes(e.id))
      .map((e) => e.embedding);

    return averageEmbeddings(clusterEmbeddings);
  });
}

/**
 * Calculate total variance across all clusters
 */
function calculateTotalVariance(
  clusters: EmbeddingCluster[],
  embeddings: Array<{ id: string; embedding: number[] }>
): number {
  let totalVariance = 0;

  for (const cluster of clusters) {
    const clusterEmbeddings = embeddings
      .filter((e) => cluster.itemIds.includes(e.id))
      .map((e) => e.embedding);

    if (clusterEmbeddings.length === 0) continue;

    // Calculate variance as average distance from centroid
    const variance =
      clusterEmbeddings.reduce((sum, emb) => {
        return sum + cosineSimilarity(emb, cluster.centroid);
      }, 0) / clusterEmbeddings.length;

    cluster.variance = variance;
    totalVariance += variance;
  }

  return totalVariance;
}

/**
 * Average multiple embedding vectors
 */
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dimensions = embeddings[0].length;
  const sum = new Array(dimensions).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      sum[i] += embedding[i];
    }
  }

  return sum.map((val) => val / embeddings.length);
}

/**
 * Calculate cosine distance between two vectors (1 - similarity)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity; // Distance = 1 - similarity
}

/**
 * Calculate cluster confidence based on variance (lower variance = higher confidence)
 */
function calculateClusterConfidence(variance: number): number {
  // Variance typically ranges from 0 to 2 for cosine distance
  // Map to 0-1 confidence (lower variance = higher confidence)
  return Math.max(0, Math.min(1, 1 - variance / 2));
}

/**
 * Generate human-readable topic labels using LLM
 */
async function generateTopicLabels(
  cluster: EmbeddingCluster,
  sampleTitles: string[]
): Promise<{ primary: string; keywords: string[] }> {
  if (sampleTitles.length === 0) {
    return { primary: 'General Development', keywords: [] };
  }

  // Note: Could enhance with direct LLM call using prompt below
  // const _prompt = `Analyze these GitHub contribution titles and identify the common technical topic/theme:
  //
  // ${sampleTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')}
  //
  // Generate:
  // 1. A concise topic label (2-4 words, e.g., "Authentication & Security", "UI Components", "API Development")
  // 2. Top 3-5 keywords representing this topic
  //
  // Requirements:
  // - Focus on technical aspects, not general terms
  // - Be specific (e.g., "React Hooks" not "Frontend")
  // - Return JSON: {"label": "Topic Name", "keywords": ["keyword1", "keyword2", "keyword3"]}`;

  try {
    const result = await llmService.generateContributorSummary(
      {
        recentPRs: [],
        recentIssues: [],
        recentActivities: [],
        recentDiscussions: [],
        totalContributions: sampleTitles.length,
      },
      { login: 'cluster-analyzer' },
      { feature: 'topic-labeling', traceId: `cluster-${cluster.id}` }
    );

    if (result?.content) {
      // Try to parse JSON response
      const match = result.content.match(/\{[^}]+\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          primary: parsed.label || extractTopicFromTitles(sampleTitles),
          keywords: parsed.keywords || [],
        };
      }
    }

    // Fallback to heuristic extraction
    return {
      primary: extractTopicFromTitles(sampleTitles),
      keywords: extractKeywords(sampleTitles),
    };
  } catch (error) {
    console.error('[Topic Labeling] LLM generation failed, using fallback:', error);
    return {
      primary: extractTopicFromTitles(sampleTitles),
      keywords: extractKeywords(sampleTitles),
    };
  }
}

/**
 * Heuristic topic extraction from titles (fallback when LLM unavailable)
 */
function extractTopicFromTitles(titles: string[]): string {
  const commonWords = [
    'fix',
    'add',
    'update',
    'remove',
    'improve',
    'refactor',
    'feat',
    'chore',
    'docs',
    'test',
  ];

  // Count word frequency (excluding common commit words)
  const wordCounts = new Map<string, number>();

  for (const title of titles) {
    const words = title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && !commonWords.includes(w));

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Get top word
  const sortedWords = Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1]);

  if (sortedWords.length > 0) {
    const topWord = sortedWords[0][0];
    return topWord.charAt(0).toUpperCase() + topWord.slice(1);
  }

  return 'General Development';
}

/**
 * Extract keywords from titles
 */
function extractKeywords(titles: string[]): string[] {
  const commonWords = [
    'fix',
    'add',
    'update',
    'remove',
    'improve',
    'refactor',
    'feat',
    'chore',
    'docs',
    'test',
  ];

  const wordCounts = new Map<string, number>();

  for (const title of titles) {
    const words = title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && !commonWords.includes(w));

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Extract common topics across a group of contributors
 */
async function extractCommonTopics(
  workspaceId: string,
  contributorUsernames: string[]
): Promise<string[]> {
  // Get all contributions from these contributors
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  if (!workspaceRepos || workspaceRepos.length === 0) {
    return [];
  }

  const repoIds = workspaceRepos.map((r) => r.repository_id);

  // Fetch titles from all contributions
  const [issues, prs, discussions] = await Promise.all([
    supabase
      .from('issues')
      .select('title, contributors!inner(username)')
      .in('repository_id', repoIds)
      .in('contributors.username', contributorUsernames)
      .limit(100),

    supabase
      .from('pull_requests')
      .select('title, contributors!inner(username)')
      .in('repository_id', repoIds)
      .in('contributors.username', contributorUsernames)
      .limit(100),

    supabase
      .from('discussions')
      .select('title, contributors!inner(username)')
      .in('repository_id', repoIds)
      .in('contributors.username', contributorUsernames)
      .limit(100),
  ]);

  const allTitles = [
    ...(issues.data || []).map((i) => i.title),
    ...(prs.data || []).map((p) => p.title),
    ...(discussions.data || []).map((d) => d.title),
  ];

  return extractKeywords(allTitles);
}

/**
 * Calculate topic confidence based on contributor's activity
 */
export function calculateTopicConfidence(
  contributorEmbedding: number[],
  topicEmbedding: number[]
): number {
  const distance = cosineSimilarity(contributorEmbedding, topicEmbedding);
  // Convert distance (0-2) to confidence (0-1)
  return Math.max(0, Math.min(1, 1 - distance / 2));
}
