// Re-export the GitHub auth hook with a simpler name for consistency
export { useGitHubAuth as useAuth } from './use-github-auth';

// Also export the user type if needed
export type { User } from '@supabase/supabase-js';
