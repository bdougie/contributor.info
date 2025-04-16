import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchIcon } from "lucide-react";
import { ExampleRepos } from "./example-repos";

export default function Home() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Extract owner and repo from input
    // Supports both full URLs and owner/repo format
    const match = repoUrl.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

    if (match) {
      const [, owner, repo] = match;
      navigate(`/${owner}/${repo}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
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
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input
              placeholder="e.g., etcd-io/etcd or https://github.com/etcd-io/etcd"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <SearchIcon className="mr-2 h-4 w-4" />
              Analyze
            </Button>
          </form>
          <ExampleRepos onSelect={setRepoUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
