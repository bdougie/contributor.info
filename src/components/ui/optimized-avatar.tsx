import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { OptimizedAvatarSimple, OptimizedAvatarSimpleProps } from './optimized-avatar-simple';

export interface OptimizedAvatarProps
  extends Omit<OptimizedAvatarSimpleProps, 'renderAvatar' | 'renderImage' | 'renderFallback'> {}

/**
 * Production wrapper for OptimizedAvatar that connects the simple component to real UI dependencies
 *
 * Features:
 * - Lazy loading with intersection observer
 * - Optimized GitHub avatar URLs with size parameters
 * - Proper fallback handling
 * - Aspect ratio preservation to prevent CLS
 * - Priority loading for above-the-fold avatars
 */
export function OptimizedAvatar(props: OptimizedAvatarProps) {
  // Connect to real Avatar components
  const renderAvatar = React.useCallback(
    (avatarProps: {
      ref: React.RefObject<HTMLDivElement>;
      className: string;
      style: React.CSSProperties;
      children: React.ReactNode;
    }) => (
      <Avatar
        ref={avatarProps.ref as any}
        className={avatarProps.className}
        style={avatarProps.style}
      >
        {avatarProps.children}
      </Avatar>
    ),
    []
  );

  const renderImage = React.useCallback(
    (imageProps: {
      src: string;
      alt: string;
      loading: 'eager' | 'lazy';
      width: number;
      height: number;
      onLoad: () => void;
      onError: () => void;
      className: string;
    }) => (
      <AvatarImage
        src={imageProps.src}
        alt={imageProps.alt}
        loading={imageProps.loading}
        width={imageProps.width}
        height={imageProps.height}
        onLoad={imageProps.onLoad}
        onError={imageProps.onError}
        className={imageProps.className}
      />
    ),
    []
  );

  const renderFallback = React.useCallback(
    (fallbackProps: { className: string; children: React.ReactNode }) => (
      <AvatarFallback className={fallbackProps.className}>{fallbackProps.children}</AvatarFallback>
    ),
    []
  );

  return (
    <OptimizedAvatarSimple
      {...props}
      renderAvatar={renderAvatar}
      renderImage={renderImage}
      renderFallback={renderFallback}
    />
  );
}
