// Re-export handler from TypeScript module for Netlify Functions compatibility
// Using ES module syntax since package.json has "type": "module"

export const handler = async (event, context) => {
  // Dynamic import of the TypeScript module
  const inngestModule = await import('./inngest-prod.mts');
  const tsHandler = inngestModule.handler || inngestModule.default;
  
  // Convert Netlify event to Request object for the handler
  const url = `https://${event.headers.host}${event.path}`;
  const request = new Request(url, {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body
  });
  
  // Call the handler
  const response = await tsHandler(request, context);
  
  // Convert Response to Netlify's expected format
  const body = await response.text();
  
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: body
  };
};