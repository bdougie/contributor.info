// Mock for shareable-card component in Storybook
import { fn } from "@storybook/test";

export const ShareableCard = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('div', { className: 'shareable-card', ...props }, children);