import type { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  return new Response(
    JSON.stringify({
      message: 'Test reviewer suggestions endpoint is working',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};

export const config = {
  path: '/api/repos/:owner/:repo/test-reviewers',
};
