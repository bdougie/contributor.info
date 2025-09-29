/**
 * FAQ Service with LLM-powered dynamic answers and embeddings
 * Extends existing LLM service to provide intelligent FAQ responses
 */

import { openAIService, type LLMInsight } from './openai-service';
import { cacheService } from './cache-service';
import type { PullRequest } from '../types';
// Dynamically import embeddings to avoid bundling heavy transformers library
// import { generateEmbedding } from '../../../app/services/embeddings';

export interface FAQQuestion {
  id: string;
  question: string;
  category: string;
  context: string;
  embedding?: number[];
}

export interface FAQAnswer {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  timestamp: Date;
}

// Import types from existing interfaces
interface PullRequestAuthor {
  login?: string;
}

interface PullRequestData {
  author?: PullRequestAuthor;
  user?: PullRequestAuthor;
  title?: string;
  // Make it compatible with existing PullRequest type
  id?: number;
  number?: number;
  state?: string;
  created_at?: string;
  updated_at?: string;
  merged_at?: string | null;
  closed_at?: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  repository_owner?: string;
  repository_name?: string;
  html_url?: string;
  [key: string]: unknown;
}

interface ContributorData {
  [key: string]: unknown;
}

interface HealthData {
  score?: number;
  [key: string]: unknown;
}

interface ActivityData {
  [key: string]: unknown;
}

export interface RepositoryData {
  pullRequests?: PullRequest[] | PullRequestData[];
  contributors?: ContributorData[];
  health?: HealthData;
  activity?: ActivityData;
}

class FAQService {
  // Increment this to bust the cache when FAQ generation changes
  private readonly CACHE_VERSION = 'v4-specific-answers';

  private defaultQuestions: FAQQuestion[] = [
    {
      id: 'contributor-count',
      question: 'How many contributors does this project have?',
      category: 'contributors',
      context: 'Repository contributors and community size',
    },
    {
      id: 'top-contributors',
      question: 'Who are the top contributors to this project?',
      category: 'contributors',
      context: 'Leading contributors by commit/PR count',
    },
    {
      id: 'commit-frequency',
      question: 'What is the commit frequency for this project?',
      category: 'activity',
      context: 'Development velocity and activity patterns',
    },
    {
      id: 'development-activity',
      question: 'How active is this project development?',
      category: 'activity',
      context: 'Overall project health and development momentum',
    },
    {
      id: 'recent-changes',
      question: 'What are the recent changes in this project?',
      category: 'activity',
      context: 'Latest pull requests and development work',
    },
    {
      id: 'contributor-diversity',
      question: 'How diverse is the contributor base?',
      category: 'contributors',
      context: 'Community diversity and new contributor engagement',
    },
    {
      id: 'pr-patterns',
      question: 'What are the pull request patterns?',
      category: 'development',
      context: 'PR workflow, review patterns, and development practices',
    },
  ];

  /**
   * Check if LLM service is available
   */
  isAvailable(): boolean {
    return openAIService.isAvailable();
  }

  /**
   * Generate dynamic FAQ answers using LLM with repository context
   */
  async generateFAQAnswers(
    owner: string,
    repo: string,
    timeRange: string,
    repositoryData: RepositoryData,
    customQuestions?: string[]
  ): Promise<FAQAnswer[]> {
    const cacheKey = this.buildCacheKey('faq', { owner, repo }, timeRange);
    const dataHash = this.generateDataHash({ repositoryData, timeRange });

    // Check cache first
    const cached = cacheService.get(cacheKey, dataHash);
    if (cached) {
      return cached as unknown as FAQAnswer[];
    }

    try {
      const answers: FAQAnswer[] = [];
      const questions = customQuestions
        ? this.createCustomQuestions(customQuestions)
        : this.defaultQuestions;

      // Generate answers for each question
      for (const question of questions) {
        const answer = await this.generateSingleAnswer(
          question,
          owner,
          repo,
          timeRange,
          repositoryData
        );

        if (answer) {
          answers.push(answer);
        }
      }

      // Cache successful results
      cacheService.set(cacheKey, answers as unknown as LLMInsight, dataHash, 24 * 60 * 60 * 1000); // 24 hour cache

      return answers;
    } catch (error) {
      console.error('Failed to generate FAQ answers:', error);
      return this.generateFallbackAnswers(owner, repo, timeRange, repositoryData);
    }
  }

