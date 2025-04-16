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
  ];

  return (
    <div className="flex gap-2 mt-4">
      {examples.map((example) => (
        <Button
          key={example}
          variant="outline"
          size="sm"
          onClick={() => onSelect(example)}
        >
          {example}
        </Button>
      ))}
    </div>
  );
}
