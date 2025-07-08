// Spam detection types and interfaces

export interface SpamFlags {
  template_match?: {
    is_match: boolean;
    template_id?: string;
    similarity_score?: number;
  };
  content_quality?: {
    description_length: number;
    has_meaningful_content: boolean;
    quality_score: number;
  };
  account_flags?: {
    account_age_days: number;
    is_new_account: boolean;
    has_profile_data: boolean;
    contribution_history_score: number;
  };
  pr_characteristics?: {
    size_vs_documentation_ratio: number;
    files_changed: number;
    has_context: boolean;
    commit_quality_score: number;
  };
}

export interface SpamDetectionResult {
  spam_score: number; // 0-100
  is_spam: boolean;
  flags: SpamFlags;
  detected_at: string;
  confidence: number; // 0-1
  reasons: string[];
}

export interface PullRequestData {
  id: string;
  title: string;
  body?: string;
  number: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  html_url: string;
  author: {
    id: number;
    login: string;
    created_at?: string;
    public_repos?: number;
    followers?: number;
    following?: number;
    bio?: string;
    company?: string;
    location?: string;
  };
  repository: {
    full_name: string;
  };
}

export interface SpamTemplate {
  id: string;
  template: string;
  description: string;
  category: 'hacktoberfest' | 'first_contribution' | 'generic_spam' | 'automated';
  weight: number;
}

// Spam thresholds configuration
export const SPAM_THRESHOLDS = {
  LEGITIMATE: 25,
  WARNING: 50,
  LIKELY_SPAM: 75,
  DEFINITE_SPAM: 90,
} as const;

// Detection weights for different criteria
export const DETECTION_WEIGHTS = {
  TEMPLATE_MATCH: 0.4,
  CONTENT_QUALITY: 0.3,
  ACCOUNT_PATTERNS: 0.2,
  PR_CHARACTERISTICS: 0.1,
} as const;

// Account age thresholds
export const ACCOUNT_THRESHOLDS = {
  NEW_ACCOUNT_DAYS: 30,
  SUSPICIOUS_ACCOUNT_DAYS: 7,
  MIN_PROFILE_SCORE: 0.3,
} as const;

// Content quality thresholds
export const CONTENT_THRESHOLDS = {
  MIN_DESCRIPTION_LENGTH: 20,
  MEANINGFUL_CONTENT_RATIO: 0.5,
  MAX_TEMPLATE_SIMILARITY: 0.9,
} as const;