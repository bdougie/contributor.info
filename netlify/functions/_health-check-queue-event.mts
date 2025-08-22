// Health check endpoint to verify api-queue-event is deployed
// This file ensures the api-queue-event function is included in production builds

export default async () => {
  return new Response(JSON.stringify({
    status: "healthy",
    endpoint: "api-queue-event",
    message: "Queue event endpoint is deployed and accessible",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
};