// Dynamic docs loader - fetches markdown content at runtime instead of bundling
export interface DocsMetadata {
  file: string;
  title: string;
  description: string;
  category: "feature" | "insight";
}

// Just the metadata - small and can be bundled
export const DOCS_METADATA: DocsMetadata[] = [
  // Features
  {
    file: "feature-lottery-factor.md",
    title: "Lottery Factor",
    description: "Understanding repository health and contribution risk",
    category: "feature",
  },
  {
    file: "feature-activity-feed.md",
    title: "Activity Feed",
    description: "Real-time tracking of repository and contributor activity",
    category: "feature",
  },
  {
    file: "feature-authentication.md",
    title: "Authentication",
    description: "User authentication and GitHub integration",
    category: "feature",
  },
  {
    file: "contributor-confidence-guide.md",
    title: "Contributor Confidence",
    description: "Understanding how welcoming your repository is to new contributors",
    category: "feature",
  },
  {
    file: "feature-contribution-analytics.md",
    title: "Contribution Analytics",
    description: "Advanced analytics for measuring contributor impact",
    category: "feature",
  },
  {
    file: "feature-contributor-of-month.md",
    title: "Contributor of the Month",
    description: "Recognition system for outstanding contributors",
    category: "feature",
  },
  {
    file: "feature-hover-cards.md",
    title: "Hover Cards",
    description: "Quick contributor information displayed on hover",
    category: "feature",
  },
  {
    file: "feature-distribution-charts.md",
    title: "Distribution Charts",
    description: "Visual analysis of contribution patterns and trends",
    category: "feature",
  },
  {
    file: "feature-repository-health.md",
    title: "Repository Health",
    description: "Comprehensive health metrics for repositories",
    category: "feature",
  },
  {
    file: "feature-repository-search.md",
    title: "Repository Search",
    description: "Finding and exploring GitHub repositories",
    category: "feature",
  },
  // Insights
  {
    file: "insight-pr-activity.md",
    title: "PR Activity Insights",
    description: "Understanding pull request activity patterns",
    category: "insight",
  },
  {
    file: "insight-repository-health.md",
    title: "Repository Health Insights",
    description: "Deep insights into repository sustainability",
    category: "insight",
  },
  {
    file: "insight-needs-attention.md",
    title: "Needs Attention",
    description: "Identifying areas requiring immediate attention",
    category: "insight",
  },
  {
    file: "insight-recommendations.md",
    title: "Recommendations",
    description: "Data-driven recommendations for improvement",
    category: "insight",
  },
];

// Cache for loaded docs content
const docsCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Dynamically fetch markdown content from the server
 * This keeps the markdown out of the JavaScript bundle
 */
export async function fetchDocsContent(filename: string): Promise<string> {
  // Check cache first
  const cached = docsCache.get(filename);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.content;
  }

  try {
    // In production, use Netlify function for better caching and CDN
    // In development, fetch directly from public directory
    const isProduction = import.meta.env.PROD;
    const url = isProduction 
      ? `/.netlify/functions/docs-content?file=${encodeURIComponent(filename)}`
      : `/docs/${filename}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load documentation: ${response.statusText}`);
    }
    
    const content = await response.text();
    
    // Cache the result
    docsCache.set(filename, {
      content,
      timestamp: Date.now()
    });
    
    return content;
  } catch (error) {
    console.error(`Error loading docs file ${filename}:`, error);
    throw error;
  }
}

/**
 * Load multiple docs files in parallel
 */
export async function fetchAllDocs(): Promise<Map<string, string>> {
  const contentMap = new Map<string, string>();
  
  // Load all docs in parallel for better performance
  const loadPromises = DOCS_METADATA.map(async (doc) => {
    try {
      const content = await fetchDocsContent(doc.file);
      contentMap.set(doc.file, content);
    } catch (error) {
      console.error(`Failed to load ${doc.file}:`, error);
      // Continue loading other docs even if one fails
    }
  });
  
  await Promise.all(loadPromises);
  
  return contentMap;
}

/**
 * Preload docs content in the background
 * Call this after the main app loads to warm the cache
 */
export function preloadDocs() {
  // Use requestIdleCallback if available, otherwise setTimeout
  const schedulePreload = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  
  schedulePreload(() => {
    // Preload the most common docs
    const priorityDocs = [
      'feature-lottery-factor.md',
      'feature-repository-health.md',
      'feature-activity-feed.md'
    ];
    
    priorityDocs.forEach(file => {
      fetchDocsContent(file).catch(() => {
        // Silently fail preloading
      });
    });
  });
}