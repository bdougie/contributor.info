// Mock for contributor components in Storybook
import { fn } from '@storybook/test';

export const ContributorHoverCard = ({ trigger, children, ...props }: any) =>
  globalThis.React.createElement(
    'div',
    { className: 'contributor-hover-card', ...props },
    trigger,
    children
  );