  /**
   * Generate answer for a single FAQ question using LLM
   */
  private async generateSingleAnswer(
    question: FAQQuestion,
    owner: string,
    repo: string,
    timeRange: string,
    repositoryData: RepositoryData
  ): Promise<FAQAnswer | null> {
    if (!this.isAvailable()) {
      return this.generateFallbackAnswer(question, owner, repo, timeRange, repositoryData);
    }

    try {
      const prompt = this.buildFAQPrompt(question, owner, repo, timeRange, repositoryData);

      // Call OpenAI directly with FAQ-specific prompt
      const response = await this.callOpenAIForFAQ(prompt);

      if (!response) {
        throw new Error('Failed to generate FAQ answer');
      }

      // Extract sources from repository data
      const sources = this.extractSources(question.category, repositoryData);

      return {
        id: question.id,
        question: question.question.replace(/this project/g, `${owner}/${repo}`),
        answer: response,
        confidence: 0.85, // High confidence for LLM answers
        sources,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to generate LLM answer for %s:', error, question.id);
      return this.generateFallbackAnswer(question, owner, repo, timeRange, repositoryData);
    }
  }

  /**
   * Build prompt for FAQ question using repository context
   */
  private buildFAQPrompt(
    question: FAQQuestion,
    owner: string,
    repo: string,
    timeRange: string,
    repositoryData: RepositoryData
  ): string {
    const timeRangeText = this.getTimeRangeText(timeRange);
    const contextData = this.prepareContextData(repositoryData, question.category);

    return `Answer this FAQ question about the ${owner}/${repo} repository using the provided data.

Question: ${question.question.replace(/this project/g, `${owner}/${repo}`)}
Context: ${question.context}
Time Range: ${timeRangeText}

Repository Data:
${contextData}

Requirements:
- Maximum 50 words - STRICTLY ENFORCED
- Use only essential facts and numbers
- No introductory phrases or filler words
- Direct, telegram-style answers preferred
- Focus on ONE key insight only
- Omit obvious context already in the question

Answer:`;
  }

  /**
   * Prepare context data based on question category
   */
  private prepareContextData(repositoryData: RepositoryData, category: string): string {
    const data: string[] = [];

    if (category === 'contributors' && repositoryData.pullRequests) {
      const contributors = new Set(
        repositoryData.pullRequests.map(
          (pr: PullRequest | PullRequestData) => pr.author?.login || pr.user?.login || 'unknown'
        )
      ).size;
      const contributorCounts = repositoryData.pullRequests.reduce(
        (acc, pr) => {
          const authorLogin = pr.author?.login || pr.user?.login || 'unknown';
          acc[authorLogin] = (acc[authorLogin] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const topContributors = Object.entries(contributorCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

      data.push(`Total Contributors: ${contributors}`);
      data.push(
        `Top Contributors: ${topContributors.map(([name, count]) => `${name} (${count})`).join(', ')}`
      );
    }

    if (category === 'activity' && repositoryData.pullRequests) {
      const totalPRs = repositoryData.pullRequests.length;
      const merged = repositoryData.pullRequests.filter((pr) => pr.merged_at).length;
      const recentTitles = repositoryData.pullRequests.slice(0, 5).map((pr) => pr.title);

      data.push(`Total PRs: ${totalPRs}`);
      data.push(`Merged PRs: ${merged}`);
      data.push(`Recent PRs: ${recentTitles.join('; ')}`);
    }

    if (category === 'development' && repositoryData.pullRequests) {
      const avgTitleLength =
        repositoryData.pullRequests.reduce(
          (sum, pr) => sum + (typeof pr.title === 'string' ? pr.title.length : 0),
          0
        ) / repositoryData.pullRequests.length;
      const featCount = repositoryData.pullRequests.filter(
        (pr) => typeof pr.title === 'string' && pr.title.toLowerCase().includes('feat')
      ).length;
      const fixCount = repositoryData.pullRequests.filter(
        (pr) => typeof pr.title === 'string' && pr.title.toLowerCase().includes('fix')
      ).length;

      data.push(`Average PR Title Length: ${avgTitleLength.toFixed(0)} characters`);
      data.push(`Feature PRs: ${featCount}`);
      data.push(`Fix PRs: ${fixCount}`);
    }

    if (repositoryData.health) {
      data.push(`Repository Health Score: ${repositoryData.health.score}/100`);
    }

    return data.join('\n');
  }

  /**
   * Extract relevant sources for citations
   */
  private extractSources(category: string, repositoryData: RepositoryData): string[] {
    const sources = ['Repository pull request data'];

    if (category === 'contributors') {
      sources.push('Contributor activity analysis');
    }

    if (category === 'activity' && repositoryData.activity) {
      sources.push('Development velocity metrics');
    }

    if (repositoryData.health) {
      sources.push('Repository health assessment');
    }

    return sources;
  }

  /**
   * Generate fallback answers when LLM is unavailable
   */
  private generateFallbackAnswers(
    owner: string,
    repo: string,
    timeRange: string,
    repositoryData: RepositoryData
  ): FAQAnswer[] {
    return this.defaultQuestions
      .map((question) =>
        this.generateFallbackAnswer(question, owner, repo, timeRange, repositoryData)
      )
      .filter(Boolean) as FAQAnswer[];
  }

  /**
   * Generate fallback answer for a single question
   */
  private generateFallbackAnswer(
    question: FAQQuestion,
    owner: string,
    repo: string,
    timeRange: string,
    repositoryData: RepositoryData
  ): FAQAnswer {
    let answer = '';
    const timeRangeText = this.getTimeRangeText(timeRange);

    switch (question.id) {
      case 'contributor-count':
        if (repositoryData.pullRequests) {
          const count = new Set(repositoryData.pullRequests.map((pr) => pr.author)).size;
          answer = `${owner}/${repo} has ${count} unique contributors who have submitted pull requests ${timeRangeText}.`;
        }
        break;
      case 'top-contributors':
        if (repositoryData.pullRequests) {
          const contributorCounts = repositoryData.pullRequests.reduce(
            (acc, pr) => {
              const authorLogin = pr.author?.login || pr.user?.login || 'unknown';
              acc[authorLogin] = (acc[authorLogin] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );
          const top = Object.entries(contributorCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([name, count]) => `${name} (${count} PRs)`);
          answer = `The top contributors ${timeRangeText} are: ${top.join(', ')}.`;
        }
        break;
      default:
        answer = 'Data is currently being analyzed. Please check back later for detailed insights.';
    }

    return {
      id: question.id,
      question: question.question.replace(/this project/g, `${owner}/${repo}`),
      answer: answer || 'Information not available at this time.',
      confidence: 0.6, // Lower confidence for fallback
      sources: ['Repository data analysis'],
      timestamp: new Date(),
    };
  }

  /**
   * Create custom questions from user input
   */
  private createCustomQuestions(questions: string[]): FAQQuestion[] {
    return questions.map((q, index) => ({
      id: `custom-${index}`,
      question: q,
      category: 'general',
      context: 'Custom user question about repository',
    }));
  }

  /**
   * Generate embeddings for FAQ questions to enable semantic search
   * NOTE: This should only be called server-side (edge functions)
   */
  async generateQuestionEmbeddings(questions: FAQQuestion[]): Promise<FAQQuestion[]> {
    // Skip embeddings generation on client-side
    if (typeof window !== 'undefined') {
      console.log('Embeddings generation skipped on client-side');
      return questions;
    }

    try {
      // Dynamically import to avoid bundling heavy dependencies
      // Use a variable to prevent Vite from statically analyzing the import
      const embeddingsPath = '../../../app/services/embeddings';
      const { generateEmbedding } = await import(/* @vite-ignore */ embeddingsPath);

      const questionsWithEmbeddings: FAQQuestion[] = [];

      for (const question of questions) {
        const embedding = await generateEmbedding(question.question + ' ' + question.context);
        questionsWithEmbeddings.push({
          ...question,
          embedding,
        });
      }

      return questionsWithEmbeddings;
    } catch (error) {
      console.error('Failed to generate question embeddings:', error);
      return questions; // Return without embeddings on failure
    }
  }

  /**
   * Find similar questions using embeddings
   * NOTE: This should only be called server-side (edge functions)
   */
  async findSimilarQuestions(
    userQuestion: string,
    questions: FAQQuestion[],
    threshold: number = 0.7
  ): Promise<FAQQuestion[]> {
    // Skip embeddings-based search on client-side
    if (typeof window !== 'undefined') {
      console.log('Embeddings-based search skipped on client-side');
      // Return basic keyword-based matches instead
      const lowerQuestion = userQuestion.toLowerCase();
      return questions
        .filter(
          (q) =>
            q.question.toLowerCase().includes(lowerQuestion) ||
            q.context.toLowerCase().includes(lowerQuestion)
        )
        .slice(0, 3);
    }

    try {
      // Dynamically import to avoid bundling heavy dependencies
      // Use a variable to prevent Vite from statically analyzing the import
      const embeddingsPath = '../../../app/services/embeddings';
      const { generateEmbedding } = await import(/* @vite-ignore */ embeddingsPath);
      const userEmbedding = await generateEmbedding(userQuestion);

      const similarities = questions
        .filter((q) => q.embedding)
        .map((q) => ({
          question: q,
          similarity: this.cosineSimilarity(userEmbedding, q.embedding!),
        }))
        .filter((s) => s.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

      return similarities.map((s) => s.question);
    } catch (error) {
      console.error('Failed to find similar questions:', error);
      return questions.slice(0, 3); // Return first 3 as fallback
    }
  }

  /**
   * Call OpenAI directly for FAQ-specific answers
   */
  private async callOpenAIForFAQ(prompt: string): Promise<string | null> {
    const apiKey = import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.error('OpenAI API key not configured');
      return null;
    }

    // Prevent real API calls in test environment
    if (
      process.env.NODE_ENV === 'test' ||
      apiKey === 'test-openai-key' ||
      apiKey === 'test-key-for-ci'
    ) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a concise FAQ assistant. Answer the specific question asked using only the provided data. Maximum 50 words. Be direct and factual.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 100,
          temperature: 0.3,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('OpenAI API error: %s', response.status);
        return null;
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        return null;
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to call OpenAI for FAQ:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Convert time range to human readable text
   */
  private getTimeRangeText(timeRange: string): string {
    switch (timeRange) {
      case '30d':
        return 'in the last 30 days';
      case '90d':
        return 'in the last 90 days';
      case '6m':
        return 'in the last 6 months';
      case '1y':
        return 'in the last year';
      default:
        return 'in the selected time period';
    }
  }

  /**
   * Build cache key with version for cache busting
   */
  private buildCacheKey(
    type: string,
    repoInfo: { owner: string; repo: string },
    timeRange: string
  ): string {
    return `${type}:${repoInfo.owner}/${repoInfo.repo}:${timeRange}:${this.CACHE_VERSION}`;
  }

  /**
   * Generate hash from data for cache invalidation
   */
  private generateDataHash(data: unknown): string {
    const dataString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const faqService = new FAQService();

// Types are already exported at the interface declaration
