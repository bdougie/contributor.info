import { openAIService } from './openai-service';

/**
 * Abbreviate a map of user bios to a target character length using 4o-mini.
 * Falls back to simple truncation if OpenAI is unavailable.
 *
 * @param bios - Map of username → full bio
 * @param targetLength - Target character count for abbreviated bios
 * @returns Map of username → abbreviated bio
 */
export async function abbreviateBios(
  bios: Map<string, string>,
  targetLength = 35
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (bios.size === 0) return result;

  // Filter out bios that are already short enough
  const needsAbbreviation = new Map<string, string>();
  for (const [username, bio] of bios) {
    if (bio.length <= targetLength) {
      result.set(username, bio);
    } else {
      needsAbbreviation.set(username, bio);
    }
  }

  if (needsAbbreviation.size === 0) return result;

  // Try LLM abbreviation
  if (openAIService.isAvailable()) {
    try {
      const entries = Array.from(needsAbbreviation.entries());
      const biosList = entries.map(([username, bio]) => `${username}: ${bio}`).join('\n');

      const prompt = `Abbreviate each bio to ${targetLength} characters or fewer. Keep the most important info (role, company, key interest). Return ONLY the abbreviated bios in the same order, one per line, in format "username: abbreviated bio". No extra text.

${biosList}`;

      const response = await openAIService.callOpenAI(prompt, 'gpt-4o-mini');

      const lines = response.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        const username = line.slice(0, colonIndex).trim();
        const abbreviatedBio = line.slice(colonIndex + 1).trim();
        if (needsAbbreviation.has(username) && abbreviatedBio) {
          result.set(username, abbreviatedBio);
        }
      }

      // Fall back to truncation for any that weren't returned
      for (const [username, bio] of needsAbbreviation) {
        if (!result.has(username)) {
          result.set(username, truncateBio(bio, targetLength));
        }
      }

      return result;
    } catch {
      // Fall through to truncation
    }
  }

  // Fallback: simple truncation
  for (const [username, bio] of needsAbbreviation) {
    result.set(username, truncateBio(bio, targetLength));
  }

  return result;
}

function truncateBio(bio: string, maxLength: number): string {
  if (bio.length <= maxLength) return bio;
  return bio.slice(0, maxLength - 1).trimEnd() + '\u2026';
}
