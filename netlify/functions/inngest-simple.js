// Simple Inngest function for Netlify
const { Inngest } = require("inngest");
const { serve } = require("inngest/lambda");

// Create Inngest client with environment variables
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: process.env.INNGEST_DEV === '1' ? true : false,
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  env: process.env.INNGEST_ENV,
});

// Simple test function
const testFunction = inngest.createFunction(
  { id: "test-function" },
  { event: "test/hello" },
  async ({ event, step }) => {
    console.log("Test function executed!", event);
    return { message: "Hello from Inngest!", timestamp: new Date().toISOString() };
  }
);

// Create and export the Netlify handler
module.exports.handler = serve({
  client: inngest,
  functions: [testFunction],
});