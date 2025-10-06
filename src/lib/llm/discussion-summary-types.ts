/**
 * Type definitions for discussion summary generation
 * Used by LLM service to generate concise, readable summaries of GitHub Discussions
 */

export interface DiscussionData {
  /** Discussion title */
  title: string;

  /** Discussion body/content (markdown) */
  body: string | null;

  /** Category information */
  category?: {
    name: string;
    emoji?: string;
  };

  /** Author information */
  author?: {
    login: string;
  };

  /** Metadata */
  isAnswered?: boolean;
  upvoteCount?: number;
  commentCount?: number;
}

export interface DiscussionSummaryMetadata {
  /** Discussion ID for tracking */
  discussionId: string;

  /** Repository context */
  repository?: {
    owner: string;
    name: string;
  };
}
