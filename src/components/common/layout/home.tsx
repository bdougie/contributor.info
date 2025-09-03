import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExampleRepos } from '../../features/repository';
import { useNavigate } from 'react-router-dom';
import { SocialMetaTags } from './meta-tags-provider';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import { WorkspacePreviewCard } from '@/components/features/workspace/WorkspacePreviewCard';
import { WorkspaceOnboarding } from '@/components/features/workspace/WorkspaceOnboarding';
import { WorkspaceCreateModal } from '@/components/features/workspace/WorkspaceCreateModal';
import { useAuth } from '@/hooks/use-auth';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import { useAnalytics } from '@/hooks/use-analytics';
import type { GitHubRepository } from '@/lib/github';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const {
    workspaces,
    loading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useUserWorkspaces();
  const hasWorkspaces = workspaces.length > 0;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const {
    trackRepositorySearchInitiated,
    trackRepositorySelectedFromSearch,
    trackWorkspaceCreated,
  } = useAnalytics();

  useEffect(() => {
    if (!carouselApi) return;

    setCurrent(carouselApi.selectedScrollSnap() + 1);

    carouselApi.on('select', () => {
      setCurrent(carouselApi.selectedScrollSnap() + 1);
    });
  }, [carouselApi]);

  const scrollTo = useCallback(
    (index: number) => {
      carouselApi?.scrollTo(index);
    },
    [carouselApi]
  );

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
                <div className="relative">
                  <Carousel
                    setApi={setCarouselApi}
                    className="w-full"
                    opts={{
                      align: 'start',
                      loop: false,
                    }}
                  >
                    <CarouselContent>
                      {workspaces.map((workspace) => (
                        <CarouselItem key={workspace.id}>
                          <WorkspacePreviewCard workspace={workspace} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="-left-12 hidden sm:flex" />
                    <CarouselNext className="-right-12 hidden sm:flex" />
                  </Carousel>
                  {/* Clickable dots indicator */}
                  <div className="flex justify-center mt-4 gap-2">
                    {workspaces.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => scrollTo(index)}
                        className={cn(
                          'h-2 w-2 rounded-full transition-all',
                          current === index + 1
                            ? 'bg-primary w-6'
                            : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                        )}
                        aria-label={`Go to workspace ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
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
