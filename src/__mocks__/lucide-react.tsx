/**
 * Complete mock for lucide-react icons
 * This provides ALL icons used in the codebase to avoid test failures
 */
import React from 'react';

// Helper function to create icon components
const createIcon = (name: string) => {
  const Icon = React.forwardRef<SVGSVGElement, any>((props, ref) => (
    <svg 
      ref={ref}
      data-testid={`${name}-icon`}
      {...props}
    />
  ));
  Icon.displayName = name;
  return Icon;
};

// Export all icons used in the codebase
export const Activity = createIcon('activity');
export const AlertCircle = createIcon('alert-circle');
export const AlertTriangle = createIcon('alert-triangle');
export const ArrowLeft = createIcon('arrow-left');
export const BarChart3 = createIcon('bar-chart-3');
export const Book = createIcon('book');
export const Bot = createIcon('bot');
export const BotIcon = createIcon('bot-icon');
export const Brain = createIcon('brain');
export const Bug = createIcon('bug');
export const Calendar = createIcon('calendar');
export const CheckCircle = createIcon('check-circle');
export const ChevronDown = createIcon('chevron-down');
export const ChevronLeft = createIcon('chevron-left');
export const ChevronRight = createIcon('chevron-right');
export const Circle = createIcon('circle');
export const Clock = createIcon('clock');
export const Copy = createIcon('copy');
export const Database = createIcon('database');
export const Download = createIcon('download');
export const ExternalLink = createIcon('external-link');
export const File = createIcon('file');
export const FileText = createIcon('file-text');
export const GitBranch = createIcon('git-branch');
export const GitCommit = createIcon('git-commit');
export const Github = createIcon('github');
export const GithubIcon = createIcon('github-icon');
export const GitPullRequest = createIcon('git-pull-request');
export const GitPullRequestDraft = createIcon('git-pull-request-draft');
export const Globe = createIcon('globe');
export const Heart = createIcon('heart');
export const HelpCircle = createIcon('help-circle');
export const Image = createIcon('image');
export const Info = createIcon('info');
export const Lightbulb = createIcon('lightbulb');
export const Link = createIcon('link');
export const Loader2 = createIcon('loader-2');
export const LogIn = createIcon('log-in');
export const LogOut = createIcon('log-out');
export const Mail = createIcon('mail');
export const MessageCircle = createIcon('message-circle');
export const MessageSquare = createIcon('message-square');
export const Minus = createIcon('minus');
export const Moon = createIcon('moon');
export const Package = createIcon('package');
export const PieChart = createIcon('pie-chart');
export const Plus = createIcon('plus');
export const RefreshCw = createIcon('refresh-cw');
export const RotateCcw = createIcon('rotate-ccw');
export const Rss = createIcon('rss');
export const SearchIcon = createIcon('search-icon');
export const Settings = createIcon('settings');
export const Share2 = createIcon('share-2');
export const Shield = createIcon('shield');
export const Smartphone = createIcon('smartphone');
export const Sparkles = createIcon('sparkles');
export const Star = createIcon('star');
export const Sun = createIcon('sun');
export const Target = createIcon('target');
export const Terminal = createIcon('terminal');
export const Trash2 = createIcon('trash-2');
export const TreePine = createIcon('tree-pine');
export const TrendingDown = createIcon('trending-down');
export const TrendingUp = createIcon('trending-up');
export const Trophy = createIcon('trophy');
export const Upload = createIcon('upload');
export const User = createIcon('user');
export const UserCheck = createIcon('user-check');
export const UserPlus = createIcon('user-plus');
export const Users = createIcon('users');
export const X = createIcon('x');
export const XCircle = createIcon('x-circle');
export const Zap = createIcon('zap');

// Default export for any dynamic imports
export default {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Book,
  Bot,
  BotIcon,
  Brain,
  Bug,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  File,
  FileText,
  GitBranch,
  GitCommit,
  Github,
  GithubIcon,
  GitPullRequest,
  GitPullRequestDraft,
  Globe,
  Heart,
  HelpCircle,
  Image,
  Info,
  Lightbulb,
  Link,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Minus,
  Moon,
  Package,
  PieChart,
  Plus,
  RefreshCw,
  RotateCcw,
  Rss,
  SearchIcon,
  Settings,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  Target,
  Terminal,
  Trash2,
  TreePine,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap
};