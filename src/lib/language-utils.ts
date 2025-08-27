import type { PullRequest } from '@/lib/types';

// Language colors from GitHub
export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Other: '#cccccc',
};

// Helper function to get primary language for a PR
export const getPrimaryLanguage = (pr: PullRequest): { name: string; color: string } => {
  if (pr.commits && pr.commits.length > 0) {
    // Count changes by language
    const languageChanges: Record<string, number> = {};
    pr.commits.forEach((commit) => {
      const lang = commit.language || 'Other';
      languageChanges[lang] = (languageChanges[lang] || 0) + commit.additions + commit.deletions;
    });

    // Find language with most changes
    const primaryLang =
      Object.entries(languageChanges).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Other';

    return {
      name: primaryLang,
      color: LANGUAGE_COLORS[primaryLang] || LANGUAGE_COLORS['Other'],
    };
  }

  // Fallback: infer from PR title
  const titleLower = pr.title.toLowerCase();
  let lang = 'Other';

  if (titleLower.includes('typescript') || titleLower.includes('.ts')) {
    lang = 'TypeScript';
  } else if (titleLower.includes('javascript') || titleLower.includes('.js')) {
    lang = 'JavaScript';
  } else if (titleLower.includes('css') || titleLower.includes('style')) {
    lang = 'CSS';
  } else if (titleLower.includes('html') || titleLower.includes('markup')) {
    lang = 'HTML';
  } else if (titleLower.includes('python') || titleLower.includes('.py')) {
    lang = 'Python';
  } else if (titleLower.includes('java') || titleLower.includes('.java')) {
    lang = 'Java';
  } else if (titleLower.includes('go') || titleLower.includes('.go')) {
    lang = 'Go';
  } else if (titleLower.includes('rust') || titleLower.includes('.rs')) {
    lang = 'Rust';
  }

  return {
    name: lang,
    color: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS['Other'],
  };
};
