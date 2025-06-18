import { Helmet } from 'react-helmet-async';

export function DocsSEO() {
  const title = "User Guide - contributor.info";
  const description = "Learn how to understand and effectively use contributor.info features to analyze repository health, contribution patterns, and team dynamics.";
  const url = "https://contributor.info/docs";

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="contributor.info" />
      <meta property="og:image" content="https://contributor.info/social.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="contributor.info - Open Source Repository Analytics" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="https://contributor.info/social.png" />
      <meta name="twitter:image:alt" content="contributor.info - Open Source Repository Analytics" />
      
      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="contributor.info Team" />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "headline": title,
          "description": description,
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
          "url": url,
          "image": "https://contributor.info/social.png",
          "isPartOf": {
            "@type": "WebSite",
            "name": "contributor.info",
            "url": "https://contributor.info"
          }
        })}
      </script>
    </Helmet>
  );
}