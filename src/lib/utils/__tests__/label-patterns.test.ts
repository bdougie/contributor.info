import { describe, it, expect } from 'vitest';
import {
  getLabelsByIndex,
  getPRStateByIndex,
  getRoleByIndex,
  getPriorityByIndex,
} from '../label-patterns';

describe('label-patterns utilities', () => {
  describe('getLabelsByIndex', () => {
    it('returns bug and high-priority labels for index % 3 === 0', () => {
      expect(getLabelsByIndex(0)).toEqual(['bug', 'high-priority']);
      expect(getLabelsByIndex(3)).toEqual(['bug', 'high-priority']);
      expect(getLabelsByIndex(6)).toEqual(['bug', 'high-priority']);
    });

    it('returns enhancement label for index % 2 === 0 (but not % 3 === 0)', () => {
      expect(getLabelsByIndex(2)).toEqual(['enhancement']);
      expect(getLabelsByIndex(4)).toEqual(['enhancement']);
      expect(getLabelsByIndex(8)).toEqual(['enhancement']);
    });

    it('returns empty array for other indices', () => {
      expect(getLabelsByIndex(1)).toEqual([]);
      expect(getLabelsByIndex(5)).toEqual([]);
      expect(getLabelsByIndex(7)).toEqual([]);
    });
  });

  describe('getPRStateByIndex', () => {
    it('returns open for index % 3 === 0', () => {
      expect(getPRStateByIndex(0)).toBe('open');
      expect(getPRStateByIndex(3)).toBe('open');
      expect(getPRStateByIndex(6)).toBe('open');
    });

    it('returns merged for index % 2 === 0 (but not % 3 === 0)', () => {
      expect(getPRStateByIndex(2)).toBe('merged');
      expect(getPRStateByIndex(4)).toBe('merged');
      expect(getPRStateByIndex(8)).toBe('merged');
    });

    it('returns closed for other indices', () => {
      expect(getPRStateByIndex(1)).toBe('closed');
      expect(getPRStateByIndex(5)).toBe('closed');
      expect(getPRStateByIndex(7)).toBe('closed');
    });
  });

  describe('getRoleByIndex', () => {
    it('returns maintainer for index % 4 === 0', () => {
      expect(getRoleByIndex(0)).toBe('maintainer');
      expect(getRoleByIndex(4)).toBe('maintainer');
      expect(getRoleByIndex(8)).toBe('maintainer');
    });

    it('returns contributor for index % 3 === 0 (but not % 4 === 0)', () => {
      expect(getRoleByIndex(3)).toBe('contributor');
      expect(getRoleByIndex(6)).toBe('contributor');
      expect(getRoleByIndex(9)).toBe('contributor');
    });

    it('returns reviewer for index % 2 === 0 (but not % 3 === 0 or % 4 === 0)', () => {
      expect(getRoleByIndex(2)).toBe('reviewer');
      expect(getRoleByIndex(10)).toBe('reviewer');
      expect(getRoleByIndex(14)).toBe('reviewer');
    });

    it('returns user for other indices', () => {
      expect(getRoleByIndex(1)).toBe('user');
      expect(getRoleByIndex(5)).toBe('user');
      expect(getRoleByIndex(7)).toBe('user');
    });
  });

  describe('getPriorityByIndex', () => {
    it('returns high for index % 5 === 0', () => {
      expect(getPriorityByIndex(0)).toBe('high');
      expect(getPriorityByIndex(5)).toBe('high');
      expect(getPriorityByIndex(10)).toBe('high');
    });

    it('returns medium for index % 3 === 0 (but not % 5 === 0)', () => {
      expect(getPriorityByIndex(3)).toBe('medium');
      expect(getPriorityByIndex(6)).toBe('medium');
      expect(getPriorityByIndex(9)).toBe('medium');
    });

    it('returns low for index % 2 === 0 (but not % 3 === 0 or % 5 === 0)', () => {
      expect(getPriorityByIndex(2)).toBe('low');
      expect(getPriorityByIndex(4)).toBe('low');
      expect(getPriorityByIndex(8)).toBe('low');
    });

    it('returns normal for other indices', () => {
      expect(getPriorityByIndex(1)).toBe('normal');
      expect(getPriorityByIndex(7)).toBe('normal');
      expect(getPriorityByIndex(11)).toBe('normal');
    });
  });
});
