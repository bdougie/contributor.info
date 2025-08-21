import { lazy } from "react";

/**
 * Centralized lazy loading for all chart components
 * These components are loaded on-demand to reduce initial bundle size
 */

// Activity Charts
export const LazyContributions = lazy(() => 
  import("../activity/contributions-wrapper")
);

export const LazyPRActivity = lazy(() => 
  import("../activity/pr-activity")
);

// Distribution Charts - Already exist but re-exported for consistency
export { LazyDistributionCharts } from "../distribution/distribution-charts-lazy";
export { LazyDistributionTreemap } from "../distribution/distribution-charts-lazy";

// These components may not exist yet but are prepared for future use
// Removed for now to avoid build errors

// Export chart wrapper component for viewport-based loading
export { LazyChartWrapper } from "@/components/ui/charts/lazy-chart-wrapper";
export { ProgressiveChart } from "@/components/ui/charts/ProgressiveChart";