// Simple test function to verify Netlify functions work
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Netlify function is working!',
      method: event.httpMethod,
      path: event.path,
      timestamp: new Date().toISOString(),
    }),
  };
};