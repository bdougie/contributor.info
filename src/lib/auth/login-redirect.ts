/** Normalize return paths before passing them to the router or OAuth storage. */
export function getLoginReturnPath(value: string | null): string {
  if (!value) return '/';
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export function getLoginRoute(returnPath: string): string {
  return `/login?${new URLSearchParams({ redirectTo: getLoginReturnPath(returnPath) })}`;
}
