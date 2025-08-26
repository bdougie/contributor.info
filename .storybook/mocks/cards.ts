// Mock for cards components in Storybook
import { fn } from "@storybook/test";

export const Card = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('div', { className: 'card', ...props }, children);

export const CardContent = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('div', { className: 'card-content', ...props }, children);

export const CardHeader = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('div', { className: 'card-header', ...props }, children);

export const CardTitle = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('h3', { className: 'card-title', ...props }, children);

export const CardDescription = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => 
  globalThis.React.createElement('p', { className: 'card-description', ...props }, children);