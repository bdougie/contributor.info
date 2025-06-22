import { lazy } from "react";

// Lazy load heavy chart components
export const LazyDistributionCharts = lazy(() => 
  import("./distribution-charts")
);

export const LazyDistributionTreemap = lazy(() =>
  import("./distribution-treemap-enhanced").then(module => ({
    default: module.DistributionTreemapEnhanced
  }))
);