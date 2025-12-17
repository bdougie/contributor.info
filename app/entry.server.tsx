import type { EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';
import { renderToReadableStream } from 'react-dom/server';
import { isbot } from 'isbot';

const ABORT_DELAY = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABORT_DELAY);

  try {
    const body = await renderToReadableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        signal: controller.signal,
        onError(error: unknown) {
          // Log errors but don't throw - let streaming continue
          console.error('SSR Render Error:', error);
          responseStatusCode = 500;
        },
      }
    );

    clearTimeout(timeoutId);

    // Set content type
    responseHeaders.set('Content-Type', 'text/html');

    // Add cache headers for static/public pages
    const url = new URL(request.url);
    const isPublicRoute =
      url.pathname === '/' ||
      url.pathname === '/trending' ||
      url.pathname === '/privacy' ||
      url.pathname === '/terms' ||
      url.pathname === '/changelog' ||
      // Repository pages are public
      /^\/[^/]+\/[^/]+$/.test(url.pathname);

    if (isPublicRoute) {
      // Stale-while-revalidate caching for public pages
      responseHeaders.set(
        'Cache-Control',
        'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
      );
    } else {
      // Private pages should not be cached
      responseHeaders.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    }

    // For bots/crawlers, wait for the full render to complete for SEO
    const userAgent = request.headers.get('user-agent') || '';
    if (isbot(userAgent)) {
      await body.allReady;
    }

    return new Response(body, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('SSR Fatal Error:', error);

    // Fallback to client-side rendering on error
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>contributor.info</title></head><body><div id="root"></div></body></html>',
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
