import { useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExampleRepos } from '../../features/repository';
import { useNavigate } from 'react-router-dom';
import { SocialMetaTags } from './meta-tags-provider';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import { WorkspacePreviewCard } from '@/components/features/workspace/WorkspacePreviewCard';
import { WorkspaceOnboarding } from '@/components/features/workspace/WorkspaceOnboarding';
import { WorkspaceCreateModal } from '@/components/features/workspace/WorkspaceCreateModal';
import { WorkspaceListFallback } from '@/components/ui/workspace-list-fallback';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAnalytics } from '@/hooks/use-analytics';
import type { GitHubRepository } from '@/lib/github';

const CarouselLazy = lazy(() => import('@/components/ui/carousel-lazy'));

export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const {
    workspaces,
    isLoading: workspaceLoading,
    error: workspaceError,
    retry: refetchWorkspace,
  } = useWorkspaceContext();
  const hasWorkspaces = workspaces.length > 0;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const {
    trackRepositorySearchInitiated,
    trackRepositorySelectedFromSearch,
    trackWorkspaceCreated,
  } = useAnalytics();

  const handleSearch = (repositoryPath: string) => {
    trackRepositorySearchInitiated('homepage', repositoryPath.length);
    const match = repositoryPath.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    if (match) {
      const [, owner, repo] = match;
      trackRepositorySelectedFromSearch('homepage');
      navigate(`/${owner}/${repo}`);
    }
  };

  const handleSelectRepository = (repository: GitHubRepository) => {
    trackRepositorySelectedFromSearch('homepage');
    navigate(`/${repository.full_name}`);
  };

  const handleSelectExample = (repo: string) => {
    trackRepositorySelectedFromSearch('homepage');
    handleSearch(repo);
  };

  const handleCreateWorkspaceSuccess = async () => {
    trackWorkspaceCreated('home');
    // Refetch workspace data after creation
    refetchWorkspace();
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
              Enter a GitHub repository URL or owner/repo to visualize contribution patterns
            </p>
          </CardHeader>
          <CardContent>
            <section>
              <GitHubSearchInput
                placeholder="Search repositories (e.g., facebook/react)"
                onSearch={handleSearch}
                onSelect={handleSelectRepository}
                buttonText="Analyze"
                searchLocation="homepage"
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
                  <div className="flex gap-4 overflow-x-auto pb-2">
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
                  </div>
                );
              }

              if (workspaceError) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
                      <p className="text-sm text-muted-foreground">Failed to load workspaces</p>
                      <Button onClick={refetchWorkspace} variant="outline" size="sm">
                        Retry
                      </Button>
                    </CardContent>
                  </Card>
                );
              }

              if (!hasWorkspaces) {
                return <WorkspaceOnboarding onCreateClick={() => setCreateModalOpen(true)} />;
              }

              if (workspaces.length === 1) {
                return <WorkspacePreviewCard workspace={workspaces[0]} />;
              }

              return (
                <Suspense fallback={<WorkspaceListFallback workspaces={workspaces} />}>
                  <CarouselLazy workspaces={workspaces} />
                </Suspense>
              );
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
