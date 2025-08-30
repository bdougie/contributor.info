import { Helmet } from 'react-helmet-async';
import { TrendingPage } from '@/components/features/trending';
import { useTrendingRepositories } from '@/hooks/use-trending-repositories';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from '@/components/ui/icon';
import { useAnalytics } from '@/hooks/use-analytics';
import { useEffect } from 'react';

export function TrendingPageRoute() {
  const { repositories, loading, error, refetch } = useTrendingRepositories();
  const { trackTrendingPageInteraction } = useAnalytics();

  // Track page view
  useEffect(() => {
    trackTrendingPageInteraction('viewed');
  }, [trackTrendingPageInteraction]);

  return (
    <>
      <Helmet>
        <title>Trending Repositories - Contributor.info</title>
        <meta
          name="description"
          content="Discover trending repositories with significant recent activity and growth. Find the hottest GitHub projects based on stars, PRs, and contributor metrics."
        />
        <meta property="og:title" content="Trending Repositories - Contributor.info" />
        <meta
          property="og:description"
          content="Discover trending repositories with significant recent activity and growth."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://contributor.info/trending" />

        {/* Schema.org markup for trending repositories */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Trending Repositories',
            description:
              'Discover trending repositories with significant recent activity and growth',
            url: 'https://contributor.info/trending',
            mainEntity: {
              '@type': 'ItemList',
              name: 'Trending GitHub Repositories',
              description:
                'A curated list of trending GitHub repositories based on recent activity metrics',
              numberOfItems: repositories.length,
            },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {error && (
          <div className="container mx-auto px-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <button onClick={refetch} className="ml-4 text-sm underline hover:no-underline">
                  Try again
                </button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <TrendingPage repositories={repositories} loading={loading} />
      </div>
    </>
  );
}
