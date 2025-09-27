// Mock for dub utility in Storybook
import { fn } from '@storybook/test';

export const createChartShareUrl = fn().mockResolvedValue(
  'https://open-graph.vercel.app/mock-share'
);

export const getDubConfig = fn().mockReturnValue({ isDev: false });

export const trackClick = fn();
