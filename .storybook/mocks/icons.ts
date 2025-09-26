// Mock for icon components in Storybook
import { fn } from '@storybook/test';

export const LotteryIcon = (props: any) =>
  globalThis.React.createElement('div', { className: 'lottery-icon', ...props }, '🎲');

export const YoloIcon = (props: any) =>
  globalThis.React.createElement('div', { className: 'yolo-icon', ...props }, '🚀');
