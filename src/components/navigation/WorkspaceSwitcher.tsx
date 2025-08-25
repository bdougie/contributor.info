import { useState, useMemo } from 'react';
import { ChevronDown, Plus, Package, Clock, GitBranch } from '@/components/ui/icon';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface WorkspaceSwitcherProps {
  className?: string;
  showFullName?: boolean;
}

export function WorkspaceSwitcher({ className, showFullName = true }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const { activeWorkspace, workspaces, switchWorkspace, isLoading, recentWorkspaces } = useWorkspaceContext();
  const [open, setOpen] = useState(false);

  // Separate recent and other workspaces
  const { recentWorkspacesList, otherWorkspaces } = useMemo(() => {
    const recent = recentWorkspaces
      .map(id => workspaces.find(w => w.id === id))
      .filter((w): w is NonNullable<typeof w> => w !== undefined)
      .slice(0, 5);
    
    const recentIds = new Set(recent.map(w => w.id));
    const others = workspaces.filter(w => !recentIds.has(w.id));
    
    return {
      recentWorkspacesList: recent,
      otherWorkspaces: others,
    };
  }, [workspaces, recentWorkspaces]);

  const handleWorkspaceSelect = async (workspaceId: string) => {
    setOpen(false);
    await switchWorkspace(workspaceId);
  };

  const handleCreateWorkspace = () => {
    setOpen(false);
    navigate('/workspaces/new');
  };

  const getTierBadge = (tier?: string | null) => {
    if (!tier) return null;
    
    const tierColors = {
      free: 'bg-gray-100 text-gray-700',
      pro: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-purple-100 text-purple-700',
    };
    
    return (
      <Badge 
        variant="secondary" 
        className={cn('ml-2 text-xs', tierColors[tier as keyof typeof tierColors] || tierColors.free)}
      >
        {tier}
      </Badge>
    );
  };

  const getRepositoryCount = (workspace: typeof activeWorkspace) => {
    if (!workspace) return 0;
    return workspace.repository_count || workspace.repositories?.length || 0;
  };

  const formatLastAccessed = (date: string | null | undefined) => {
    if (!date) return 'Never';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (!activeWorkspace && !isLoading && workspaces.length === 0) {
    return (
      <Button
        variant="outline"
        onClick={handleCreateWorkspace}
        className={cn('gap-2', className)}
      >
        <Plus className="h-4 w-4" />
        Create Workspace
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn('gap-2 justify-between', className)}
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {showFullName && (
              <span className="truncate max-w-[200px]">
                {activeWorkspace?.name || 'Select Workspace'}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px]">
        {activeWorkspace && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Current Workspace</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {activeWorkspace.description || 'No description'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {recentWorkspacesList.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent Workspaces
              </DropdownMenuLabel>
              {recentWorkspacesList.map(workspace => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace.id)}
                  className={cn(
                    'cursor-pointer',
                    workspace.id === activeWorkspace?.id && 'bg-accent'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium">
                            {workspace.name}
                          </span>
                          {getTierBadge(workspace.tier)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {getRepositoryCount(workspace)} repos
                          </span>
                          <span>•</span>
                          <span>{formatLastAccessed(workspace.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {otherWorkspaces.length > 0 && <DropdownMenuSeparator />}
          </>
        )}

        {otherWorkspaces.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              All Workspaces
            </DropdownMenuLabel>
            {otherWorkspaces.map(workspace => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                className={cn(
                  'cursor-pointer',
                  workspace.id === activeWorkspace?.id && 'bg-accent'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Package className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate font-medium">
                          {workspace.name}
                        </span>
                        {getTierBadge(workspace.tier)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {getRepositoryCount(workspace)} repos
                        </span>
                        <span>•</span>
                        <span>{formatLastAccessed(workspace.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateWorkspace} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Create New Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}