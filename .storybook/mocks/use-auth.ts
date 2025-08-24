// Re-export the GitHub auth hook with a simpler name for consistency
// This matches the real implementation structure
export { useGitHubAuth as useAuth } from './use-github-auth';

// Also export the user type if needed
export type { User } from '@supabase/supabase-js';