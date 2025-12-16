import {
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
  Star,
  GitFork,
} from '@/components/ui/icon';

export const TYPE_ICONS = {
  pr: GitPullRequest,
  issue: AlertCircle,
  commit: GitCommit,
  review: MessageSquare,
  comment: MessageSquare,
  star: Star,
  fork: GitFork,
};

export const TYPE_COLORS = {
  pr: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  issue: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  commit: 'bg-green-500/10 text-green-700 dark:text-green-400',
  review: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  comment: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  star: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  fork: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
};

export type StatusType = 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';

export const STATUS_COLORS: Record<StatusType, string> = {
  open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  merged: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  closed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
  changes_requested: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};
