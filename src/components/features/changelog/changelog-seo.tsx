import { Helmet } from 'react-helmet-async';

interface ChangelogSEOProps {
  version?: string;
  date?: string;
  title?: string;
  description?: string;
}

export function ChangelogSEO({ 
  version, 
  date, 
  title = "Changelog", 
  description = "All notable changes to contributor.info are documented here. Stay up to date with new features, improvements, and bug fixes."
}: ChangelogSEOProps) {
  const pageTitle = version 
    ? `Version ${version} - contributor.info Changelog`
    : `${title} - contributor.info`;
    
  const pageDescription = version && date
    ? `Changes and updates in contributor.info version ${version}, released on ${new Date(date).toLocaleDateString()}.`
    : description;

  const canonicalUrl = version 
    ? `https://contributor.info/changelog#version-${version.replace(/\./g, '-')}`
    : 'https://contributor.info/changelog';

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="contributor.info" />
      <meta property="og:image" content="https://contributor.info/social.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="contributor.info - Open Source Repository Analytics" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content="https://contributor.info/social.png" />
      <meta name="twitter:image:alt" content="contributor.info - Open Source Repository Analytics" />
      
      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="contributor.info Team" />
      
      {/* Structured Data for Article */}
      {version && date && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": pageTitle,
            "description": pageDescription,
            "author": {
              "@type": "Organization",
              "name": "contributor.info Team"
            },
            "publisher": {
              "@type": "Organization",
              "name": "contributor.info",
              "logo": {
                "@type": "ImageObject",
                "url": "https://contributor.info/social.png"
              }
            },
            "datePublished": new Date(date).toISOString(),
            "dateModified": new Date(date).toISOString(),
            "url": canonicalUrl,
            "image": "https://contributor.info/social.png"
          })}
        </script>
      )}
      
      {/* RSS Feed Link */}
      <link 
        rel="alternate" 
        type="application/rss+xml" 
        title="contributor.info Changelog RSS Feed" 
        href="https://contributor.info/changelog-rss.xml" 
      />
    </Helmet>
  );
}