import { Button } from "@/components/ui/button";

interface ExampleReposProps {
  onSelect: (repo: string) => void;
}

export function ExampleRepos({ onSelect }: ExampleReposProps) {
  const examples = [
    "kubernetes/kubernetes",
    "facebook/react",
    "etcd-io/etcd",
    "argoproj/argo-cd",
    "bdougie/contributor.info",
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-4 w-full">
      {examples.map((example) => (
        <Button
          key={example}
          variant="outline"
          size="sm"
          onClick={() => onSelect(example)}
          className="text-xs sm:text-sm"
        >
          {example}
        </Button>
      ))}
    </div>
  );
}
