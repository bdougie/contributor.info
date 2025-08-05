/**
 * Consistent dimensions for skeleton components to prevent CLS
 * These dimensions should match the actual content dimensions exactly
 */
export const SKELETON_DIMENSIONS = {
  // Component dimensions
  contributorCard: { width: "w-full", height: "h-24" },
  contributorCardWithRole: { width: "w-full", height: "h-28" },
  metricsCard: { width: "w-full", height: "h-32" },
  chartContainer: { width: "w-full", height: "h-64" },
  searchInput: { width: "w-full", height: "h-10" },
  repoHeader: { width: "w-full", height: "h-16" },
  activityItem: { width: "w-full", height: "h-20" },
  
  // Avatar dimensions (matches optimized avatar sizes)
  avatarSm: { width: "w-8", height: "h-8" },   // 32px
  avatarMd: { width: "w-10", height: "h-10" }, // 40px
  avatarLg: { width: "w-12", height: "h-12" }, // 48px
  avatarXl: { width: "w-16", height: "h-16" }, // 64px
  
  // Tab dimensions
  tabsList: { width: "w-full", height: "h-10" },
  
  // Button dimensions
  buttonSm: { width: "w-20", height: "h-8" },
  buttonMd: { width: "w-24", height: "h-10" },
  buttonLg: { width: "w-32", height: "h-12" },
  
  // Card header dimensions
  cardTitle: { width: "w-3/4", height: "h-6" },
  cardDescription: { width: "w-5/6", height: "h-4" },
  
  // Table row dimensions
  tableRow: { width: "w-full", height: "h-12" },
  
  // Chart legend dimensions
  chartLegend: { width: "w-full", height: "h-8" },
} as const;

export type SkeletonComponent = keyof typeof SKELETON_DIMENSIONS;

/**
 * Get dimensions for a skeleton component
 * Helps ensure consistent sizing to prevent CLS
 */
export function getSkeletonDimensions(component: SkeletonComponent) {
  return SKELETON_DIMENSIONS[component];
}

/**
 * Combine dimension classes with additional classes
 */
export function getSkeletonClasses(
  component: SkeletonComponent,
  additionalClasses?: string
) {
  const dimensions = getSkeletonDimensions(component);
  const baseClasses = `${dimensions.width} ${dimensions.height}`;
  return additionalClasses ? `${baseClasses} ${additionalClasses}` : baseClasses;
}