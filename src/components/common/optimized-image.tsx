import React from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  lazy?: boolean;
}

// Check if URL is from Supabase Storage
const isSupabaseUrl = (url: string): boolean => {
  return url.includes('supabase.co/storage/') || url.includes('supabase.com/storage/');
};

// Check if URL is external (not a local file)
const isExternalUrl = (url: string): boolean => {
  return url.startsWith('http://') || url.startsWith('https://');
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  loading,
  sizes,
  width,
  height,
  priority = false,
  lazy = true,
}) => {
  // Handle Supabase Storage URLs and other external URLs
  if (isExternalUrl(src)) {
    // For Supabase Storage, we can use image transformations
    if (isSupabaseUrl(src)) {
      // Supabase Storage supports on-the-fly transformations
      // We can add width parameters to the URL for responsive images
      const getTransformedUrl = (baseUrl: string, targetWidth?: number) => {
        if (!targetWidth) return baseUrl;

        // Add transformation parameters to Supabase Storage URL
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}width=${targetWidth}&quality=80`;
      };

      const srcSet = [
        `${getTransformedUrl(src, 640)} 640w`,
        `${getTransformedUrl(src, 1024)} 1024w`,
        `${getTransformedUrl(src, 1440)} 1440w`,
        `${src} 2048w`,
      ].join(', ');

      return (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
          alt={alt}
          className={className}
          loading={priority ? 'eager' : loading || (lazy ? 'lazy' : 'eager')}
          width={width}
          height={height}
          decoding="async"
        />
      );
    }

    // For other external URLs, just use them as-is
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : loading || (lazy ? 'lazy' : 'eager')}
        width={width}
        height={height}
        decoding="async"
      />
    );
  }

  // For local files, use the optimized WebP versions
  const basePath = src.replace(/\.(png|jpg|jpeg)$/i, '');
  const extension = src.match(/\.(png|jpg|jpeg)$/i)?.[0] || '.png';

  // Build responsive srcset for WebP
  const webpSrcSet = [
    `${basePath}-sm.webp 640w`,
    `${basePath}-md.webp 1024w`,
    `${basePath}-lg.webp 1440w`,
    `${basePath}.webp`,
  ].join(', ');

  // Build responsive srcset for original format
  const originalSrcSet = [
    `${basePath}-sm${extension} 640w`,
    `${basePath}-md${extension} 1024w`,
    `${basePath}-lg${extension} 1440w`,
    `${src}`,
  ].join(', ');

  return (
    <picture>
      {/* WebP source with responsive images */}
      <source
        type="image/webp"
        srcSet={webpSrcSet}
        sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
      />

      {/* Original format source with responsive images */}
      <source
        type={`image/${extension.substring(1)}`}
        srcSet={originalSrcSet}
        sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
      />

      {/* Fallback img tag */}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : loading || (lazy ? 'lazy' : 'eager')}
        width={width}
        height={height}
        decoding="async"
      />
    </picture>
  );
};

// Simple image component for small images that don't need responsive versions
export const SimpleOptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  width,
  height,
  priority = false,
  lazy = true,
}) => {
  // Handle external URLs (including Supabase)
  if (isExternalUrl(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : loading || (lazy ? 'lazy' : 'eager')}
        width={width}
        height={height}
        decoding="async"
      />
    );
  }

  // For local files, use WebP version
  const basePath = src.replace(/\.(png|jpg|jpeg)$/i, '');
  const webpSrc = `${basePath}.webp`;

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : loading || (lazy ? 'lazy' : 'eager')}
        width={width}
        height={height}
        decoding="async"
      />
    </picture>
  );
};
