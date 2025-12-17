/**
 * Extract issue/PR references from text.
 * Matches:
 * - #123 (but not owner/repo#123)
 * - owner/repo#123
 * - https://github.com/owner/repo/issues/123
 * - https://github.com/owner/repo/pull/123
 */
export function extractLinkedItems(
  text: string
): { owner?: string; repo?: string; number: number }[] {
  const links: { owner?: string; repo?: string; number: number }[] = [];

  // Regex for owner/repo#123
  // Use length limits to prevent ReDoS: GitHub usernames max 39 chars, repo names max 100 chars
  // First char must be alphanumeric per GitHub rules, allow dots/underscores/hyphens after
  const repoRefRegex =
    /([a-zA-Z0-9][a-zA-Z0-9._-]{0,38})\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,99})#(\d+)/g;
  let match;
  while ((match = repoRefRegex.exec(text)) !== null) {
    links.push({ owner: match[1], repo: match[2], number: parseInt(match[3], 10) });
  }

  // Regex for full URLs
  // Use length limits to prevent ReDoS: GitHub usernames max 39 chars, repo names max 100 chars
  const urlRegex =
    /https:\/\/github\.com\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,38})\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,99})\/(issues|pull)\/(\d+)/g;
  while ((match = urlRegex.exec(text)) !== null) {
    links.push({ owner: match[1], repo: match[2], number: parseInt(match[4], 10) });
  }

  // Regex for #123
  // Use negative lookbehind to ensure it's not preceded by a slash or alphanumeric character (which would imply repo/owner)
  const shortRefRegex = /(?<![\w.-])#(\d+)/g;
  while ((match = shortRefRegex.exec(text)) !== null) {
    links.push({ number: parseInt(match[1], 10) });
  }

  // Deduplicate
  const uniqueLinks = links.filter(
    (link, index, self) =>
      index ===
      self.findIndex(
        (l) => l.number === link.number && l.owner === link.owner && l.repo === link.repo
      )
  );

  return uniqueLinks;
}
