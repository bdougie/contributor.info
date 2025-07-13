import { Button } from "@/components/ui/button";
import { getAllExampleRepos } from "@/lib/example-repositories";

interface ExampleReposProps {
  onSelect: (repo: string) => void;
}

export function ExampleRepos({ onSelect }: ExampleReposProps) {
  // Get all example repos from the centralized library
  const examples = getAllExampleRepos();

  return (
    <div className="mt-4 w-full">
      <div className="text-sm text-muted-foreground mb-2">
        Popular examples:
      </div>
      <div className="flex flex-wrap gap-2">
        {examples.map((repo) => (
          <Button
            key={repo}
            variant="outline"
            size="sm"
            onClick={() => onSelect(repo)}
            className="text-xs sm:text-sm"
          >
            {repo}
          </Button>
        ))}
      </div>
    </div>
  );
}
