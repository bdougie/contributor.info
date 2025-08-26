/**
 * Schema.org structured data utilities for contributor.info
 * Provides JSON-LD markup for better search engine understanding
 */

interface ContactPoint {
  '@type': 'ContactPoint';
  contactType: string;
  url: string;
}

export interface Organization {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  description?: string;
  contactPoint?: ContactPoint[];
  foundingDate?: string;
  sameAs?: string[];
}

export interface SoftwareApplication {
  '@context': 'https://schema.org';
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  browserRequirements?: string;
  offers?: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
  author?: Organization;
  datePublished?: string;
  version?: string;
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    ratingCount: string;
  };
}

interface SearchAction {
  '@type': 'SearchAction';
  target: {
    '@type': 'EntryPoint';
    urlTemplate: string;
  };
  'query-input': string;
}

export interface WebSite {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  description?: string;
  potentialAction?: SearchAction;
  publisher?: Organization;
}

/**
 * Get the organization schema for contributor.info
 */
export function getOrganizationSchema(): Organization {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'contributor.info',
    url: 'https://contributor.info',
    logo: 'https://contributor.info/social.webp',
    description: 'Open source platform for visualizing GitHub contributors and their contributions',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        url: 'https://github.com/bdougie/contributor.info/issues',
      },
    ],
    foundingDate: '2024',
    sameAs: ['https://github.com/bdougie/contributor.info', 'https://twitter.com/bdougieYO'],
  };
}

/**
 * Get the software application schema for contributor.info
 */
export function getSoftwareApplicationSchema(): SoftwareApplication {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'contributor.info',
    description:
      'Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact.',
    url: 'https://contributor.info',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Modern browser required.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: getOrganizationSchema(),
    datePublished: '2024',
    version: '1.0',
  };
}

/**
 * Get the website schema with search action for contributor.info
 */
export function getWebSiteSchema(): WebSite {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'contributor.info',
    url: 'https://contributor.info',
    description:
      'Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://contributor.info/{owner}/{repo}',
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: getOrganizationSchema(),
  };
}

/**
 * Generate JSON-LD script tag content for schema markup
 */
export function generateSchemaMarkup(
  schemas: (Organization | SoftwareApplication | WebSite)[],
): string {
  if (schemas.length === 1) {
    return JSON.stringify(schemas[0], null, 0);
  }

  // Multiple schemas - wrap in array
  return JSON.stringify(schemas, null, 0);
}

/**
 * Get all platform-level schemas for the main application
 */
export function getPlatformSchemas(): (Organization | SoftwareApplication | WebSite)[] {
  return [getSoftwareApplicationSchema(), getWebSiteSchema()];
}
