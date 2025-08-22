/**
 * FAQ Sitemap Generator - Adds FAQ pages to sitemap for SEO
 * Generates structured sitemap entries for repository FAQ pages
 */

import { supabase } from '../supabase';

export interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

export interface FAQSitemapEntry extends SitemapEntry {
  repositoryName: string;
  questionCount: number;
}

/**
 * Generate sitemap entries for repository FAQ pages
 */
export async function generateFAQSitemapEntries(limit: number = 100): Promise<FAQSitemapEntry[]> {
  try {
    // Get active repositories with recent activity
    const { data: repositories, error } = await supabase
      .from('repositories')
      .select('id, full_name, updated_at, pull_requests(count)')
      .not('full_name', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    if (!repositories || repositories.length === 0) {
      return [];
    }

    const faqEntries: FAQSitemapEntry[] = repositories
      .filter(repo => repo.full_name) // Ensure valid repository names
      .map(repo => {
        const [owner, repoName] = repo.full_name.split('/');
        const baseUrl = 'https://contributor.info';
        
        return {
          url: `${baseUrl}/${owner}/${repoName}/faq`,
          lastModified: new Date(repo.updated_at).toISOString().split('T')[0],
          changeFrequency: 'weekly' as const,
          priority: 0.6, // Medium priority for FAQ pages
          repositoryName: repo.full_name,
          questionCount: 7 // Default FAQ question count
        };
      });

    return faqEntries;
  } catch (error) {
    console.error('Failed to generate FAQ sitemap entries:', error);
    return [];
  }
}

/**
 * Generate XML sitemap content for FAQ pages
 */
export function generateFAQSitemapXML(entries: FAQSitemapEntry[]): string {
  const xmlEntries = entries.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
    <lastmod>${entry.lastModified}</lastmod>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  
  <!-- Repository FAQ Pages -->
${xmlEntries}

</urlset>`;
}

/**
 * Get FAQ-specific structured data for a repository
 */
export function generateFAQStructuredData(
  owner: string,
  repo: string,
  faqs: Array<{ question: string; answer: string }>
): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    })),
    "about": {
      "@type": "SoftwareApplication",
      "name": `${owner}/${repo}`,
      "applicationCategory": "DeveloperApplication",
      "url": `https://github.com/${owner}/${repo}`
    }
  };
}

/**
 * Update main sitemap to include FAQ entries
 */
export async function updateMainSitemapWithFAQs(): Promise<boolean> {
  try {
    const faqEntries = await generateFAQSitemapEntries(50); // Top 50 repositories
    
    if (faqEntries.length === 0) {
      return false;
    }

    // Read current sitemap (this would typically be done server-side)
    // For now, we'll just return the entries for manual integration
    console.log('Generated %s FAQ sitemap entries', faqEntries.length);
    
    return true;
  } catch (error) {
    console.error('Failed to update main sitemap with FAQs:', error);
    return false;
  }
}

/**
 * Generate FAQ breadcrumb structured data
 */
export function generateFAQBreadcrumbs(owner: string, repo: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://contributor.info"
      },
      {
        "@type": "ListItem", 
        "position": 2,
        "name": owner,
        "item": `https://contributor.info/${owner}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": repo,
        "item": `https://contributor.info/${owner}/${repo}`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": "FAQ",
        "item": `https://contributor.info/${owner}/${repo}/faq`
      }
    ]
  };
}

/**
 * Calculate FAQ page priority based on repository activity
 */
export function calculateFAQPriority(
  pullRequestCount: number,
  lastUpdated: string,
  isPopularRepo: boolean
): number {
  let priority = 0.5; // Base priority

  // Boost for active repositories
  if (pullRequestCount > 100) priority += 0.2;
  else if (pullRequestCount > 50) priority += 0.1;

  // Boost for recently updated repositories  
  const daysSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) priority += 0.1;
  else if (daysSinceUpdate < 90) priority += 0.05;

  // Boost for popular repositories
  if (isPopularRepo) priority += 0.15;

  return Math.min(priority, 0.9); // Cap at 0.9
}

// Export for browser console access during development
if (typeof window !== 'undefined') {
  (window as any).faqSitemapGenerator = {
    generateFAQSitemapEntries,
    generateFAQSitemapXML,
    generateFAQStructuredData,
    updateMainSitemapWithFAQs
  };
}