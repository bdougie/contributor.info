import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExampleRepos } from "../../features/repository";
import { useNavigate } from "react-router-dom";
import { SocialMetaTags } from "./meta-tags-provider";
import { GitHubSearchInput } from "@/components/ui/github-search-input";
import { WorkspacePreviewCard } from "@/components/features/workspace/WorkspacePreviewCard";
import { WorkspaceOnboarding } from "@/components/features/workspace/WorkspaceOnboarding";
import { WorkspaceCreateModal } from "@/components/features/workspace/WorkspaceCreateModal";
import { useAuth } from "@/hooks/use-auth";
import { usePrimaryWorkspace } from "@/hooks/use-user-workspaces";
import type { GitHubRepository } from "@/lib/github";

export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { workspace, hasWorkspace, loading: workspaceLoading, error: workspaceError, refetch: refetchWorkspace } = usePrimaryWorkspace();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleSearch = (repositoryPath: string) => {
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

  const handleCreateWorkspaceSuccess = async () => {
    // Refetch workspace data after creation
    await refetchWorkspace();
  };

  return (
    <article className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <SocialMetaTags
        title="contributor.info - Visualizing Open Source Contributions"
        description="Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact."
        url="https://contributor.info"
        image="social-cards/home-card.webp"
      />
      <div className="w-full max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <h1 className="text-3xl font-bold text-center">
              Analyze GitHub Repository Contributors
            </h1>
            <p className="text-center text-lg mt-2 text-muted-foreground">
              Enter a GitHub repository URL or owner/repo to visualize
              contribution patterns
            </p>
          </CardHeader>
          <CardContent>
            <section>
              <GitHubSearchInput
                placeholder="Search repositories (e.g., facebook/react)"
                onSearch={handleSearch}
                onSelect={handleSelectRepository}
                buttonText="Analyze"
              />
            </section>
            <aside>
              <ExampleRepos onSelect={handleSelectExample} />
            </aside>
          </CardContent>
        </Card>

        {isLoggedIn && !authLoading && (
          <>
            {(() => {
              if (workspaceLoading) {
                return (
                  <WorkspacePreviewCard
                    workspace={{
                      id: '',
                      name: '',
                      slug: '',
                      owner: { id: '', avatar_url: '', display_name: '' },
                      repository_count: 0,
                      member_count: 0,
                      repositories: [],
                      created_at: '',
                    }}
                    loading={true}
                  />
                );
              }
              
              if (workspaceError) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
                      <p className="text-sm text-muted-foreground">Failed to load workspace</p>
                      <Button onClick={refetchWorkspace} variant="outline" size="sm">
                        Retry
                      </Button>
                    </CardContent>
                  </Card>
                );
              }
              
              if (hasWorkspace && workspace) {
                return <WorkspacePreviewCard workspace={workspace} />;
              }
              
              return <WorkspaceOnboarding onCreateClick={() => setCreateModalOpen(true)} />;
            })()}
          </>
        )}
      </div>

      {/* Workspace Creation Modal */}
      <WorkspaceCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateWorkspaceSuccess}
      />
    </article>
  );
}
