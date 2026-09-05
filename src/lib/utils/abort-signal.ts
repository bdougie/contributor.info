/**
 * Abort helpers that work without `AbortSignal.any` or `AbortSignal.timeout`,
 * which older Safari, Firefox, and Chrome releases do not implement.
 */

export interface TimeoutSignal {
  signal: AbortSignal;
  /** Release the timer and the listener on the parent signal once the request settles. */
  release: () => void;
}

/**
 * Build a signal that aborts when the parent aborts or when the timeout elapses.
 */
export function withTimeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number
): TimeoutSignal {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) {
    abortFromParent();
  } else {
    parent?.addEventListener('abort', abortFromParent, { once: true });
  }
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
  }, timeoutMs);
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abortFromParent);
    },
  };
}

/**
 * Run `fetch` under a combined parent and timeout signal, releasing the timer afterwards.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  parent: AbortSignal | undefined,
  timeoutMs: number
): Promise<Response> {
  const timeout = withTimeoutSignal(parent, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: timeout.signal });
  } finally {
    timeout.release();
  }
}
