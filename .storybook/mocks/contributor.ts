// Mock for contributor components in Storybook
import { fn } from "@storybook/test";

export const ContributorHoverCard = ({ trigger, children, ...props }: { trigger: React.ReactNode; children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('div', { className: 'contributor-hover-card', ...props }, trigger, children);