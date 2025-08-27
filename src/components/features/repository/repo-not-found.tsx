import { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal, SearchIcon } from '@/components/ui/icon';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SocialMetaTags } from '@/components/common/layout/meta-tags-provider';
import { ExampleRepos } from './example-repos';
import { useRepoSearch } from '@/hooks/use-repo-search';

export default function RepoNotFound() {
  const { owner, repo } = useParams();
  const [showPrompt, setShowPrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { searchInput, setSearchInput, handleSearch, handleSelectExample } = useRepoSearch({
    isHomeView: false,
  });

  // Memoize computed values to prevent recalculation
  const repoPath = useMemo(() => `${owner}/${repo}`, [owner, repo]);
  const loginTime = useMemo(() => new Date().toLocaleString(), []);
  const metaData = useMemo(
    () => ({
      title: `Repository Not Found: ${repoPath} | contributor.info`,
      description: `The repository ${repoPath} was not found. It may not exist, be private, or you may have mistyped the name. Search for another repository on contributor.info.`,
    }),
    [repoPath]
  );

  // Minimal effect for initialization
  useEffect(() => {
    // Set focus to the container when component mounts
    if (containerRef.current) {
      containerRef.current.focus();
    }

    // Show prompt after a delay
    const promptTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 1500);

    return () => {
      clearTimeout(promptTimer);
    };
  }, []);

  return (
    <div className="container mx-auto py-2">
      <SocialMetaTags title={metaData.title} description={metaData.description} />

      {/* Search Section */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder="Search for a repository (e.g., facebook/react)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" aria-label="Search">
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
          <ExampleRepos onSelect={handleSelectExample} />
        </CardContent>
      </Card>

      {/* Terminal-style 404 */}
      <Card className="shadow-lg">
        {/* Terminal title bar */}
        <div className="bg-muted text-foreground p-2 rounded-t-lg flex items-center border-b">
          <Terminal className="h-4 w-4 mr-2" />
          <div className="text-sm font-mono">contributor.info - Repository Terminal</div>
          <div className="ml-auto flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>

        <CardContent
          className="p-0 overflow-hidden"
          ref={containerRef}
          tabIndex={0}
          role="region"
          aria-label="Repository Not Found Terminal"
        >
          <div
            className={cn(
              'font-mono text-sm sm:text-base p-4 sm:p-6 bg-card text-card-foreground h-[400px]',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-opacity-50',
              'will-change-auto'
            )}
          >
            <div className="mb-2 text-muted-foreground">Last login: {loginTime}</div>

            <div className="flex items-start mb-4">
              <span className="text-primary mr-2">$</span>
              <div className="flex-1">
                <span>git clone https://github.com/{repoPath}.git</span>
                <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse"></span>
              </div>
            </div>

            <div className="space-y-2 text-destructive mb-6">
              <div>fatal: repository not found</div>
              <div>The repository '{repoPath}' does not exist or is not accessible.</div>
              <div className="text-muted-foreground mt-4">This could mean:</div>
              <ul className="text-muted-foreground ml-4 space-y-1">
                <li>• The repository name is misspelled</li>
                <li>• The repository is private</li>
                <li>• The repository has been moved or deleted</li>
                <li>• The owner name is incorrect</li>
              </ul>
            </div>

            <div
              className={cn(
                'text-muted-foreground transition-opacity duration-300',
                showPrompt ? 'opacity-100' : 'opacity-0'
              )}
            >
              Try searching for the repository above, or explore some other examples.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
