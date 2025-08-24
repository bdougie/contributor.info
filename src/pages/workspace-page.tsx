import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, GitFork, Calendar } from '@/components/ui/icon';
import { getRepoOwnerAvatarUrl } from '@/lib/utils/avatar';

interface WorkspaceRepository {
  id: string;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
}

interface WorkspaceData {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  repositories: WorkspaceRepository[];
  member_count: number;
}

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkspace() {
      if (!workspaceId) {
        setError('No workspace ID provided');
        setLoading(false);
        return;
      }

      try {
        // Fetch workspace details
        const { data: workspaceData, error: wsError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .eq('is_active', true)
          .single();

        if (wsError || !workspaceData) {
          setError('Workspace not found');
          setLoading(false);
          return;
        }

        // Fetch repositories
        const { data: repoData, error: repoError } = await supabase
          .from('workspace_repositories')
          .select(`
            repositories (
              id,
              full_name,
              name,
              owner,
              description,
              language,
              stargazers_count,
              forks_count,
              open_issues_count
            )
          `)
          .eq('workspace_id', workspaceId);

        if (repoError) {
          console.error('Error fetching repositories:', repoError);
        }

        // Fetch member count
        const { count: memberCount } = await supabase
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);

        setWorkspace({
          ...workspaceData,
          repositories: repoData?.map(r => r.repositories).filter(Boolean) || [],
          member_count: memberCount || 0
        });
      } catch (err) {
        setError('Failed to load workspace');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspace();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-24 w-full mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Workspace not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{workspace.name}</h1>
        {workspace.description && (
          <p className="text-lg text-muted-foreground">{workspace.description}</p>
        )}
        
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{workspace.member_count} members</span>
          </div>
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{workspace.repositories.length} repositories</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Created {new Date(workspace.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Repositories</h2>
        
        {workspace.repositories.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No repositories added to this workspace yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspace.repositories.map(repo => (
              <Card key={repo.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getRepoOwnerAvatarUrl(repo.owner)}
                        alt={`${repo.owner} avatar`}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <CardTitle className="text-base">
                          <a 
                            href={`/${repo.full_name}`}
                            className="hover:underline"
                          >
                            {repo.name}
                          </a>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{repo.owner}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {repo.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {repo.language && (
                      <Badge variant="secondary">{repo.language}</Badge>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>⭐ {repo.stargazers_count || 0}</span>
                      <span>🍴 {repo.forks_count || 0}</span>
                      <span>🐛 {repo.open_issues_count || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}