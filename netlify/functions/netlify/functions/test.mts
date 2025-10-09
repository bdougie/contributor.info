import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  return new Response("Hello from Netlify Functions!", {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
};

export const config: Config = {
  path: "/api/test"
};