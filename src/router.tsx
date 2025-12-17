import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Create the router instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Enable SSR by default, but allow per-route overrides
  defaultSsr: true,
})

// Export getRouter function for TanStack Start
export function getRouter() {
  return router
}