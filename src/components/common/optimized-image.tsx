import React from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  width?: number;
  height?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  sizes,
  width,
  height
}) => {
  // Remove file extension to build paths
  const basePath = src.replace(/\.(png|jpg|jpeg)$/i, '');
  const extension = src.match(/\.(png|jpg|jpeg)$/i)?.[0] || '.png';
  
  // Build responsive srcset for WebP
  const webpSrcSet = [
    `${basePath}-sm.webp 640w`,
    `${basePath}-md.webp 1024w`,
    `${basePath}-lg.webp 1440w`,
    `${basePath}.webp`
  ].join(', ');
  
  // Build responsive srcset for original format
  const originalSrcSet = [
    `${basePath}-sm${extension} 640w`,
    `${basePath}-md${extension} 1024w`,
    `${basePath}-lg${extension} 1440w`,
    `${src}`
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
        loading={loading}
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
  height
}) => {
  const basePath = src.replace(/\.(png|jpg|jpeg)$/i, '');
  const webpSrc = `${basePath}.webp`;

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        width={width}
        height={height}
        decoding="async"
      />
    </picture>
  );
};