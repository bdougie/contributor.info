/** Scrub capability links even from referrers or breadcrumbs captured after navigation. */
export function redactReviewInviteTokens<T>(event: T): T {
  return JSON.parse(
    JSON.stringify(event, (_key, value) =>
      typeof value === 'string'
        ? value.replace(
            /\/review-labels\/[a-f0-9]{64}\/invite/g,
            '/review-labels/[redacted]/invite'
          )
        : value
    )
  ) as T;
}
