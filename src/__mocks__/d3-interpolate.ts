// Mock d3-interpolate to prevent ES module issues
import { vi } from 'vitest';

type InterpolatableValue = string | number | boolean | null | object;

export const interpolate = vi.fn(
  <T extends InterpolatableValue>(_a: T, b: T) =>
    () =>
      b
);
export const interpolateNumber = vi.fn((_a: number, b: number) => () => b);
export const interpolateString = vi.fn((_a: string, b: string) => () => b);
export const interpolateRgb = vi.fn(() => () => 'rgb(0,0,0)');
export const interpolateHsl = vi.fn(() => () => 'hsl(0,0%,0%)');
export const interpolateArray = vi.fn(
  <T>(_a: T[], b: T[]) =>
    () =>
      b
);
export const interpolateObject = vi.fn(<T extends Record<string, unknown>>(_a: T, b: T) => () => ({
  ...b,
}));

export default {
  interpolate,
  interpolateNumber,
  interpolateString,
  interpolateRgb,
  interpolateHsl,
  interpolateArray,
  interpolateObject,
};
