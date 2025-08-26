import { useState, useEffect, useRef } from "react"
import { Terminal, Search, TrendingUp, Clock, Star, GitBranch, AlertTriangle, Loader2, CheckCircle } from '@/components/ui/icon';
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SocialMetaTags } from "./meta-tags-provider";
import { GitHubSearchInput } from "@/components/ui/github-search-input";
import { supabase } from "@/lib/supabase";
import { OrganizationAvatar } from "@/components/ui/organization-avatar";
import { useTimeFormatter } from "@/hooks/use-time-formatter";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepositoryValidation, isRepositoryPath } from "@/hooks/use-repository-validation";

interface Repository {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  github_updated_at: string | null;
}

interface SuggestedUrl {
  path: string;
  score: number;
  reason: string;
}

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCursor, setShowCursor] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [popularRepos, setPopularRepos] = useState<Repository[]>([]);
  const [recentRepos, setRecentRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestedUrls, setSuggestedUrls] = useState<SuggestedUrl[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { formatRelativeTime } = useTimeFormatter();
  
  // Check if the current path looks like a repository
  const pathInfo = isRepositoryPath(location.pathname);
  
  // Use the validation hook if this looks like a repository path
  const validationResult = useRepositoryValidation(
    pathInfo.isRepo ? pathInfo.owner! : null,
    pathInfo.isRepo ? pathInfo.repo! : null,
    {
      autoRedirect: true,
      autoTrack: true,
    }
  );

  // Set focus to the container when component mounts and load data
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
    
    // Load popular and recent repositories
    loadRepositoryData();
    
    // Generate URL suggestions
    generateUrlSuggestions();
    
    // Track 404 occurrence
    track404Occurrence();
    
    // Set proper HTTP status for SEO (only works on server-side rendering)
    if (typeof window !== 'undefined' && window.history) {
      // For client-side, we can at least update the document title to indicate 404
      document.title = '404 - Page Not Found | contributor.info';
    }
  }, [location.pathname]);
  
  // Load repository data from Supabase
  const loadRepositoryData = async () => {
    try {
      // Get popular repositories (by stars)
      const { data: popular } = await supabase
        .from('repositories')
        .select('id, full_name, owner, name, description, language, stargazers_count, forks_count, github_updated_at')
        .eq('is_active', true)
        .eq('is_private', false)
        .order('stargazers_count', { ascending: false })
        .limit(10);
        
      // Get recently updated repositories
      const { data: recent } = await supabase
        .from('repositories')
        .select('id, full_name, owner, name, description, language, stargazers_count, forks_count, github_updated_at')
        .eq('is_active', true)
        .eq('is_private', false)
        .not('github_updated_at', 'is', null)
        .order('github_updated_at', { ascending: false })
        .limit(10);
        
      setPopularRepos(popular || []);
      setRecentRepos(recent || []);
    } catch (_error) {
      console.error('Error loading repository _data:', _error);
      // Fallback to hardcoded examples if database fails
      const fallbackRepos = [
        { id: '1', full_name: 'continuedev/continue', owner: 'continuedev', name: 'continue', description: 'AI code assistant', language: 'TypeScript', stargazers_count: 12500, forks_count: 950, github_updated_at: new Date().toISOString() },
        { id: '2', full_name: 'vitejs/vite', owner: 'vitejs', name: 'vite', description: 'Frontend tooling', language: 'TypeScript', stargazers_count: 65000, forks_count: 5800, github_updated_at: new Date().toISOString() },
        { id: '3', full_name: 'argoproj/argo-cd', owner: 'argoproj', name: 'argo-cd', description: 'GitOps continuous delivery', language: 'Go', stargazers_count: 18000, forks_count: 5500, github_updated_at: new Date().toISOString() }
      ];
      setPopularRepos(fallbackRepos);
      setRecentRepos(fallbackRepos);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate URL suggestions based on current path
  const generateUrlSuggestions = () => {
    const currentPath = location.pathname;
    const suggestions: SuggestedUrl[] = [];
    
    // If it looks like a repository path
    if (currentPath.match(/^\/[^/]+\/[^/]+/)) {
      suggestions.push(
        { path: '/', score: 0.9, reason: 'Try the home page' },
        { path: '/changelog', score: 0.7, reason: 'Check recent updates' },
        { path: '/docs', score: 0.6, reason: 'View documentation' }
      );
    } else {
      suggestions.push(
        { path: '/', score: 0.9, reason: 'Return to home' },
        { path: '/changelog', score: 0.8, reason: 'See what\'s new' }
      );
    }
    
    setSuggestedUrls(suggestions);
  };
  
  // Track 404 occurrence (placeholder for analytics)
  const track404Occurrence = () => {
    // In a real implementation, you would send this to your analytics service
    console.log('404 tracked:', {
      path: location.pathname,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  };

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  // Handle navigation (both keyboard and button)
  const handleNavigation = (path: string = '/') => {
    if (!isRedirecting) {
      setIsRedirecting(true);
      
      // Simulate a brief loading delay before redirecting
      setTimeout(() => {
        navigate(path);
      }, 500);
    }
  };
  
  // Handle repository search
  const handleRepositorySearch = (repository: string) => {
    navigate(`/${repository}`);
  };
  
  // Handle repository selection from popular/recent lists
  const handleRepositorySelect = (repo: Repository) => {
    navigate(`/${repo.full_name}`);
  };
  

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRedirecting) {
      handleNavigation();
    }
  };
  
  // Language color mapping (subset of common languages)
  const languageColors: Record<string, string> = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#FA7343',
    Kotlin: '#A97BFF',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Dart: '#00B4AB',
    Vue: '#41b883',
    Scala: '#c22d40',
    Elixir: '#6e4a7e',
  };
  
  // Render repository item
  const renderRepoItem = (repo: Repository, index: number) => (
    <button
      key={repo.id}
      onClick={() => handleRepositorySelect(repo)}
      className="w-full p-3 text-left hover:bg-accent/50 rounded-md transition-colors group animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center space-x-3">
        <OrganizationAvatar
          src={`https://avatars.githubusercontent.com/${repo.owner}`}
          alt={repo.owner}
          size={24}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
              {repo.full_name}
            </span>
            {repo.language && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: languageColors[repo.language] || '#959da5' }}
                />
                <span>{repo.language}</span>
              </span>
            )}
          </div>
          {repo.description && (
            <div className="text-xs text-muted-foreground truncate mt-1">
              {repo.description}
            </div>
          )}
          <div className="flex items-center space-x-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center space-x-1">
              <Star className="w-3 h-3" />
              <span>{repo.stargazers_count.toLocaleString()}</span>
            </span>
            <span className="flex items-center space-x-1">
              <GitBranch className="w-3 h-3" />
              <span>{repo.forks_count.toLocaleString()}</span>
            </span>
            {repo.github_updated_at && (
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(repo.github_updated_at)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <SocialMetaTags
        title="404 - Page Not Found | contributor.info"
        description="The page you're looking for doesn't exist. Search for repositories, discover popular projects, or explore our documentation."
      />
      
      <div className="w-full max-w-6xl space-y-6">
        {/* Terminal-style error display */}
        <Card className="shadow-lg">
          <div className="bg-muted text-foreground p-2 rounded-t-lg flex items-center border-b">
            <Terminal className="h-4 w-4 mr-2" />
            <div className="text-sm font-mono">contributor.info - Terminal</div>
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
            onKeyDown={handleKeyDown}
            role="region"
            aria-label="404 Not Found Terminal"
          >
            <div 
              className={cn(
                "font-mono text-sm sm:text-base p-4 sm:p-6 bg-card text-card-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-opacity-50",
                "transition-all duration-200"
              )}
            >
              <div className="mb-2 text-muted-foreground">Last login: {new Date().toLocaleString()}</div>
              
              <div className="flex items-start">
                <span className="text-primary mr-2">$</span>
                <div className="flex-1">
                  <span>cd {location.pathname}</span>
                  {showCursor && <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse-subtle"></span>}
                </div>
              </div>
              
              {/* Show validation status for repository paths */}
              {(() => {
                if (pathInfo.isRepo && validationResult.status === 'checking') {
                  return (
                    <div className="mt-4 text-yellow-600">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Checking repository existence...</span>
                      </div>
                      <div className="mt-2 text-sm">
                        Verifying {pathInfo.owner}/{pathInfo.repo} in our database and on GitHub...
                      </div>
                    </div>
                  );
                }
                
                if (pathInfo.isRepo && validationResult.status === 'exists_on_github') {
                  return (
                    <div className="mt-4 text-green-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Repository found on GitHub!</span>
                      </div>
                      <div className="mt-2 text-sm">
                        Adding {pathInfo.owner}/{pathInfo.repo} to our tracking system...
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        You'll be redirected automatically in a moment.
                      </div>
                    </div>
                  );
                }
                
                if (pathInfo.isRepo && validationResult.status === 'exists_in_db') {
                  return (
                    <div className="mt-4 text-green-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Repository found!</span>
                      </div>
                      <div className="mt-2 text-sm">
                        Redirecting to {pathInfo.owner}/{pathInfo.repo}...
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="mt-4 text-destructive">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>fatal: 404 Not Found</span>
                    </div>
                    <div className="mt-2 text-sm">
                      {pathInfo.isRepo && validationResult.status === 'not_found' 
                        ? `Repository '${pathInfo.owner}/${pathInfo.repo}' doesn't exist on GitHub.`
                        : `The path '${location.pathname}' doesn't exist or has been moved.`}
                    </div>
                    {validationResult.suggestion && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {validationResult.suggestion}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {suggestedUrls.length > 0 && (
                <div className="mt-4">
                  <div className="text-muted-foreground text-sm mb-2">Similar paths you might want:</div>
                  <div className="space-y-1">
                    {suggestedUrls.map((url) => (
                      <button
                        key={url.path}
                        onClick={() => handleNavigation(url.path)}
                        className="block w-full text-left text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        → {url.path} <span className="text-muted-foreground">({url.reason})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {isRedirecting && (
                <div className="mt-4 text-yellow-600 animate-pulse">
                  Navigating...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Search and discovery sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Section */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                <h3 className="font-semibold">Find a Repository</h3>
              </div>
            </CardHeader>
            <CardContent>
              <GitHubSearchInput
                placeholder="Search repositories (e.g., facebook/react)"
                onSearch={handleRepositorySearch}
                showButton={false}
              />
            </CardContent>
          </Card>
          
          {/* Popular Projects */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <h3 className="font-semibold">Popular Projects</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loading
? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="p-3 animate-pulse">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-6 w-6 rounded" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                          <div className="flex space-x-3">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
: (
                  popularRepos.slice(0, 5).map(renderRepoItem)
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Recently Updated */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <h3 className="font-semibold">Recently Updated</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loading
? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="p-3 animate-pulse">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-6 w-6 rounded" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                          <div className="flex space-x-3">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
: (
                  recentRepos.slice(0, 5).map(renderRepoItem)
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button 
            onClick={() => handleNavigation('/')} 
            variant="default"
            className="font-mono"
          >
            Return to Home
          </Button>
          <Button 
            onClick={() => handleNavigation('/changelog')} 
            variant="outline"
          >
            What's New
          </Button>
          <Button 
            onClick={() => handleNavigation('/docs')} 
            variant="outline"
          >
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
}