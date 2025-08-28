import { describe, it, expect } from 'vitest';
import {
  getFormErrorContent,
  getCarouselOrientation,
  getHoverOpacity,
  getHoverFilter,
  CAROUSEL_ORIENTATION_MAP,
} from '../component-state';

describe('component-state utilities', () => {
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
