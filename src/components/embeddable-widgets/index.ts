// Export all embeddable widget components and utilities
export { StatCard } from './stat-card';
export { BadgeGenerator, generateBadgeURL, generateBadgeMarkdown } from './badge-generator';
export { CitationGenerator } from './citation-generator';
export { WidgetGallery } from './widget-gallery';

// Export types
export type {
  WidgetConfig,
  StatCardConfig,
  BadgeConfig,
  ChartConfig,
  ComparisonConfig,
  EmbeddableWidgetConfig,
  WidgetData,
  CitationFormat,
  PermalinkConfig
} from './widget-types';