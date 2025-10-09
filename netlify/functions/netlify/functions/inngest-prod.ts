import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // Redirect to the correct Inngest endpoint at /api/inngest
  const host = event.headers.host || 'contributor.info';
  const protocol = event.headers['x-forwarded-proto'] || 'https';
  const correctEndpoint = `${protocol}://${host}/.netlify/functions/inngest`;

  return {
    statusCode: 301,
    headers: {
      Location: correctEndpoint,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify({
      message: 'This endpoint has been moved. Please update your webhook URL.',
      oldEndpoint: '/.netlify/functions/inngest-prod',
      newEndpoint: '/.netlify/functions/inngest',
      deprecationNotice: 'The inngest-prod endpoint is deprecated. Use /api/inngest instead.',
    }),
  };
};
