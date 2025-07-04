import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExampleRepos } from "../../features/repository";
import { useNavigate } from "react-router-dom";
import { SocialMetaTags } from "./meta-tags-provider";
import { GitHubSearchInput } from "@/components/ui/github-search-input";
import type { GitHubRepository } from "@/lib/github";

export default function Home() {
  const navigate = useNavigate();

  const handleSearch = (repositoryPath: string) => {
    // Extract owner and repo from the path
    const match = repositoryPath.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    if (match) {
      const [, owner, repo] = match;
      navigate(`/${owner}/${repo}`);
    }
  };

  const handleSelectRepository = (repository: GitHubRepository) => {
    navigate(`/${repository.full_name}`);
  };

  const handleSelectExample = (repo: string) => {
    handleSearch(repo);
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
          <GitHubSearchInput
            placeholder="Search repositories (e.g., facebook/react)"
            onSearch={handleSearch}
            onSelect={handleSelectRepository}
            buttonText="Analyze"
          />
          <ExampleRepos onSelect={handleSelectExample} />
        </CardContent>
      </Card>
    </div>
  );
}
