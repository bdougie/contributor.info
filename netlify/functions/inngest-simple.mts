// Simple Inngest function for Netlify
import { Inngest } from 'inngest';
import { serve } from 'inngest/lambda';

// Detect development environment
const isDevelopment = () => {
  const nodeEnv = process.env.NODE_ENV;
  const netlifyContext = process.env.CONTEXT;

  // Explicitly check for production context
  if (netlifyContext === 'production' || nodeEnv === 'production') {
    return false;
  }

  // Default to development for safety
  return nodeEnv !== 'production';
};

// Get event key safely
const getEventKey = () => {
  const eventKey = process.env.INNGEST_EVENT_KEY;

  // In production, ensure we have a real key
  if (!isDevelopment() && (!eventKey || eventKey === 'dev-key')) {
    console.warn('[Inngest] Production environment detected but no valid event key found');
  }

  return eventKey || 'dev-key';
};

// Get signing key for production
const getSigningKey = () => {
  const signingKey = process.env.INNGEST_SIGNING_KEY;

  // In production, we need a signing key
  if (!isDevelopment() && !signingKey) {
    console.warn('[Inngest] Production environment detected but no signing key found');
  }

  return signingKey;
};

// Create Inngest client with secure environment variables
const inngest = new Inngest({
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: isDevelopment(),
  eventKey: getEventKey(),
  signingKey: getSigningKey(),
});

// Simple test function
const testFunction = inngest.createFunction(
  { id: 'test-function' },
  { event: 'test/hello' },
  async ({ event, step }) => {
    console.log('Test function executed!', event);
    return { message: 'Hello from Inngest!', timestamp: new Date().toISOString() };
  }
);

// Create and export the Netlify handler using modern format
export const handler = serve({
  client: inngest,
  functions: [testFunction],
  servePath: '/.netlify/functions/inngest-simple',
});

// Also export a default handler for GET requests
export default async (req: Request) => {
  // If it's a GET request to the root, show a simple status page
  if (req.method === 'GET' && !req.url.includes('?')) {
    return new Response(
      JSON.stringify({
        message: 'Inngest endpoint is running',
        path: '/.netlify/functions/inngest-simple',
        functions: ['test-function'],
        isDev: isDevelopment(),
        hasKeys: {
          eventKey: !!getEventKey(),
          signingKey: !!getSigningKey(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Otherwise, pass to the Inngest handler
  return handler(req);
};
