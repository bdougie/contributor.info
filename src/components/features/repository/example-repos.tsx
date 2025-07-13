import { Button } from "@/components/ui/button";

interface ExampleReposProps {
  onSelect: (repo: string) => void;
}

export function ExampleRepos({ onSelect }: ExampleReposProps) {
  // Prioritized list - add new repos here in order of importance
  const examples = [
    // Priority demos
    "continuedev/continue",    // AI code assistant - primary demo
    "vitejs/vite",            // Popular frontend tooling
    "facebook/react",         // Well-known library
    
    // Large scale projects (use with caution)
    "kubernetes/kubernetes",   // Protected from resource exhaustion
    "etcd-io/etcd",           // Distributed systems example
    
    // Add new demo repos here as needed
  ];

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
