import { lazy } from "react";

/**
 * Lazy loading for heavy admin components to reduce initial bundle size
 * These components are only loaded when accessed by admin users
 */

// Core admin components
export const LazyAdminMenu = lazy(() => 
  import("./admin-menu").then(m => ({ default: m.AdminMenu }))
);

export const LazyUserManagement = lazy(() => 
  import("./user-management").then(m => ({ default: m.UserManagement }))
);

export const LazySpamManagement = lazy(() => 
  import("./spam-management").then(m => ({ default: m.SpamManagement }))
);

export const LazySpamTestTool = lazy(() => 
  import("./spam-test-tool").then(m => ({ default: m.SpamTestTool }))
);

export const LazyBulkSpamAnalysis = lazy(() => 
  import("./bulk-spam-analysis").then(m => ({ default: m.BulkSpamAnalysis }))
);

export const LazyMaintainerManagement = lazy(() => 
  import("./maintainer-management").then(m => ({ default: m.MaintainerManagement }))
);

// Analytics and monitoring components
export const LazyConfidenceAnalyticsDashboard = lazy(() => 
  import("./confidence-analytics-dashboard").then(m => ({ default: m.ConfidenceAnalyticsDashboard }))
);

export const LazyAdminAnalyticsDashboard = lazy(() => 
  import("./admin-analytics-dashboard").then(m => ({ default: m.AdminAnalyticsDashboard }))
);