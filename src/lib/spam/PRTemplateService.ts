import { supabase } from '@/lib/supabase';

interface PRTemplate {
  content: string;
  url: string;
  hash: string;
  fetched_at: string;
}

interface SpamPattern {
  pattern_type: 'template_match' | 'empty_sections' | 'minimal_effort';
  pattern_content: string;
  pattern_description: string;
  weight: number;
}

export class PRTemplateService {
  private static readonly TEMPLATE_PATHS = [
    '.github/pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/pull_request_template/PULL_REQUEST_TEMPLATE.md',
    '.github/PULL_REQUEST_TEMPLATE/pull_request_template.md',
    'docs/pull_request_template.md',
    'docs/PULL_REQUEST_TEMPLATE.md',
    'PULL_REQUEST_TEMPLATE.md',
    'pull_request_template.md',
  ];

  /**
   * Fetch PR template for a repository from GitHub
   */
  async fetchPRTemplate(owner: string, repo: string): Promise<PRTemplate | null> {
    for (const templatePath of PRTemplateService.TEMPLATE_PATHS) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${templatePath}`,
        );

        if (response.ok) {
          const _ = await response.json();

          if (data.content && _data.encoding === 'base64') {
            const content = atob(_data.content).replace(/\n/g, '');
            const hash = this.generateHash(content);

            return {
              content,
              url: data.html_url,
              hash,
              fetched_at: new Date().toISOString(),
            };
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch template at ${templatePath}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Generate hash for template content using simple string hashing
   */
  private generateHash(content: string): string {
    const normalizedContent = content.toLowerCase().trim();
    let hash = 0;
    if (normalizedContent.length === 0) return '0';
    for (let i = 0; i < normalizedContent.length; i++) {
      const char = normalizedContent.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Cache PR template in database
   */
  async cachePRTemplate(repositoryId: string, template: PRTemplate): Promise<void> {
    const { error } = await supabase
      .from('repositories')
      .update({
        pr_template_content: template.content,
        pr_template_url: template.url,
        pr_template_hash: template.hash,
        pr_template_fetched_at: template.fetched_at,
      })
      .eq('id', repositoryId);

    if (error) {
      throw new Error(`Failed to cache PR template: ${error.message}`);
    }

    // Generate and store spam patterns for this template
    await this.generateSpamPatterns(repositoryId, template.content);
  }

  /**
   * Get cached PR template for repository
   */
  async getCachedPRTemplate(owner: string, repo: string): Promise<PRTemplate | null> {
    const { data, error } = await supabase
      .from('repositories')
      .select('pr_template_content, pr_template_url, pr_template_hash, pr_template_fetched_at')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (error || !_data?.pr_template_content) {
      return null;
    }

    return {
      content: data.pr_template_content,
      url: data.pr_template_url || '',
      hash: data.pr_template_hash || '',
      fetched_at: data.pr_template_fetched_at || '',
    };
  }

  /**
   * Fetch and cache PR template if not already cached or outdated
   */
  async ensurePRTemplate(
    repositoryId: string,
    owner: string,
    repo: string,
  ): Promise<PRTemplate | null> {
    // Check if we have a cached template that's less than 7 days old
    const cached = await this.getCachedPRTemplate(owner, repo);

    if (cached && cached.fetched_at) {
      const fetchedDate = new Date(cached.fetched_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      if (fetchedDate > weekAgo) {
        return cached;
      }
    }

    // Fetch fresh template
    const template = await this.fetchPRTemplate(owner, repo);

    if (template) {
      await this.cachePRTemplate(repositoryId, template);
      return template;
    }

    // If fetch failed but we have cached version, return it
    return cached;
  }

  /**
   * Generate spam detection patterns from PR template
   */
  private async generateSpamPatterns(repositoryId: string, templateContent: string): Promise<void> {
    const patterns: SpamPattern[] = [];

    // Clean up template content
    let cleanTemplate = templateContent;
    let previousTemplate;
    do {
      previousTemplate = cleanTemplate;
      cleanTemplate = cleanTemplate.replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments
    } while (cleanTemplate !== previousTemplate);
    cleanTemplate = cleanTemplate
      .replace(/\[.*?\]/g, '') // Remove markdown checkboxes
      .replace(/#+\s*/g, '') // Remove markdown headers
      .trim();

    // Pattern 1: Template sections as content (empty template usage)
    const templateSections = this.extractTemplateSections(cleanTemplate);
    if (templateSections.length > 0) {
      patterns.push({
        pattern_type: 'template_match',
        pattern_content: templateSections.join(' ').toLowerCase(),
        pattern_description: 'PR description matches template structure without content',
        weight: 0.9,
      });
    }

    // Pattern 2: Common placeholder text
    const placeholders = this.extractPlaceholders(templateContent);
    for (const placeholder of placeholders) {
      patterns.push({
        pattern_type: 'template_match',
        pattern_content: placeholder.toLowerCase(),
        pattern_description: `PR contains template placeholder: "${placeholder}"`,
        weight: 0.95,
      });
    }

    // Pattern 3: Empty sections pattern
    const sectionTitles = this.extractSectionTitles(templateContent);
    if (sectionTitles.length > 0) {
      patterns.push({
        pattern_type: 'empty_sections',
        pattern_content: sectionTitles.join('|').toLowerCase(),
        pattern_description: 'PR has template sections but no content',
        weight: 0.8,
      });
    }

    // Store patterns in database
    for (const pattern of patterns) {
      await supabase.from('repository_spam_patterns').upsert(
        {
          repository_id: repositoryId,
          ...pattern,
        },
        {
          onConflict: 'repository_id,pattern_type,pattern_content',
        },
      );
    }
  }

  /**
   * Extract main sections from template
   */
  private extractTemplateSections(template: string): string[] {
    const sections = template
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .filter((line) => line.length < 100) // Avoid very long lines
      .slice(0, 5); // Take first 5 meaningful lines

    return sections;
  }

  /**
   * Extract placeholder text from template
   */
  private extractPlaceholders(template: string): string[] {
    const placeholders: string[] = [];

    // Match common placeholder patterns
    const patterns = [
      /\[(.*?)\]/g, // [placeholder text]
      /\{(.*?)\}/g, // {placeholder text}
      /\<(.*?)\>/g, // <placeholder text>
      /\[(.*?)\]\(.*?\)/g, // [text](link) - markdown links as placeholders
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(template)) !== null) {
        const placeholder = match[1].trim();
        if (placeholder.length > 5 && placeholder.length < 50) {
          placeholders.push(placeholder);
        }
      }
    }

    return [...new Set(placeholders)]; // Remove duplicates
  }

  /**
   * Extract section titles from template
   */
  private extractSectionTitles(template: string): string[] {
    const titles: string[] = [];
    const lines = template.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match markdown headers
      const headerMatch = trimmed.match(/^#+\s*(.+)$/);
      if (headerMatch) {
        const title = headerMatch[1].trim();
        if (title.length > 2 && title.length < 30) {
          titles.push(title);
        }
      }
    }

    return titles;
  }

  /**
   * Check if PR description matches repository-specific spam patterns
   */
  async checkRepositorySpamPatterns(
    repositoryId: string,
    description: string,
  ): Promise<{
    is_match: boolean;
    matched_patterns: Array<{
      pattern_type: string;
      pattern_content: string;
      pattern_description: string;
      weight: number;
      confidence: number;
    }>;
    overall_confidence: number;
  }> {
    const { data: patterns, error } = await supabase
      .from('repository_spam_patterns')
      .select('*')
      .eq('repository_id', repositoryId);

    if (error || !patterns || patterns.length === 0) {
      return {
        is_match: false,
        matched_patterns: [],
        overall_confidence: 0,
      };
    }

    const matched_patterns = [];
    const cleanDescription = description.toLowerCase().trim();

    for (const pattern of patterns) {
      let confidence = 0;

      switch (pattern.pattern_type) {
        case 'template_match':
          confidence = this.calculateSimilarity(cleanDescription, pattern.pattern_content);
          break;
        case 'empty_sections':
          confidence = this.checkEmptySections(description, pattern.pattern_content);
          break;
        case 'minimal_effort':
          confidence = this.checkMinimalEffort(description, pattern.pattern_content);
          break;
      }

      if (confidence > 0.7) {
        matched_patterns.push({
          pattern_type: pattern.pattern_type,
          pattern_content: pattern.pattern_content,
          pattern_description: pattern.pattern_description,
          weight: pattern.weight,
          confidence,
        });
      }
    }

    const overall_confidence =
      matched_patterns.length > 0
        ? matched_patterns.reduce((sum, p) => sum + p.confidence * p.weight, 0) /
          matched_patterns.length
        : 0;

    return {
      is_match: matched_patterns.length > 0,
      matched_patterns,
      overall_confidence,
    };
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len2][len1] / maxLen;
  }

  /**
   * Check if description has template sections without content
   */
  private checkEmptySections(description: string, sectionPattern: string): number {
    const sections = sectionPattern.split('|');
    let emptyCount = 0;

    for (const section of sections) {
      if (description.toLowerCase().includes(section.toLowerCase())) {
        // Check if section appears but has no content after it
        const sectionIndex = description.toLowerCase().indexOf(section.toLowerCase());
        const afterSection = description.substring(
          sectionIndex + section.length,
          sectionIndex + section.length + 100,
        );

        if (afterSection.trim().length < 10) {
          emptyCount++;
        }
      }
    }

    return sections.length > 0 ? emptyCount / sections.length : 0;
  }

  /**
   * Check for minimal effort patterns
   */
  private checkMinimalEffort(description: string, pattern: string): number {
    const minimalPatterns = pattern.split('|');

    for (const minPattern of minimalPatterns) {
      if (description.toLowerCase().includes(minPattern.toLowerCase())) {
        return 1.0;
      }
    }

    return 0;
  }

  /**
   * Fetch templates for all tracked repositories
   */
  async syncAllRepositoryTemplates(): Promise<{
    processed: number;
    updated: number;
    errors: string[];
  }> {
    const { data: repositories, error } = await supabase
      .from('repositories')
      .select('id, owner, name, pr_template_fetched_at')
      .eq('tracking_enabled', true);

    if (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }

    const results = {
      processed: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const repo of repositories || []) {
      try {
        results.processed++;

        const template = await this.ensurePRTemplate(repo.id, repo.owner, repo.name);
        if (template) {
          results.updated++;
        }

        // Add small delay to avoid hitting GitHub API rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = `${repo.owner}/${repo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error("Error:", error);
      }
    }

    return results;
  }
}
