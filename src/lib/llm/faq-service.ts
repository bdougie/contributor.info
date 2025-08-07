/**
 * FAQ Service with LLM-powered dynamic answers and embeddings
 * Extends existing LLM service to provide intelligent FAQ responses
 */

import { openAIService, type LLMInsight } from './openai-service';
import { cacheService } from './cache-service';
import { generateEmbedding } from '../../../app/services/embeddings';

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

export interface RepositoryData {
  pullRequests?: any[];
  contributors?: any[];
  health?: any;
  activity?: any;
}

class FAQService {
  private defaultQuestions: FAQQuestion[] = [
    {
      id: 'contributor-count',
      question: 'How many contributors does this project have?',
      category: 'contributors',
      context: 'Repository contributors and community size'
    },
    {
      id: 'top-contributors',
      question: 'Who are the top contributors to this project?',
      category: 'contributors', 
      context: 'Leading contributors by commit/PR count'
    },
    {
      id: 'commit-frequency',
      question: 'What is the commit frequency for this project?',
      category: 'activity',
      context: 'Development velocity and activity patterns'
    },
    {
      id: 'development-activity',
      question: 'How active is this project development?',
      category: 'activity',
      context: 'Overall project health and development momentum'
    },
    {
      id: 'recent-changes',
      question: 'What are the recent changes in this project?',
      category: 'activity',
      context: 'Latest pull requests and development work'
    },
    {
      id: 'contributor-diversity',
      question: 'How diverse is the contributor base?',
      category: 'contributors',
      context: 'Community diversity and new contributor engagement'
    },
    {
      id: 'pr-patterns',
      question: 'What are the pull request patterns?',
      category: 'development',
      context: 'PR workflow, review patterns, and development practices'
    }
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
      cacheService.set(cacheKey, answers as unknown as LLMInsight, dataHash, 60 * 60 * 1000); // 1 hour cache

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
      // Use cost-effective model for FAQ answers
      
      // Create a mock insight structure to work with existing OpenAI patterns
      const faqInsight = await this.generateFAQInsight(prompt, { owner, repo });
      if (!faqInsight) {
        throw new Error('Failed to generate FAQ insight');
      }
      
      const response = faqInsight.content;
      
      // Extract sources from repository data
      const sources = this.extractSources(question.category, repositoryData);

      return {
        id: question.id,
        question: question.question.replace(/this project/g, `${owner}/${repo}`),
        answer: response,
        confidence: 0.85, // High confidence for LLM answers
        sources,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Failed to generate LLM answer for ${question.id}:`, error);
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
- Provide a clear, accurate answer based on the data
- Use specific numbers and metrics when available
- Keep response under 200 words
- Focus on actionable insights
- Be conversational but professional
- Include relevant trends or patterns you observe

Answer:`;
  }

  /**
   * Prepare context data based on question category
   */
  private prepareContextData(repositoryData: RepositoryData, category: string): string {
    const data: string[] = [];

    if (category === 'contributors' && repositoryData.pullRequests) {
      const contributors = new Set(repositoryData.pullRequests.map((pr: any) => pr.author?.login || pr.user?.login || 'unknown')).size;
      const contributorCounts = repositoryData.pullRequests.reduce((acc, pr) => {
        const authorLogin = pr.author?.login || pr.user?.login || 'unknown';
        acc[authorLogin] = (acc[authorLogin] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topContributors = Object.entries(contributorCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

      data.push(`Total Contributors: ${contributors}`);
      data.push(`Top Contributors: ${topContributors.map(([name, count]) => `${name} (${count})`).join(', ')}`);
    }

    if (category === 'activity' && repositoryData.pullRequests) {
      const totalPRs = repositoryData.pullRequests.length;
      const merged = repositoryData.pullRequests.filter(pr => pr.merged_at).length;
      const recentTitles = repositoryData.pullRequests.slice(0, 5).map(pr => pr.title);

      data.push(`Total PRs: ${totalPRs}`);
      data.push(`Merged PRs: ${merged}`);
      data.push(`Recent PRs: ${recentTitles.join('; ')}`);
    }

    if (category === 'development' && repositoryData.pullRequests) {
      const avgTitleLength = repositoryData.pullRequests.reduce((sum, pr) => sum + pr.title.length, 0) / repositoryData.pullRequests.length;
      const featCount = repositoryData.pullRequests.filter(pr => pr.title.toLowerCase().includes('feat')).length;
      const fixCount = repositoryData.pullRequests.filter(pr => pr.title.toLowerCase().includes('fix')).length;

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
    return this.defaultQuestions.map(question => 
      this.generateFallbackAnswer(question, owner, repo, timeRange, repositoryData)
    ).filter(Boolean) as FAQAnswer[];
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
          const count = new Set(repositoryData.pullRequests.map(pr => pr.author)).size;
          answer = `${owner}/${repo} has ${count} unique contributors who have submitted pull requests ${timeRangeText}.`;
        }
        break;
      case 'top-contributors':
        if (repositoryData.pullRequests) {
          const contributorCounts = repositoryData.pullRequests.reduce((acc, pr) => {
            const authorLogin = pr.author?.login || pr.user?.login || 'unknown';
        acc[authorLogin] = (acc[authorLogin] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
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
      timestamp: new Date()
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
      context: 'Custom user question about repository'
    }));
  }

  /**
   * Generate embeddings for FAQ questions to enable semantic search
   */
  async generateQuestionEmbeddings(questions: FAQQuestion[]): Promise<FAQQuestion[]> {
    try {
      const questionsWithEmbeddings: FAQQuestion[] = [];

      for (const question of questions) {
        const embedding = await generateEmbedding(question.question + ' ' + question.context);
        questionsWithEmbeddings.push({
          ...question,
          embedding
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
   */
  async findSimilarQuestions(
    userQuestion: string,
    questions: FAQQuestion[],
    threshold: number = 0.7
  ): Promise<FAQQuestion[]> {
    try {
      const userEmbedding = await generateEmbedding(userQuestion);
      
      const similarities = questions
        .filter(q => q.embedding)
        .map(q => ({
          question: q,
          similarity: this.cosineSimilarity(userEmbedding, q.embedding!)
        }))
        .filter(s => s.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

      return similarities.map(s => s.question);
    } catch (error) {
      console.error('Failed to find similar questions:', error);
      return questions.slice(0, 3); // Return first 3 as fallback
    }
  }

  /**
   * Generate FAQ insight using existing OpenAI infrastructure
   */
  private async generateFAQInsight(prompt: string, repoInfo: { owner: string; repo: string }): Promise<LLMInsight | null> {
    // Create a mock health data structure that includes our FAQ prompt
    const mockHealthData = {
      score: 80,
      trend: 'stable',
      factors: [{
        name: 'faq_context',
        score: 100,
        status: 'good',
        description: prompt // Embed our FAQ prompt in the description
      }],
      recommendations: ['Answer the embedded FAQ question in the factor description']
    };

    try {
      return await openAIService.generateHealthInsight(mockHealthData, repoInfo);
    } catch (error) {
      console.error('Failed to generate FAQ insight:', error);
      return null;
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
      case '30d': return 'in the last 30 days';
      case '90d': return 'in the last 90 days';
      case '6m': return 'in the last 6 months';
      case '1y': return 'in the last year';
      default: return 'in the selected time period';
    }
  }

  /**
   * Build cache key
   */
  private buildCacheKey(type: string, repoInfo: { owner: string; repo: string }, timeRange: string): string {
    return `${type}:${repoInfo.owner}/${repoInfo.repo}:${timeRange}`;
  }

  /**
   * Generate hash from data for cache invalidation
   */
  private generateDataHash(data: any): string {
    const dataString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const faqService = new FAQService();

// Types are already exported at the interface declaration