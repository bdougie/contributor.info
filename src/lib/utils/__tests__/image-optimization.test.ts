import { describe, it, expect } from 'vitest';
import {
  optimizeGitHubAvatar,
  getOptimalAvatarSize,
  getImageLoadingStrategy,
  createOptimizedImage,
  getOptimizedImageUrls,
  IMAGE_URL_GENERATORS,
} from '../image-optimization';

describe('image-optimization utilities', () => {
  describe('optimizeGitHubAvatar', () => {
    it('adds size parameter to GitHub avatar URL', () => {
      const url = 'https://avatars.githubusercontent.com/u/123456';
      expect(optimizeGitHubAvatar(url, 128)).toBe(`${url}?s=128`);
    });

    it('handles URLs with existing parameters', () => {
      const url = 'https://avatars.githubusercontent.com/u/123456?v=4';
      expect(optimizeGitHubAvatar(url, 128)).toBe(`${url}&s=128`);
    });

    it('returns empty string for empty input', () => {
      expect(optimizeGitHubAvatar('', 128)).toBe('');
    });
  });

  describe('getOptimalAvatarSize', () => {
    it('maps common Tailwind sizes correctly', () => {
      expect(getOptimalAvatarSize('h-8 w-8')).toBe(64);
      expect(getOptimalAvatarSize('h-10 w-10')).toBe(80);
      expect(getOptimalAvatarSize('h-12 w-12')).toBe(96);
      expect(getOptimalAvatarSize('h-16 w-16')).toBe(128);
    });

    it('returns default size for unknown values', () => {
      expect(getOptimalAvatarSize('unknown')).toBe(80);
      expect(getOptimalAvatarSize('')).toBe(80);
    });
  });

  describe('getImageLoadingStrategy', () => {
    it('returns "eager" when priority is true', () => {
      expect(getImageLoadingStrategy(true, false)).toBe('eager');
      expect(getImageLoadingStrategy(true, true)).toBe('eager');
      expect(getImageLoadingStrategy(true)).toBe('eager');
    });

    it('returns "lazy" when priority is false (preserves original behavior)', () => {
      expect(getImageLoadingStrategy(false, true)).toBe('lazy');
      expect(getImageLoadingStrategy(false, false)).toBe('lazy');
      expect(getImageLoadingStrategy(false)).toBe('lazy');
    });

    it('returns "lazy" when priority is undefined (preserves original behavior)', () => {
      expect(getImageLoadingStrategy(undefined, true)).toBe('lazy');
      expect(getImageLoadingStrategy(undefined, false)).toBe('lazy');
      expect(getImageLoadingStrategy()).toBe('lazy');
    });

    it('ignores lazy parameter (preserves original behavior)', () => {
      // The lazy parameter is unused - original was: priority ? 'eager' : 'lazy'
      expect(getImageLoadingStrategy(false, true)).toBe('lazy');
      expect(getImageLoadingStrategy(false, false)).toBe('lazy');
      expect(getImageLoadingStrategy(false, undefined)).toBe('lazy');
    });
  });

  describe('IMAGE_URL_GENERATORS', () => {
    describe('local generator', () => {
      it('generates optimized URLs for local images with dimensions', () => {
        const result = IMAGE_URL_GENERATORS.local('/static/image.jpg', 100, 200);
        expect(result).toEqual({
          webp: '/static/image.jpg?format=webp&quality=80&w=100&h=200',
          fallback: '/static/image.jpg',
          isGitHubAvatar: false,
        });
      });

      it('generates URLs without dimensions when not provided', () => {
        const result = IMAGE_URL_GENERATORS.local('/static/image.jpg');
        expect(result).toEqual({
          webp: '/static/image.jpg?format=webp&quality=80',
          fallback: '/static/image.jpg',
          isGitHubAvatar: false,
        });
      });

      it('generates URLs with only width when height not provided', () => {
        const result = IMAGE_URL_GENERATORS.local('/static/image.jpg', 100);
        expect(result).toEqual({
          webp: '/static/image.jpg?format=webp&quality=80&w=100',
          fallback: '/static/image.jpg',
          isGitHubAvatar: false,
        });
      });
    });

    describe('githubAvatar generator', () => {
      it('generates GitHub avatar URLs with custom size', () => {
        const src = 'https://avatars.githubusercontent.com/u/123456';
        const result = IMAGE_URL_GENERATORS.githubAvatar(src, 120);
        expect(result).toEqual({
          webp: 'https://avatars.githubusercontent.com/u/123456?s=120&v=4',
          fallback: 'https://avatars.githubusercontent.com/u/123456?s=120&v=4',
          isGitHubAvatar: true,
        });
      });

      it('uses default size of 80 when no dimensions provided', () => {
        const src = 'https://avatars.githubusercontent.com/u/123456';
        const result = IMAGE_URL_GENERATORS.githubAvatar(src);
        expect(result).toEqual({
          webp: 'https://avatars.githubusercontent.com/u/123456?s=80&v=4',
          fallback: 'https://avatars.githubusercontent.com/u/123456?s=80&v=4',
          isGitHubAvatar: true,
        });
      });

      it('prefers width over height for size calculation', () => {
        const src = 'https://avatars.githubusercontent.com/u/123456';
        const result = IMAGE_URL_GENERATORS.githubAvatar(src, 100, 200);
        expect(result).toEqual({
          webp: 'https://avatars.githubusercontent.com/u/123456?s=100&v=4',
          fallback: 'https://avatars.githubusercontent.com/u/123456?s=100&v=4',
          isGitHubAvatar: true,
        });
      });
    });

    describe('external generator', () => {
      it('returns URLs as-is for external images', () => {
        const src = 'https://example.com/image.jpg';
        const result = IMAGE_URL_GENERATORS.external(src);
        expect(result).toEqual({
          webp: src,
          fallback: src,
          isGitHubAvatar: false,
        });
      });
    });
  });

  describe('getOptimizedImageUrls', () => {
    it('handles relative paths using local generator', () => {
      const result = getOptimizedImageUrls('/static/image.jpg', 100, 200);
      expect(result.isGitHubAvatar).toBe(false);
      expect(result.webp).toContain('format=webp&quality=80&w=100&h=200');
      expect(result.fallback).toBe('/static/image.jpg');
    });

    it('handles paths starting with ./ as relative', () => {
      const result = getOptimizedImageUrls('./assets/image.jpg');
      expect(result.isGitHubAvatar).toBe(false);
      expect(result.webp).toContain('format=webp&quality=80');
    });

    it('handles GitHub avatar URLs', () => {
      const src = 'https://avatars.githubusercontent.com/u/123456';
      const result = getOptimizedImageUrls(src, 120);
      expect(result.isGitHubAvatar).toBe(true);
      expect(result.webp).toContain('s=120&v=4');
    });

    it('handles external URLs', () => {
      const src = 'https://example.com/image.jpg';
      const result = getOptimizedImageUrls(src);
      expect(result.isGitHubAvatar).toBe(false);
      expect(result.webp).toBe(src);
      expect(result.fallback).toBe(src);
    });

    it('handles protocol-relative URLs', () => {
      const src = '//example.com/image.jpg';
      const result = getOptimizedImageUrls(src);
      expect(result.isGitHubAvatar).toBe(false);
      expect(result.webp).toBe(src);
    });

    it('handles malformed URLs gracefully', () => {
      const src = 'https://[malformed-url';
      const result = getOptimizedImageUrls(src);
      expect(result).toEqual({
        webp: src,
        fallback: src,
        isGitHubAvatar: false,
      });
    });
  });

  describe('createOptimizedImage', () => {
    it('creates WebP path from PNG', () => {
      const result = createOptimizedImage('/assets/image.png', 'Test Image');
      expect(result.webpSrc).toBe('/assets/image.webp');
      expect(result.fallbackSrc).toBe('/assets/image.png');
      expect(result.alt).toBe('Test Image');
    });

    it('creates WebP path from JPG', () => {
      const result = createOptimizedImage('/assets/photo.jpg', 'Photo');
      expect(result.webpSrc).toBe('/assets/photo.webp');
      expect(result.fallbackSrc).toBe('/assets/photo.jpg');
    });

    it('creates WebP path from JPEG', () => {
      const result = createOptimizedImage('/assets/picture.jpeg', 'Picture');
      expect(result.webpSrc).toBe('/assets/picture.webp');
      expect(result.fallbackSrc).toBe('/assets/picture.jpeg');
    });

    it('includes className when provided', () => {
      const result = createOptimizedImage('/image.png', 'Alt', 'custom-class');
      expect(result.className).toBe('custom-class');
    });
  });
});
