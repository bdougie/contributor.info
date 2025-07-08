export default async function handler(req: Request) {
  return new Response('Hello from social cards!', {
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    },
  });
}