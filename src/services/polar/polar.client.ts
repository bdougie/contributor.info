import { Polar } from '@polar-sh/sdk';

// Initialize Polar client
export const polarClient = new Polar({
  accessToken: import.meta.env.POLAR_ACCESS_TOKEN || '',
  server: (import.meta.env.POLAR_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
});

// Export the client and SDK types
export type PolarClient = typeof polarClient;
