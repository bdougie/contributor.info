// Mock for cards components in Storybook
import { fn } from '@storybook/test';

export const Card = ({ children, ...props }: any) =>
  globalThis.React.createElement('div', { className: 'card', ...props }, children);

export const CardContent = ({ children, ...props }: any) =>
  globalThis.React.createElement('div', { className: 'card-content', ...props }, children);

export const CardHeader = ({ children, ...props }: any) =>
  globalThis.React.createElement('div', { className: 'card-header', ...props }, children);

export const CardTitle = ({ children, ...props }: any) =>
  globalThis.React.createElement('h3', { className: 'card-title', ...props }, children);

export const CardDescription = ({ children, ...props }: any) =>
  globalThis.React.createElement('p', { className: 'card-description', ...props }, children);
