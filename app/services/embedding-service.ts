import { similarityCache } from './similarity-cache';

interface EmbeddingItem {
  id: string;
  title: string;
  body: string | null;
  type: 'issue' | 'pull_request';
  repositoryId: string;
}

interface BatchEmbeddingResult {
  itemId: string;
  embedding: number[] | null;
  error?: string;
}

export class EmbeddingService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.openai.com/v1';
  private model = 'text-embedding-3-small'; // Cheaper and faster
  private maxBatchSize = 20;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second

  constructor() {
    this.apiKey = import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate embedding for a single item
   */
  async generateEmbedding(item: EmbeddingItem): Promise<number[] | null> {
    if (!this.isAvailable()) {
      console.warn('OpenAI API key not configured');
      return null;
    }

    const contentHash = similarityCache.generateContentHash(item.title, item.body || '');

    // Check cache first
    const cached = await similarityCache.get(
      item.repositoryId,
      item.type,
      item.id,
      contentHash
    );

    if (cached) {
      return cached;
    }

    // Generate new embedding
    try {
      const text = this.prepareText(item);
      const embedding = await this.callEmbeddingAPI([text]);

      if (embedding && embedding[0]) {
        // Store in cache
        await similarityCache.set(
          item.repositoryId,
          item.type,
          item.id,
          contentHash,
          embedding[0]
        );
        return embedding[0];
      }
    } catch (error) {
      console.error('Failed to generate embedding:', error);
    }

    return null;
  }

  /**
   * Generate embeddings for multiple items in batch
   */
  async generateBatchEmbeddings(
    items: EmbeddingItem[],
    options: {
      returnPartial?: boolean;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<BatchEmbeddingResult[]> {
    const results: BatchEmbeddingResult[] = [];
    const { returnPartial = true, onProgress } = options;

    // Check cache for all items first
    const cacheResults = await this.checkBatchCache(items);
    const uncachedItems: EmbeddingItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cached = cacheResults.get(item.id);

      if (cached) {
        results.push({ itemId: item.id, embedding: cached });
      } else {
        uncachedItems.push(item);
      }
    }

    // Process uncached items in batches
    for (let i = 0; i < uncachedItems.length; i += this.maxBatchSize) {
      const batch = uncachedItems.slice(i, i + this.maxBatchSize);
      const batchResults = await this.processBatch(batch);

      results.push(...batchResults);

      // Report progress
      if (onProgress) {
        const processed = results.length;
        onProgress(processed, items.length);
      }

      // Return partial results if requested
      if (returnPartial && results.length >= 10 && i + this.maxBatchSize < uncachedItems.length) {
        // Continue processing in background
        this.processRemainingInBackground(
          uncachedItems.slice(i + this.maxBatchSize),
          onProgress,
          items.length,
          results.length
        );
        break;
      }
    }

    return results;
  }

  /**
   * Check cache for batch of items
   */
  private async checkBatchCache(items: EmbeddingItem[]): Promise<Map<string, number[]>> {
    const cacheRequests = items.map((item) => ({
      repositoryId: item.repositoryId,
      itemType: item.type,
      itemId: item.id,
      contentHash: similarityCache.generateContentHash(item.title, item.body || ''),
    }));

    const cacheResults = await similarityCache.getBatch(cacheRequests);
    const results = new Map<string, number[]>();

    for (const [itemId, embedding] of cacheResults.entries()) {
      if (embedding) {
        results.set(itemId, embedding);
      }
    }

    return results;
  }

  /**
   * Process a batch of items
   */
  private async processBatch(items: EmbeddingItem[]): Promise<BatchEmbeddingResult[]> {
    if (!this.isAvailable()) {
      return items.map((item) => ({
        itemId: item.id,
        embedding: null,
        error: 'OpenAI API not configured',
      }));
    }

    const texts = items.map((item) => this.prepareText(item));

    try {
      const embeddings = await this.callEmbeddingAPI(texts);

      const results: BatchEmbeddingResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const embedding = embeddings[i];

        if (embedding) {
          // Store in cache
          const contentHash = similarityCache.generateContentHash(item.title, item.body || '');
          await similarityCache.set(
            item.repositoryId,
            item.type,
            item.id,
            contentHash,
            embedding
          );

          results.push({ itemId: item.id, embedding });
        } else {
          results.push({
            itemId: item.id,
            embedding: null,
            error: 'Failed to generate embedding',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Batch embedding failed:', error);
      return items.map((item) => ({
        itemId: item.id,
        embedding: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  /**
   * Continue processing remaining items in background
   */
  private async processRemainingInBackground(
    items: EmbeddingItem[],
    onProgress?: (processed: number, total: number) => void,
    totalItems?: number,
    startingCount?: number
  ): Promise<void> {
    let processed = startingCount || 0;

    for (let i = 0; i < items.length; i += this.maxBatchSize) {
      const batch = items.slice(i, i + this.maxBatchSize);
      await this.processBatch(batch);

      processed += batch.length;
      if (onProgress && totalItems) {
        onProgress(processed, totalItems);
      }
    }
  }

  /**
   * Prepare text for embedding
   */
  private prepareText(item: EmbeddingItem): string {
    const parts = [`[${item.type.toUpperCase()}]`, item.title];

    if (item.body) {
      // Truncate body to reasonable length (first 1000 chars)
      const truncatedBody = item.body.length > 1000 ? item.body.substring(0, 1000) + '...' : item.body;
      parts.push(truncatedBody);
    }

    return parts.join(' ');
  }

  /**
   * Call OpenAI embedding API with retry logic
   */
  private async callEmbeddingAPI(texts: string[], retryCount = 0): Promise<(number[] | null)[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        if (response.status === 429 && retryCount < this.maxRetries) {
          // Rate limited, retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.callEmbeddingAPI(texts, retryCount + 1);
        }
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding || null);
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.callEmbeddingAPI(texts, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();