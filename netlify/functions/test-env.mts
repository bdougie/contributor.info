import type { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
  const isLocal =
    process.env.NODE_ENV === 'development' ||
    process.env.NETLIFY_DEV === 'true' ||
    process.env.CONTEXT === 'dev' ||
    (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME);

  const environment = {
    NODE_ENV: process.env.NODE_ENV,
    NETLIFY_DEV: process.env.NETLIFY_DEV,
    CONTEXT: process.env.CONTEXT,
    NETLIFY: process.env.NETLIFY,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    isLocal,
    eventKey: isLocal
      ? 'local-dev-key'
      : process.env.INNGEST_PRODUCTION_EVENT_KEY || process.env.INNGEST_EVENT_KEY,
    baseUrl: isLocal ? 'http://127.0.0.1:8288' : 'production',
  };

  return new Response(JSON.stringify(environment, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};