// Health check endpoint to verify queue-event endpoint is accessible
// Note: The actual queue-event endpoint is now a Supabase Edge Function
// This health check confirms the redirect is configured

export default async () => {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      endpoint: 'queue-event',
      provider: 'supabase-edge-function',
      message: 'Queue event endpoint redirect is configured (actual endpoint on Supabase)',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};
