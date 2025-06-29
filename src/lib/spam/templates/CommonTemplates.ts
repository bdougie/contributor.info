import { SpamTemplate } from '../types';

// Common spam templates identified from PR data
export const COMMON_SPAM_TEMPLATES: SpamTemplate[] = [
  // Hacktoberfest spam templates
  {
    id: 'hacktoberfest_basic',
    template: 'added my name',
    description: 'Basic "added my name" spam common during Hacktoberfest',
    category: 'hacktoberfest',
    weight: 0.9,
  },
  {
    id: 'hacktoberfest_readme',
    template: 'updated readme',
    description: 'Generic readme updates without meaningful changes',
    category: 'hacktoberfest',
    weight: 0.8,
  },
  {
    id: 'hacktoberfest_typo',
    template: 'fixed typo',
    description: 'Generic typo fixes without specific details',
    category: 'hacktoberfest',
    weight: 0.7,
  },
  
  // First contribution templates
  {
    id: 'first_contrib_basic',
    template: 'my first contribution',
    description: 'Basic first contribution message without context',
    category: 'first_contribution',
    weight: 0.6,
  },
  {
    id: 'first_contrib_hello',
    template: 'hello world',
    description: 'Hello world style first contributions',
    category: 'first_contribution',
    weight: 0.7,
  },
  
  // Generic spam
  {
    id: 'generic_update',
    template: 'update',
    description: 'Single word "update" descriptions',
    category: 'generic_spam',
    weight: 0.8,
  },
  {
    id: 'generic_fix',
    template: 'fix',
    description: 'Single word "fix" descriptions',
    category: 'generic_spam',
    weight: 0.8,
  },
  {
    id: 'generic_change',
    template: 'change',
    description: 'Single word "change" descriptions',
    category: 'generic_spam',
    weight: 0.8,
  },
  
  // Automated/bot patterns
  {
    id: 'auto_dependency',
    template: 'bump',
    description: 'Dependency bump PRs without context',
    category: 'automated',
    weight: 0.4, // Lower weight as some automated updates are legitimate
  },
  {
    id: 'auto_whitespace',
    template: 'whitespace',
    description: 'Whitespace-only changes',
    category: 'automated',
    weight: 0.6,
  },
  
  // Repository-specific templates - Continue project
  {
    id: 'continue_template_unchanged',
    template: 'what changed feel free to be brief',
    description: 'Continue PR template with placeholder text unchanged',
    category: 'generic_spam',
    weight: 0.95,
  },
  {
    id: 'continue_placeholder_sections',
    template: 'for visual changes include screenshots screen recordings are particularly helpful what tests were added or updated',
    description: 'Continue PR template sections left as placeholders',
    category: 'generic_spam',
    weight: 0.90,
  },
  {
    id: 'continue_empty_checklist',
    template: 'description checklist screenshots tests',
    description: 'Continue PR template with empty sections',
    category: 'generic_spam',
    weight: 0.85,
  },
];

// Templates that should be checked for exact matches (100% similarity)
export const EXACT_MATCH_TEMPLATES = [
  'added my name',
  'update',
  'fix',
  'change',
  'hello world',
  'test',
  'first commit',
  'initial commit',
];

// Regex patterns for common spam characteristics
export const SPAM_PATTERNS = {
  // Very short descriptions with no context
  MINIMAL_EFFORT: /^(update|fix|change|test)\.?$/i,
  
  // Hacktoberfest specific patterns
  HACKTOBERFEST: /hacktoberfest|added?\s+(my\s+)?name|name\s+add(ed)?/i,
  
  // Generic first contribution patterns  
  FIRST_CONTRIB: /first\s+(contribution|commit|pr|pull\s+request)|hello\s+world/i,
  
  // Whitespace only changes
  WHITESPACE_ONLY: /^\s*(whitespace|spaces?|tabs?|formatting)\s*$/i,
  
  // Single character or emoji only
  SINGLE_CHAR: /^.{1,3}$/,
  
  // Common meaningless phrases
  MEANINGLESS: /^(done|finished|complete|ok|good|nice|cool|awesome)\.?$/i,
  
  // Continue project specific placeholder patterns
  CONTINUE_PLACEHOLDERS: /what changed\??\s*feel free to be brief|for visual changes,?\s*include screenshots|what tests were added or updated|screen recordings are particularly helpful/i,
};

export class TemplateDetector {
  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;
    
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return 1 - (matrix[len2][len1] / maxLen);
  }
  
  /**
   * Check if description matches any known spam templates
   */
  detectTemplateMatch(description: string): {
    is_match: boolean;
    template_id?: string;
    similarity_score?: number;
    template?: string;
  } {
    if (!description || description.trim().length === 0) {
      return {
        is_match: true,
        template_id: 'empty_description',
        similarity_score: 1.0,
        template: '',
      };
    }
    
    const normalizedDesc = description.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    const originalNormalized = description.toLowerCase().trim();
    
    // Check regex patterns first (more specific)
    for (const [patternName, pattern] of Object.entries(SPAM_PATTERNS)) {
      if (pattern.test(originalNormalized)) {
        return {
          is_match: true,
          template_id: patternName.toLowerCase(),
          similarity_score: 0.9,
          template: originalNormalized,
        };
      }
    }
    
    // Check exact matches (less specific) - but only for very short descriptions
    if (normalizedDesc.split(' ').length <= 2) {
      for (const template of EXACT_MATCH_TEMPLATES) {
        const normalizedTemplate = template.toLowerCase().replace(/[^\w\s]/g, '');
        if (normalizedDesc === normalizedTemplate) {
          return {
            is_match: true,
            template_id: 'exact_match',
            similarity_score: 1.0,
            template,
          };
        }
      }
    }
    
    // Check template similarity
    for (const template of COMMON_SPAM_TEMPLATES) {
      const similarity = this.calculateSimilarity(normalizedDesc, template.template);
      
      if (similarity >= 0.8) {
        return {
          is_match: true,
          template_id: template.id,
          similarity_score: similarity,
          template: template.template,
        };
      }
    }
    
    return {
      is_match: false,
    };
  }
  
  /**
   * Get all matching templates with their similarity scores
   */
  getAllMatches(description: string): Array<{
    template: SpamTemplate;
    similarity: number;
  }> {
    if (!description) return [];
    
    const normalizedDesc = description.toLowerCase().trim();
    const matches: Array<{ template: SpamTemplate; similarity: number }> = [];
    
    for (const template of COMMON_SPAM_TEMPLATES) {
      const similarity = this.calculateSimilarity(normalizedDesc, template.template);
      
      if (similarity >= 0.5) {
        matches.push({ template, similarity });
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  }
}