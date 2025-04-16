// filepath: /Users/briandouglas/code/contributor.info/src/components/language-legend.tsx
import type { LanguageStats } from "@/types";

interface LanguageLegendProps {
  languages: LanguageStats[];
}

export function LanguageLegend({ languages }: LanguageLegendProps) {
  const sortedLanguages = [...languages].sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {sortedLanguages.map((lang) => (
        <div key={lang.name} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: lang.color }}
          />
          <span className="text-sm">
            {lang.name} ({lang.count})
          </span>
        </div>
      ))}
      <div className="h-4 border-l border-muted" />
      <div className="flex items-center">
        <span className="w-2 h-2 rounded-full border border-muted" />
        <span className="ml-2 text-sm">Zone markers</span>
      </div>
    </div>
  );
}
