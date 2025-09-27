/**
 * Type definitions for embeddable widgets
 */

export interface WidgetConfig {
  owner: string;
  repo: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'small' | 'medium' | 'large';
  format?: 'svg' | 'png' | 'html' | 'markdown';
  showLogo?: boolean;
}

export interface StatCardConfig extends WidgetConfig {
  type: 'stat-card';
  metrics?: ('contributors' | 'pull-requests' | 'lottery-factor' | 'merge-rate')[];
}

export interface BadgeConfig extends WidgetConfig {
  type: 'badge';
  style?: 'flat' | 'flat-square' | 'plastic' | 'social';
  label?: string;
  message?: string;
  color?: string;
  metrics?: ('contributors' | 'pull-requests' | 'lottery-factor' | 'merge-rate' | 'activity')[];
}

export interface ChartConfig extends WidgetConfig {
  type: 'chart';
  chartType?: 'activity' | 'contributors' | 'health';
  timeRange?: '7' | '14' | '30' | '90';
}

export interface ComparisonConfig {
  type: 'comparison';
  repositories: string[]; // array of owner/repo strings
  theme?: 'light' | 'dark' | 'auto';
  format?: 'svg' | 'png' | 'html' | 'markdown';
  metric?: 'contributors' | 'activity' | 'health';
}

export type EmbeddableWidgetConfig = StatCardConfig | BadgeConfig | ChartConfig | ComparisonConfig;

export interface WidgetData {
  repository: {
    owner: string;
    repo: string;
    description?: string;
    stars?: number;
    language?: string;
  };
  stats: {
    totalContributors: number;
    totalPRs: number;
    mergedPRs: number;
    mergeRate: number;
    lotteryFactor?: number;
    lotteryRating?: string;
  };
  activity: {
    weeklyPRVolume: number;
    activeContributors: number;
    recentActivity: boolean;
  };
  topContributors: Array<{
    login: string;
    avatar_url: string;
    contributions: number;
  }>;
}

export interface CitationFormat {
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'bibtex' | 'plain';
  includeDate?: boolean;
  includeURL?: boolean;
}

export interface PermalinkConfig {
  type: 'repository' | 'contributor' | 'metric' | 'comparison';
  parameters: Record<string, string | number | boolean>;
  format?: 'json' | 'csv' | 'widget';
}
