// Mock for icon components in Storybook
import { fn } from "@storybook/test";

export const LotteryIcon = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'lottery-icon', ...props }, '🎲');

export const YoloIcon = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'yolo-icon', ...props }, '🚀');