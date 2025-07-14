import { Button } from "@/components/ui/button";

interface ExampleReposProps {
  onSelect: (repo: string) => void;
}

export function ExampleRepos({ onSelect }: ExampleReposProps) {
  // Prioritized list showcasing size diversity - ordered by demonstration value
  const examples = [
    // Medium repositories - ideal for demos
    "continuedev/continue",    // Medium: AI code assistant (TypeScript) - primary demo
    "argoproj/argo-cd",       // Medium: DevOps tool (Go) - shows enterprise usage
    "pgvector/pgvector",      // Medium: Vector search (C) - AI/ML context
    
    // Large repositories - performance examples
    "vitejs/vite",            // Large: Frontend tooling (TypeScript) - very popular
    "etcd-io/etcd",           // Large: Distributed systems (Go) - infrastructure
    
    // Well-known projects across different sizes
    "better-auth/better-auth", // Medium: Auth framework (TypeScript) - modern tooling
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
