import { Octokit } from '@octokit/rest';
import * as yaml from 'js-yaml';

export interface ContributorConfig {
  version: number;
  features?: {
    reviewer_suggestions?: boolean;
    similar_issues?: boolean;
    auto_comment?: boolean;
  };
  comment_style?: 'detailed' | 'minimal';
  exclude_authors?: string[];
  exclude_reviewers?: string[];
}

const DEFAULT_CONFIG: ContributorConfig = {
  version: 1,
  features: {
    reviewer_suggestions: true,
    similar_issues: true,
    auto_comment: true,
  },
  comment_style: 'detailed',
  exclude_authors: [],
  exclude_reviewers: [],
};

/**
 * Fetch and parse .contributor configuration file
 */
export async function fetchContributorConfig(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<ContributorConfig> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: '.contributor',
    });

    if ('content' in data && data.type === 'file') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      // Try to parse as YAML first, then JSON
      let config: ContributorConfig;
      try {
        config = yaml.load(content) as ContributorConfig;
      } catch {
        // If YAML parsing fails, try JSON
        config = JSON.parse(content);
      }

      // Validate and merge with defaults
      return validateAndMergeConfig(config);
    }
  } catch (error) {
    // File not found or parse error - use defaults
    console.log('.contributor file not found or invalid, using defaults');
  }

  return DEFAULT_CONFIG;
}

/**
 * Validate config and merge with defaults
 */
function validateAndMergeConfig(config: any): ContributorConfig {
  const validated: ContributorConfig = {
    version: config.version || DEFAULT_CONFIG.version,
    features: {
      ...DEFAULT_CONFIG.features,
      ...config.features,
    },
    comment_style: config.comment_style || DEFAULT_CONFIG.comment_style,
    exclude_authors: Array.isArray(config.exclude_authors) ? config.exclude_authors : [],
    exclude_reviewers: Array.isArray(config.exclude_reviewers) ? config.exclude_reviewers : [],
  };

  // Validate comment_style
  if (!['detailed', 'minimal'].includes(validated.comment_style!)) {
    validated.comment_style = DEFAULT_CONFIG.comment_style;
  }

  return validated;
}

/**
 * Check if a feature is enabled in the config
 */
export function isFeatureEnabled(
  config: ContributorConfig,
  feature: keyof NonNullable<ContributorConfig['features']>
): boolean {
  return config.features?.[feature] !== false;
}

/**
 * Check if a user should be excluded
 */
export function isUserExcluded(
  config: ContributorConfig,
  username: string,
  type: 'author' | 'reviewer'
): boolean {
  const excludeList = type === 'author' ? config.exclude_authors : config.exclude_reviewers;
  return excludeList?.includes(username) || false;
}

/**
 * Create default .contributor file content
 */
export function createDefaultContributorFile(): string {
  const defaultContent = `# Contributor.info Configuration
# Learn more: https://contributor.info/docs/configuration

version: 1

# Enable or disable features
features:
  reviewer_suggestions: true  # Suggest reviewers based on CODEOWNERS and history
  similar_issues: true       # Show related issues on new issues
  auto_comment: true         # Post insights automatically on PRs

# Comment style: "detailed" or "minimal"
comment_style: detailed

# Exclude specific users from features
exclude_authors: []         # Users whose PRs won't get comments
exclude_reviewers: []       # Users who won't be suggested as reviewers

# Examples:
# exclude_authors:
#   - dependabot[bot]
#   - renovate[bot]
# 
# exclude_reviewers:
#   - bot-account
`;

  return defaultContent;
}

/**
 * Generate suggestion comment for missing CODEOWNERS
 */
export function generateCodeOwnersSuggestion(): string {
  return `### 💡 No CODEOWNERS file found

Consider creating a CODEOWNERS file to automatically suggest reviewers for PRs. This helps ensure the right people review changes to specific parts of your codebase.

**Quick start:**
1. Create \`.github/CODEOWNERS\` or \`CODEOWNERS\` in your repository root
2. Add patterns and owners:
   \`\`\`
   # Frontend team owns all TypeScript files
   *.ts @frontend-team
   *.tsx @frontend-team
   
   # Alice owns the auth module
   /src/auth/ @alice
   
   # Bob and Carol own the API
   /api/ @bob @carol
   \`\`\`

[Learn more about CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)`;
}