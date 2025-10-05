/**
 * Event Payload Validation
 * Zod schemas for GitHub event payloads to ensure type safety and prevent crashes
 */

import { z } from 'zod';

// Base schemas for common GitHub objects
const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().url().optional(),
  type: z.string().optional(),
});

const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: GitHubUserSchema,
  stargazers_count: z.number().optional(),
  forks_count: z.number().optional(),
});

// WatchEvent (star) payload schema
export const WatchEventPayloadSchema = z.object({
  action: z.literal('started'),
  repository: GitHubRepositorySchema.optional(),
  sender: GitHubUserSchema.optional(),
});

// ForkEvent payload schema
export const ForkEventPayloadSchema = z.object({
  forkee: GitHubRepositorySchema,
  repository: GitHubRepositorySchema.optional(),
  sender: GitHubUserSchema.optional(),
});

// PullRequestEvent payload schema (subset)
export const PullRequestEventPayloadSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'synchronize', 'edited']),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    user: GitHubUserSchema,
    state: z.enum(['open', 'closed']),
    merged: z.boolean().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: GitHubRepositorySchema.optional(),
  sender: GitHubUserSchema.optional(),
});

// IssuesEvent payload schema (subset)
export const IssuesEventPayloadSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'edited']),
  issue: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    user: GitHubUserSchema,
    state: z.enum(['open', 'closed']),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: GitHubRepositorySchema.optional(),
  sender: GitHubUserSchema.optional(),
});

// Union type for all supported event payloads
type EventPayloadType =
  | z.infer<typeof WatchEventPayloadSchema>
  | z.infer<typeof ForkEventPayloadSchema>
  | z.infer<typeof PullRequestEventPayloadSchema>
  | z.infer<typeof IssuesEventPayloadSchema>;

/**
 * Get the appropriate Zod schema for an event type
 */
export function getSchemaForEventType(eventType: string): z.ZodSchema<EventPayloadType> | null {
  switch (eventType) {
    case 'WatchEvent':
      return WatchEventPayloadSchema;
    case 'ForkEvent':
      return ForkEventPayloadSchema;
    case 'PullRequestEvent':
      return PullRequestEventPayloadSchema;
    case 'IssuesEvent':
      return IssuesEventPayloadSchema;
    default:
      return null;
  }
}

/**
 * Validate event payload against its schema
 * Returns validated data or null if invalid
 */
export function validateEventPayload<T>(
  payload: unknown,
  schema: z.ZodSchema<T>
): { valid: true; data: T } | { valid: false; error: string } {
  try {
    const data = schema.parse(payload);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        valid: false,
        error: `Validation failed: ${errorMessages}`,
      };
    }
    return {
      valid: false,
      error: 'Unknown validation error',
    };
  }
}

/**
 * Safely extract avatar URL from event payload with fallbacks
 */
export function extractAvatarUrl(payload: Record<string, unknown>): string | null {
  // Try different paths where avatar might be
  const sender = payload.sender as Record<string, unknown> | undefined;
  const user = payload.user as Record<string, unknown> | undefined;
  const actor = payload.actor as Record<string, unknown> | undefined;

  const avatarUrl =
    (sender?.avatar_url as string) ||
    (user?.avatar_url as string) ||
    (actor?.avatar_url as string) ||
    null;

  // Validate URL format
  if (avatarUrl && typeof avatarUrl === 'string') {
    try {
      new URL(avatarUrl);
      return avatarUrl;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Safely extract user login from event payload
 */
export function extractUserLogin(payload: Record<string, unknown>): string | null {
  const sender = payload.sender as Record<string, unknown> | undefined;
  const user = payload.user as Record<string, unknown> | undefined;
  const actor = payload.actor as Record<string, unknown> | undefined;

  return (sender?.login as string) || (user?.login as string) || (actor?.login as string) || null;
}
