// Mock react-router-dom for Storybook
// This prevents router-related errors when components use useSearchParams, useNavigate, etc.

import React from 'react';

export const useSearchParams = () => {
  const searchParams = new URLSearchParams();
  const setSearchParams = (params: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
    console.log('Storybook: setSearchParams called with:', params);
  };
  
  return [searchParams, setSearchParams] as const;
};

export const useNavigate = () => {
  return (to: string | number, options?: { replace?: boolean; state?: unknown }) => {
    console.log('Storybook: navigate called with:', to, options);
  };
};

export const useLocation = () => {
  return {
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default'
  };
};

export const useParams = () => {
  return {};
};

export const BrowserRouter = ({ children }: { children: React.ReactNode }) => {
  return children;
};

export const MemoryRouter = ({ children }: { children: React.ReactNode }) => {
  return children;
};

export const Link = ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => {
  return React.createElement('a', { href: to, ...props }, children);
};

export const NavLink = ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => {
  return React.createElement('a', { href: to, ...props }, children);
};

export const Outlet = () => {
  return React.createElement('div', null, 'Storybook Outlet Mock');
};