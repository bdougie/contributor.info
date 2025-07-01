import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExampleRepos } from "../../features/repository";
import { UnifiedRepoSearch } from "../../search/unified-repo-search";
import { SocialMetaTags } from "./meta-tags-provider";

export default function Home() {
  const handleSelectExample = (repo: string) => {
    // The unified search component will handle navigation internally
    // But we can still provide this for the ExampleRepos component
    const match = repo.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    if (match) {
      const [, owner, repoName] = match;
      // Navigate directly since home view doesn't require auth
      window.location.href = `/${owner}/${repoName}`;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <SocialMetaTags
        title="contributor.info - Visualizing Open Source Contributions"
        description="Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact."
        url="https://contributor.info"
        image="social-cards/home-card.webp"
      />
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Analyze GitHub Repository Contributors
          </CardTitle>
          <CardDescription className="text-center text-lg mt-2">
            Enter a GitHub repository URL or owner/repo to visualize
            contribution patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnifiedRepoSearch
            isHomeView={true}
            placeholder="e.g., etcd-io/etcd or https://github.com/etcd-io/etcd"
            buttonText="Analyze"
          />
          <ExampleRepos onSelect={handleSelectExample} />
        </CardContent>
      </Card>
    </div>
  );
}
