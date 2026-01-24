import { useState, lazy, Suspense, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExampleRepos } from '@/components/features/repository/example-repos';
import { useNavigate } from 'react-router';
import { SocialMetaTags } from './meta-tags-provider';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import { WorkspaceListFallback } from '@/components/ui/workspace-list-fallback';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAnalytics } from '@/hooks/use-analytics';
import type { GitHubRepository } from '@/lib/github';
import { getSupabase } from '@/lib/supabase-lazy';
import type { User } from '@supabase/supabase-js';

// Lazy load components that are only shown for logged-in users or on interaction
const CarouselLazy = lazy(() => import('@/components/ui/carousel-lazy'));
const WorkspacePreviewCard = lazy(() =>
  import('@/components/features/workspace/WorkspacePreviewCard').then((m) => ({
    default: m.WorkspacePreviewCard,
  }))
);
const WorkspaceOnboarding = lazy(() =>
  import('@/components/features/workspace/WorkspaceOnboarding').then((m) => ({
    default: m.WorkspaceOnboarding,
  }))
);
const WorkspaceCreateModal = lazy(() =>
  import('@/components/features/workspace/WorkspaceCreateModal').then((m) => ({
    default: m.WorkspaceCreateModal,
  }))
);

export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);

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

  useEffect(() => {
    if (isLoggedIn) {
      getSupabase().then((supabase) => {
        supabase.auth.getUser().then(({ data }) => {
          setUser(data.user);
        });
      });
    }
  }, [isLoggedIn]);

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
        image="social-cards/home"
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
            <section data-tour="search-input">
              <GitHubSearchInput
                placeholder="Search repositories (e.g., facebook/react)"
                onSearch={handleSearch}
                onSelect={handleSelectRepository}
                buttonText="Analyze"
                searchLocation="homepage"
                shortcut="/"
              />
            </section>
            <aside>
              <ExampleRepos onSelect={handleSelectExample} />
            </aside>
          </CardContent>
        </Card>

        {isLoggedIn && !authLoading && (
          <Suspense
            fallback={
              <div className="flex gap-4 overflow-x-auto pb-2">
                <WorkspaceListFallback workspaces={[]} />
              </div>
            }
          >
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
                return (
                  <WorkspaceOnboarding onCreateClick={() => setCreateModalOpen(true)} user={user} />
                );
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
          </Suspense>
        )}
      </div>

      {/* Workspace Creation Modal - only render when opened to defer loading */}
      {createModalOpen && (
        <Suspense fallback={null}>
          <WorkspaceCreateModal
            open={createModalOpen}
            onOpenChange={setCreateModalOpen}
            onSuccess={handleCreateWorkspaceSuccess}
          />
        </Suspense>
      )}
    </article>
  );
}
