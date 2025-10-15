import React from 'react';
import { cn } from '@/lib/utils';
import type { IconName } from '@/types/icons';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
}

/**
 * Icon component that uses SVG sprites instead of importing individual icons
 * This reduces bundle size from ~100KB (lucide-react) to ~20KB (sprite)
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, className, size = 24, width, height, ...props }, ref) => {
    const iconSize = width || height || size;

    return (
      <svg
        ref={ref}
        width={iconSize}
        height={iconSize}
        className={cn('inline-block', className)}
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        {...props}
      >
        <use href={`#icon-${name}`} xlinkHref={`#icon-${name}`} />
      </svg>
    );
  }
);

Icon.displayName = 'Icon';

// Convenience exports for common icons matching lucide-react API
export const ChevronDown = (props: Omit<IconProps, 'name'>) => (
  <Icon name="chevron-down" {...props} />
);
export const ChevronUp = (props: Omit<IconProps, 'name'>) => <Icon name="chevron-up" {...props} />;
export const ChevronLeft = (props: Omit<IconProps, 'name'>) => (
  <Icon name="chevron-left" {...props} />
);
export const ChevronRight = (props: Omit<IconProps, 'name'>) => (
  <Icon name="chevron-right" {...props} />
);
export const ChevronsUpDown = (props: Omit<IconProps, 'name'>) => (
  <Icon name="chevrons-up-down" {...props} />
);
export const Check = (props: Omit<IconProps, 'name'>) => <Icon name="check" {...props} />;
export const X = (props: Omit<IconProps, 'name'>) => <Icon name="x" {...props} />;
export const Circle = (props: Omit<IconProps, 'name'>) => <Icon name="circle" {...props} />;
export const MoreHorizontal = (props: Omit<IconProps, 'name'>) => (
  <Icon name="more-horizontal" {...props} />
);
export const Minus = (props: Omit<IconProps, 'name'>) => <Icon name="minus" {...props} />;
export const Plus = (props: Omit<IconProps, 'name'>) => <Icon name="plus" {...props} />;
export const GripVertical = (props: Omit<IconProps, 'name'>) => (
  <Icon name="grip-vertical" {...props} />
);

// Export all other icons as named exports for compatibility
export const Activity = (props: Omit<IconProps, 'name'>) => <Icon name="activity" {...props} />;
export const AlertCircle = (props: Omit<IconProps, 'name'>) => (
  <Icon name="alert-circle" {...props} />
);
export const AlertTriangle = (props: Omit<IconProps, 'name'>) => (
  <Icon name="alert-triangle" {...props} />
);
export const ArrowLeft = (props: Omit<IconProps, 'name'>) => <Icon name="arrow-left" {...props} />;
export const ArrowRight = (props: Omit<IconProps, 'name'>) => (
  <Icon name="arrow-right" {...props} />
);
export const Ban = (props: Omit<IconProps, 'name'>) => <Icon name="ban" {...props} />;
export const Bell = (props: Omit<IconProps, 'name'>) => <Icon name="bell" {...props} />;
export const BarChart3 = (props: Omit<IconProps, 'name'>) => <Icon name="bar-chart-3" {...props} />;
export const Book = (props: Omit<IconProps, 'name'>) => <Icon name="book" {...props} />;
export const Bot = (props: Omit<IconProps, 'name'>) => <Icon name="bot" {...props} />;
export const BotIcon = (props: Omit<IconProps, 'name'>) => <Icon name="bot" {...props} />;
export const Brain = (props: Omit<IconProps, 'name'>) => <Icon name="brain" {...props} />;
export const Bug = (props: Omit<IconProps, 'name'>) => <Icon name="bug" {...props} />;
export const Calculator = (props: Omit<IconProps, 'name'>) => <Icon name="calculator" {...props} />;
export const Calendar = (props: Omit<IconProps, 'name'>) => <Icon name="calendar" {...props} />;
export const CheckCircle = (props: Omit<IconProps, 'name'>) => (
  <Icon name="check-circle" {...props} />
);
export const CheckCircle2 = (props: Omit<IconProps, 'name'>) => (
  <Icon name="check-circle-2" {...props} />
);
export const Clock = (props: Omit<IconProps, 'name'>) => <Icon name="clock" {...props} />;
export const Code = (props: Omit<IconProps, 'name'>) => <Icon name="code" {...props} />;
export const Copy = (props: Omit<IconProps, 'name'>) => <Icon name="copy" {...props} />;
export const Crown = (props: Omit<IconProps, 'name'>) => <Icon name="crown" {...props} />;
export const Database = (props: Omit<IconProps, 'name'>) => <Icon name="database" {...props} />;
export const Download = (props: Omit<IconProps, 'name'>) => <Icon name="download" {...props} />;
export const ExternalLink = (props: Omit<IconProps, 'name'>) => (
  <Icon name="external-link" {...props} />
);
export const Eye = (props: Omit<IconProps, 'name'>) => <Icon name="eye" {...props} />;
export const File = (props: Omit<IconProps, 'name'>) => <Icon name="file" {...props} />;
export const FileText = (props: Omit<IconProps, 'name'>) => <Icon name="file-text" {...props} />;
export const Filter = (props: Omit<IconProps, 'name'>) => <Icon name="filter" {...props} />;
export const GitBranch = (props: Omit<IconProps, 'name'>) => <Icon name="git-branch" {...props} />;
export const GitCommit = (props: Omit<IconProps, 'name'>) => <Icon name="git-commit" {...props} />;
export const GitFork = (props: Omit<IconProps, 'name'>) => <Icon name="git-fork" {...props} />;
export const Github = (props: Omit<IconProps, 'name'>) => <Icon name="github" {...props} />;
export const GithubIcon = (props: Omit<IconProps, 'name'>) => <Icon name="github" {...props} />;
export const GitPullRequest = (props: Omit<IconProps, 'name'>) => (
  <Icon name="git-pull-request" {...props} />
);
export const GitPullRequestDraft = (props: Omit<IconProps, 'name'>) => (
  <Icon name="git-pull-request-draft" {...props} />
);
export const Globe = (props: Omit<IconProps, 'name'>) => <Icon name="globe" {...props} />;
export const Heart = (props: Omit<IconProps, 'name'>) => <Icon name="heart" {...props} />;
export const HelpCircle = (props: Omit<IconProps, 'name'>) => (
  <Icon name="help-circle" {...props} />
);
export const Image = (props: Omit<IconProps, 'name'>) => <Icon name="image" {...props} />;
export const Info = (props: Omit<IconProps, 'name'>) => <Icon name="info" {...props} />;
export const Key = (props: Omit<IconProps, 'name'>) => <Icon name="key" {...props} />;
export const Layout = (props: Omit<IconProps, 'name'>) => <Icon name="layout" {...props} />;
export const Lightbulb = (props: Omit<IconProps, 'name'>) => <Icon name="lightbulb" {...props} />;
export const Link = (props: Omit<IconProps, 'name'>) => <Icon name="link" {...props} />;
export const Link2 = (props: Omit<IconProps, 'name'>) => <Icon name="link-2" {...props} />;
export const Loader2 = (props: Omit<IconProps, 'name'>) => <Icon name="loader-2" {...props} />;
export const Lock = (props: Omit<IconProps, 'name'>) => <Icon name="lock" {...props} />;
export const LogIn = (props: Omit<IconProps, 'name'>) => <Icon name="log-in" {...props} />;
export const LogOut = (props: Omit<IconProps, 'name'>) => <Icon name="log-out" {...props} />;
export const Mail = (props: Omit<IconProps, 'name'>) => <Icon name="mail" {...props} />;
export const Menu = (props: Omit<IconProps, 'name'>) => <Icon name="menu" {...props} />;
export const MessageCircle = (props: Omit<IconProps, 'name'>) => (
  <Icon name="message-circle" {...props} />
);
export const MessageSquare = (props: Omit<IconProps, 'name'>) => (
  <Icon name="message-square" {...props} />
);
export const Monitor = (props: Omit<IconProps, 'name'>) => <Icon name="monitor" {...props} />;
export const Moon = (props: Omit<IconProps, 'name'>) => <Icon name="moon" {...props} />;
export const Package = (props: Omit<IconProps, 'name'>) => <Icon name="package" {...props} />;
export const Palette = (props: Omit<IconProps, 'name'>) => <Icon name="palette" {...props} />;
export const Percent = (props: Omit<IconProps, 'name'>) => <Icon name="percent" {...props} />;
export const PieChart = (props: Omit<IconProps, 'name'>) => <Icon name="pie-chart" {...props} />;
export const Play = (props: Omit<IconProps, 'name'>) => <Icon name="play" {...props} />;
export const RefreshCw = (props: Omit<IconProps, 'name'>) => <Icon name="refresh-cw" {...props} />;
export const RotateCcw = (props: Omit<IconProps, 'name'>) => <Icon name="rotate-ccw" {...props} />;
export const Rss = (props: Omit<IconProps, 'name'>) => <Icon name="rss" {...props} />;
export const Search = (props: Omit<IconProps, 'name'>) => <Icon name="search" {...props} />;
export const SearchIcon = (props: Omit<IconProps, 'name'>) => <Icon name="search" {...props} />;
export const Settings = (props: Omit<IconProps, 'name'>) => <Icon name="settings" {...props} />;
export const Share2 = (props: Omit<IconProps, 'name'>) => <Icon name="share-2" {...props} />;
export const Shield = (props: Omit<IconProps, 'name'>) => <Icon name="shield" {...props} />;
export const Smartphone = (props: Omit<IconProps, 'name'>) => <Icon name="smartphone" {...props} />;
export const Sparkles = (props: Omit<IconProps, 'name'>) => <Icon name="sparkles" {...props} />;
export const Star = (props: Omit<IconProps, 'name'>) => <Icon name="star" {...props} />;
export const Sun = (props: Omit<IconProps, 'name'>) => <Icon name="sun" {...props} />;
export const Target = (props: Omit<IconProps, 'name'>) => <Icon name="target" {...props} />;
export const Terminal = (props: Omit<IconProps, 'name'>) => <Icon name="terminal" {...props} />;
export const TestTube = (props: Omit<IconProps, 'name'>) => <Icon name="test-tube" {...props} />;
export const Trash2 = (props: Omit<IconProps, 'name'>) => <Icon name="trash-2" {...props} />;
export const TreePine = (props: Omit<IconProps, 'name'>) => <Icon name="tree-pine" {...props} />;
export const TrendingDown = (props: Omit<IconProps, 'name'>) => (
  <Icon name="trending-down" {...props} />
);
export const TrendingUp = (props: Omit<IconProps, 'name'>) => (
  <Icon name="trending-up" {...props} />
);
export const Trophy = (props: Omit<IconProps, 'name'>) => <Icon name="trophy" {...props} />;
export const Unlock = (props: Omit<IconProps, 'name'>) => <Icon name="unlock" {...props} />;
export const Upload = (props: Omit<IconProps, 'name'>) => <Icon name="upload" {...props} />;
export const User = (props: Omit<IconProps, 'name'>) => <Icon name="user" {...props} />;
export const UserCheck = (props: Omit<IconProps, 'name'>) => <Icon name="user-check" {...props} />;
export const UserPlus = (props: Omit<IconProps, 'name'>) => <Icon name="user-plus" {...props} />;
export const Users = (props: Omit<IconProps, 'name'>) => <Icon name="users" {...props} />;
export const Wifi = (props: Omit<IconProps, 'name'>) => <Icon name="wifi" {...props} />;
export const WifiOff = (props: Omit<IconProps, 'name'>) => <Icon name="wifi-off" {...props} />;
export const XCircle = (props: Omit<IconProps, 'name'>) => <Icon name="x-circle" {...props} />;
export const Zap = (props: Omit<IconProps, 'name'>) => <Icon name="zap" {...props} />;
