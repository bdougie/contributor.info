import { describe, it, expect } from 'vitest';
import { DEFAULT_TOUR_STEPS, getTourStepsByCategory, getTourStepById } from '../tour-steps';

describe('tour-steps', () => {
  describe('DEFAULT_TOUR_STEPS', () => {
    it('has required properties for each step', () => {
      DEFAULT_TOUR_STEPS.forEach((step) => {
        expect(step.id).toBeDefined();
        expect(typeof step.id).toBe('string');
        expect(step.target).toBeDefined();
        expect(step.content).toBeDefined();
      });
    });

    it('has unique IDs for all steps', () => {
      const ids = DEFAULT_TOUR_STEPS.map((step) => step.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('includes welcome and complete steps', () => {
      const welcomeStep = DEFAULT_TOUR_STEPS.find((s) => s.id === 'welcome');
      const completeStep = DEFAULT_TOUR_STEPS.find((s) => s.id === 'tour-complete');

      expect(welcomeStep).toBeDefined();
      expect(completeStep).toBeDefined();
    });

    it('has categories assigned to steps', () => {
      const stepsWithCategories = DEFAULT_TOUR_STEPS.filter((s) => s.category);
      expect(stepsWithCategories.length).toBeGreaterThan(0);
    });
  });

  describe('getTourStepsByCategory', () => {
    it('filters steps by single category', () => {
      const navigationSteps = getTourStepsByCategory(DEFAULT_TOUR_STEPS, ['navigation']);

      expect(navigationSteps).not.toHaveLength(0);
      navigationSteps.forEach((step) => {
        expect(step.category).toBe('navigation');
      });
    });

    it('filters steps by multiple categories', () => {
      const steps = getTourStepsByCategory(DEFAULT_TOUR_STEPS, ['navigation', 'workspace']);

      expect(steps).not.toHaveLength(0);
      steps.forEach((step) => {
        expect(['navigation', 'workspace']).toContain(step.category);
      });
    });

    it('returns empty array for non-existent category', () => {
      const steps = getTourStepsByCategory(DEFAULT_TOUR_STEPS, ['nonexistent' as never]);
      expect(steps).toHaveLength(0);
    });
  });

  describe('getTourStepById', () => {
    it('returns step by ID', () => {
      const step = getTourStepById(DEFAULT_TOUR_STEPS, 'welcome');

      expect(step).toBeDefined();
      expect(step?.id).toBe('welcome');
    });

    it('returns undefined for non-existent ID', () => {
      const step = getTourStepById(DEFAULT_TOUR_STEPS, 'nonexistent');
      expect(step).toBeUndefined();
    });
  });

  describe('accessibility', () => {
    it('all steps have descriptive content', () => {
      DEFAULT_TOUR_STEPS.forEach((step) => {
        const content = typeof step.content === 'string' ? step.content : '';
        expect(content.length).toBeGreaterThan(20);
      });
    });

    it('steps have valid placement values', () => {
      const validPlacements = [
        'top',
        'top-start',
        'top-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'left',
        'left-start',
        'left-end',
        'right',
        'right-start',
        'right-end',
        'center',
        'auto',
      ];

      DEFAULT_TOUR_STEPS.forEach((step) => {
        if (step.placement) {
          expect(validPlacements).toContain(step.placement);
        }
      });
    });
  });
});
