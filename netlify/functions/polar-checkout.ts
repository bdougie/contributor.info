import { Handler } from '@netlify/functions';
import { Checkout } from '@polar-sh/nextjs';

// Create checkout handler
export const handler: Handler = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: `${process.env.BASE_URL}/billing/success?checkout_id={CHECKOUT_ID}`,
  server: (process.env.POLAR_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
});
