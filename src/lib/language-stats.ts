import type { PullRequest, LanguageStats } from '@/lib/types';

/**
 * Generate language statistics from pull requests
 * @param prs - Array of pull requests to analyze
 * @returns Array of language statistics with counts and colors
 */
export function getLanguageStats(prs: PullRequest[]): LanguageStats[] {
  // Create language stats based on the additions/deletions in each PR
  const languageMap = new Map<
    string,
    { count: number; color: string; totalChanges: number }
  >();

  // Common language colors from GitHub
  const colorMap: Record<string, string> = {
    JavaScript: "#f1e05a",
    TypeScript: "#2b7489",
    CSS: "#563d7c",
    HTML: "#e34c26",
    Python: "#3572A5",
    Java: "#b07219",
    Go: "#00ADD8",
    Rust: "#dea584",
    Other: "#cccccc",
  };

  // Count languages based on PRs
  prs.forEach((pr) => {
    if (pr.commits && pr.commits.length > 0) {
      pr.commits.forEach((commit) => {
        const lang = commit.language || "Other";
        const current = languageMap.get(lang) || {
          count: 0,
          color: colorMap[lang] || colorMap["Other"],
          totalChanges: 0,
        };
        languageMap.set(lang, {
          count: current.count + 1,
          color: current.color,
          totalChanges:
            current.totalChanges + commit.additions + commit.deletions,
        });
      });
    } else {
      // For PRs without commit data, infer language from PR title/additions/deletions

      // Try to extract language from PR title
      let lang = "Other";
      const titleLower = pr.title.toLowerCase();

      if (titleLower.includes("typescript") || titleLower.includes(".ts")) {
        lang = "TypeScript";
      } else if (
        titleLower.includes("javascript") ||
        titleLower.includes(".js")
      ) {
        lang = "JavaScript";
      } else if (titleLower.includes("css") || titleLower.includes("style")) {
        lang = "CSS";
      } else if (
        titleLower.includes("html") ||
        titleLower.includes("markup")
      ) {
        lang = "HTML";
      } else if (
        titleLower.includes("python") ||
        titleLower.includes(".py")
      ) {
        lang = "Python";
      } else if (
        titleLower.includes("java") ||
        titleLower.includes(".java")
      ) {
        lang = "Java";
      } else if (titleLower.includes("go") || titleLower.includes(".go")) {
        lang = "Go";
      } else if (titleLower.includes("rust") || titleLower.includes(".rs")) {
        lang = "Rust";
      }

      const size = pr.additions + pr.deletions;

      const current = languageMap.get(lang) || {
        count: 0,
        color: colorMap[lang] || colorMap["Other"],
        totalChanges: 0,
      };

      languageMap.set(lang, {
        count: current.count + 1,
        color: current.color,
        totalChanges: current.totalChanges + size,
      });
    }
  });

  // If we don't have any languages detected (no PRs or all PRs lack language data)
  if (languageMap.size === 0) {
    console.log("No language data found, using placeholder data");
    
    // Only use fallback data if we really have no language data
    if (prs.length === 0) {
      // Use minimal data to indicate there's nothing to display
      return [
        {
          name: "No Data",
          color: "#cccccc",
          count: 0,
        }
      ];
    } else {
      // Show that we're using synthetic data
      return [
        {
          name: "TypeScript (estimated)",
          color: colorMap["TypeScript"],
          count: Math.ceil(prs.length * 0.6),
        },
        {
          name: "JavaScript (estimated)",
          color: colorMap["JavaScript"],
          count: Math.ceil(prs.length * 0.2),
        },
        {
          name: "CSS (estimated)",
          color: colorMap["CSS"],
          count: Math.ceil(prs.length * 0.15),
        },
        {
          name: "HTML (estimated)",
          color: colorMap["HTML"],
          count: Math.ceil(prs.length * 0.05),
        },
      ];
    }
  }

  // Convert the map to array format required by LanguageLegend
  return (
    Array.from(languageMap.entries())
      .map(([name, { count, color, totalChanges }]) => ({
        name,
        count,
        color,
        // Store the total changes to help with sorting
        totalChanges,
      }))
      // Sort by total changes (most significant languages first)
      .sort((a, b) => b.totalChanges - a.totalChanges)
      // Take top 8 languages at most to avoid cluttering the UI
      .slice(0, 8)
      // Remove the totalChanges prop since it's not in the LanguageStats interface
      .map(({ name, count, color }) => ({
        name,
        count,
        color,
      }))
  );
}