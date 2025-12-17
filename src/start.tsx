import { createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => ({
  // Enable SSR by default, but allow per-route overrides
  defaultSsr: true,
}))