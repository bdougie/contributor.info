// Health check endpoint for Inngest
export default async (req: Request) => {
  const url = new URL(req.url);

  // Simple health check response
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Inngest health check',
        timestamp: new Date().toISOString(),
        env: {
          hasEventKey: !!process.env.INNGEST_EVENT_KEY,
          hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
          context: process.env.CONTEXT || 'unknown',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config = {
  path: '/api/inngest/health',
};
