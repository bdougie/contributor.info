import { createContext, useContext, type ReactNode } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';

interface SocialMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
}

interface MetaTagsContextType {
  setSocialMeta: (meta: SocialMeta) => void;
}

const MetaTagsContext = createContext<MetaTagsContextType | null>(null);

interface MetaTagsProviderProps {
  children: ReactNode;
}

export function MetaTagsProvider({ children }: MetaTagsProviderProps) {
  const setSocialMeta = (_meta: SocialMeta) => {
    // This will be handled by individual components using the Helmet component
    // We keep this context for potential future state management needs
  };

  return (
    <HelmetProvider>
      <MetaTagsContext.Provider value={{ setSocialMeta }}>{children}</MetaTagsContext.Provider>
    </HelmetProvider>
  );
}

export function useSocialMeta() {
  const context = useContext(MetaTagsContext);
  if (!context) {
    throw new Error('useSocialMeta must be used within a MetaTagsProvider');
  }
  return context;
}

interface SocialMetaTagsProps extends SocialMeta {
  siteName?: string;
}

export function SocialMetaTags({
  title = 'contributor.info - Visualizing Open Source Contributions',
  description = 'Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact.',
  image = '/social.webp',
  url,
  type = 'website',
  twitterCard = 'summary_large_image',
  siteName = 'contributor.info',
}: SocialMetaTagsProps) {
  const currentUrl =
    url || (typeof window !== 'undefined' ? window.location.href : 'https://contributor.info');

  // Handle URLs and create proper fallbacks
  let imageUrl = image;
  let fallbackImageUrl = image;

  // Use Fly.io service URL (with fallback to production domain when deployed)
  const socialCardsBaseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://contributor-info-social-cards.fly.dev'
      : 'https://contributor-info-social-cards.fly.dev'; // Always use Fly.io in production

  if (!image.startsWith('http')) {
    // Check if it's a social card path - use Fly.io service for generation
    if (image.includes('social-cards/')) {
      // Extract parameters from image path for dynamic generation
      const isRepoCard = image.includes('repo-');
      const isUserCard = image.includes('user-');

      if (isRepoCard) {
        // For repo cards, try to extract owner/repo from URL
        const urlPath = currentUrl.replace(/^https?:\/\/[^\/]+/, '');
        const pathMatch = urlPath.match(/\/([^\/]+)\/([^\/]+)/);

        if (pathMatch) {
          const [, owner, repo] = pathMatch;
          imageUrl = `${socialCardsBaseUrl}/social-cards/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
        } else {
          imageUrl = `${socialCardsBaseUrl}/social-cards/home`;
        }
      } else if (isUserCard) {
        // For user cards, extract username from URL
        const urlPath = currentUrl.replace(/^https?:\/\/[^\/]+/, '');
        const userMatch = urlPath.match(/\/user\/([^\/]+)/);

        if (userMatch) {
          const [, username] = userMatch;
          imageUrl = `${socialCardsBaseUrl}/social-cards/user?username=${encodeURIComponent(username)}`;
        } else {
          imageUrl = `${socialCardsBaseUrl}/social-cards/home`;
        }
      } else {
        // For home/general cards - use Fly.io service
        imageUrl = `${socialCardsBaseUrl}/social-cards/home`;
      }

      // Use local static fallback as backup
      fallbackImageUrl = `https://contributor.info${image.replace('social-cards/', '/')}`;
    } else {
      imageUrl = `https://contributor.info${image}`;
      fallbackImageUrl = `https://contributor.info${image.replace('.webp', '.png')}`;
    }
  }

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      {/* Fallback image for Open Graph */}
      {fallbackImageUrl !== imageUrl && <meta property="og:image" content={fallbackImageUrl} />}
      <meta property="og:url" content={currentUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      {/* Fallback image for Twitter */}
      {fallbackImageUrl !== imageUrl && <meta name="twitter:image" content={fallbackImageUrl} />}

      {/* Fallback image for older browsers */}
      <link rel="preload" as="image" href={imageUrl} />
      <link rel="preload" as="image" href={fallbackImageUrl} />

      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="canonical" href={currentUrl} />
    </Helmet>
  );
}
