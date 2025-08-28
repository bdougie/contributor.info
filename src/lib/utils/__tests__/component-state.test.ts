import { describe, it, expect } from 'vitest';
import {
  getImageLoadingStrategy,
  getOptimizedImageUrls,
  getFormErrorContent,
  getCarouselOrientation,
  getHoverOpacity,
  getHoverFilter,
  IMAGE_URL_GENERATORS,
  CAROUSEL_ORIENTATION_MAP,
} from '../component-state';

describe('component-state utilities', () => {
  describe('getImageLoadingStrategy', () => {
    it('returns "eager" when priority is true', () => {
      expect(getImageLoadingStrategy(true, false)).toBe('eager');
      expect(getImageLoadingStrategy(true, true)).toBe('eager');
      expect(getImageLoadingStrategy(true)).toBe('eager');
    });

    it('returns "lazy" when priority is false and lazy is true', () => {
      expect(getImageLoadingStrategy(false, true)).toBe('lazy');
    });

    it('returns "eager" when both priority and lazy are false', () => {
      expect(getImageLoadingStrategy(false, false)).toBe('eager');
    });

    it('returns "eager" as default when only lazy is undefined', () => {
      expect(getImageLoadingStrategy(false)).toBe('eager');
    });

    it('handles undefined values correctly', () => {
      expect(getImageLoadingStrategy(undefined, true)).toBe('lazy');
      expect(getImageLoadingStrategy(undefined, false)).toBe('eager');
      expect(getImageLoadingStrategy()).toBe('eager');
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

  describe('getFormErrorContent', () => {
    it('returns error message when error has message', () => {
      const error = { message: 'Field is required' };
      const children = 'Default content';
      expect(getFormErrorContent(error, children)).toBe('Field is required');
    });

    it('returns children when error has no message', () => {
      const error = {};
      const children = 'Default content';
      expect(getFormErrorContent(error, children)).toBe(children);
    });

    it('returns children when error is undefined', () => {
      const children = 'Default content';
      expect(getFormErrorContent(undefined, children)).toBe(children);
    });

    it('returns children when no arguments provided', () => {
      expect(getFormErrorContent()).toBeUndefined();
    });

    it('handles error message that is empty string', () => {
      const error = { message: '' };
      const children = 'Default content';
      expect(getFormErrorContent(error, children)).toBe(children);
    });

    it('handles error message that is null', () => {
      const error = { message: null as string | null };
      const children = 'Default content';
      expect(getFormErrorContent(error, children)).toBe(children);
    });
  });

  describe('getCarouselOrientation', () => {
    it('returns explicit orientation when provided', () => {
      expect(getCarouselOrientation('vertical')).toBe('vertical');
      expect(getCarouselOrientation('horizontal')).toBe('horizontal');
    });

    it('treats non-vertical orientations as horizontal', () => {
      expect(getCarouselOrientation('invalid')).toBe('horizontal');
    });

    it('returns vertical when opts.axis is "y"', () => {
      expect(getCarouselOrientation(undefined, { axis: 'y' })).toBe('vertical');
    });

    it('returns horizontal as default', () => {
      expect(getCarouselOrientation()).toBe('horizontal');
      expect(getCarouselOrientation(undefined, {})).toBe('horizontal');
      expect(getCarouselOrientation(undefined, { axis: 'x' })).toBe('horizontal');
    });

    it('prioritizes explicit orientation over opts.axis', () => {
      expect(getCarouselOrientation('horizontal', { axis: 'y' })).toBe('horizontal');
      expect(getCarouselOrientation('vertical', { axis: 'x' })).toBe('vertical');
    });
  });

  describe('CAROUSEL_ORIENTATION_MAP', () => {
    it('has correct mappings', () => {
      expect(CAROUSEL_ORIENTATION_MAP.y).toBe('vertical');
      expect(CAROUSEL_ORIENTATION_MAP.vertical).toBe('vertical');
      expect(CAROUSEL_ORIENTATION_MAP.default).toBe('horizontal');
    });
  });

  describe('getHoverOpacity', () => {
    it('returns 1 when not a quadrant', () => {
      expect(getHoverOpacity(false, true)).toBe(1);
      expect(getHoverOpacity(false, false)).toBe(1);
    });

    it('returns appropriate opacity for quadrants', () => {
      expect(getHoverOpacity(true, true)).toBe(1);
      expect(getHoverOpacity(true, false)).toBe(0.92);
    });
  });

  describe('getHoverFilter', () => {
    it('returns "none" when not a quadrant or not hovered', () => {
      expect(getHoverFilter(false, true)).toBe('none');
      expect(getHoverFilter(false, false)).toBe('none');
      expect(getHoverFilter(true, false)).toBe('none');
    });

    it('returns brightness filter when quadrant is hovered', () => {
      expect(getHoverFilter(true, true)).toBe('brightness(1.1)');
    });
  });
});
