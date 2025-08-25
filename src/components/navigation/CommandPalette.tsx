import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  Package, 
  GitBranch, 
  Plus,
  Settings,
  TrendingUp,
  Clock,
  Star,
  Code,
  FileText,
  Layout,
} from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { getWorkspaceUrl } from '@/lib/workspace-utils';
import type { Workspace } from '@/contexts/WorkspaceContext';

// Types
interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workspaces?: Workspace[];
  repositories?: Repository[];
  recentItems?: RecentItem[];
  defaultSearchQuery?: string;
}

interface Repository {
  owner: string;
  name: string;
  full_name: string;
  stars?: number;
  language?: string;
  description?: string;
}

interface RecentItem {
  type: 'workspace' | 'repository' | 'action';
  id: string;
  name: string;
  icon?: string;
}

interface CommandItemMetadata {
  tier?: string | null;
  updated_at?: string | null;
  stars?: number;
  language?: string | null;
}

interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'workspace' | 'repository' | 'action' | 'navigation' | 'recent';
  metadata?: CommandItemMetadata;
}

export function CommandPalette({
  open = false,
  onOpenChange = () => {},
  workspaces = [],
  repositories = [],
  recentItems = [],
  defaultSearchQuery = '',
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState(defaultSearchQuery);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Parse search query for filters
  const { query, filter } = useMemo(() => {
    const trimmedSearch = search.trim();
    
    // Check for filter prefixes (case-insensitive for prefix, preserve case for query)
    if (trimmedSearch.toLowerCase().startsWith('workspace:') || trimmedSearch.toLowerCase().startsWith('w:')) {
      const prefix = trimmedSearch.match(/^(workspace:|w:)/i)?.[0] || '';
      return { 
        query: trimmedSearch.slice(prefix.length).trim().toLowerCase(),
        filter: 'workspace' 
      };
    }
    
    if (trimmedSearch.toLowerCase().startsWith('repo:') || trimmedSearch.toLowerCase().startsWith('r:')) {
      const prefix = trimmedSearch.match(/^(repo:|r:)/i)?.[0] || '';
      return { 
        query: trimmedSearch.slice(prefix.length).trim().toLowerCase(),
        filter: 'repository' 
      };
    }
    
    if (trimmedSearch.startsWith('>')) {
      return { 
        query: trimmedSearch.slice(1).trim().toLowerCase(),
        filter: 'action' 
      };
    }
    
    return { query: trimmedSearch.toLowerCase(), filter: null };
  }, [search]);

  // Build command items
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Add workspace commands
    workspaces.forEach(workspace => {
      items.push({
        id: `workspace-${workspace.id}`,
        name: workspace.name,
        description: workspace.description || `${workspace.repositories?.length || 0} repositories`,
        icon: <Package className="h-4 w-4" />,
        action: () => {
          const url = getWorkspaceUrl(workspace);
          navigate(url);
          onOpenChange(false);
        },
        category: 'workspace',
        metadata: { tier: workspace.tier, updated_at: workspace.updated_at },
      });
    });

    // Add repository commands
    repositories.forEach(repo => {
      items.push({
        id: `repo-${repo.full_name}`,
        name: repo.full_name,
        description: repo.description || `${repo.language || 'Unknown'} • ${formatStars(repo.stars || 0)} stars`,
        icon: <GitBranch className="h-4 w-4" />,
        action: () => {
          navigate(`/${repo.full_name}`);
          onOpenChange(false);
        },
        category: 'repository',
        metadata: { stars: repo.stars, language: repo.language },
      });
    });

    // Add action commands
    items.push(
      {
        id: 'action-create-workspace',
        name: 'Create New Workspace',
        description: 'Set up a new workspace',
        icon: <Plus className="h-4 w-4" />,
        shortcut: '⌘⇧W',
        action: () => {
          navigate('/');
          // TODO: Open create workspace modal
          onOpenChange(false);
        },
        category: 'action',
      },
        {
          id: 'action-trending',
          name: 'View Trending Repositories',
          description: 'Discover popular repositories',
          icon: <TrendingUp className="h-4 w-4" />,
          action: () => {
            navigate('/trending');
            onOpenChange(false);
          },
          category: 'action',
        },
        {
          id: 'action-settings',
          name: 'Open Settings',
          description: 'Configure your preferences',
          icon: <Settings className="h-4 w-4" />,
          shortcut: '⌘,',
          action: () => {
            navigate('/settings');
            onOpenChange(false);
          },
          category: 'action',
        },
        {
          id: 'action-docs',
          name: 'View Documentation',
          description: 'Learn how to use contributor.info',
          icon: <FileText className="h-4 w-4" />,
          action: () => {
            navigate('/docs');
            onOpenChange(false);
          },
          category: 'action',
        },
        {
          id: 'action-home',
          name: 'Go to Home',
          description: 'Return to the homepage',
          icon: <Layout className="h-4 w-4" />,
          action: () => {
            navigate('/');
            onOpenChange(false);
          },
          category: 'action',
        }
    );

    return items;
  }, [workspaces, repositories, navigate, onOpenChange]);

  // Filter commands based on search query and category filter
  const filteredCommands = useMemo(() => {
    let filtered = commands;
    
    // First filter by category if a filter is active
    if (filter) {
      filtered = commands.filter(cmd => cmd.category === filter);
    }
    
    // Then filter by search query if present
    if (query) {
      filtered = filtered.filter(cmd => {
        const searchableText = `${cmd.name} ${cmd.description || ''}`.toLowerCase();
        return searchableText.includes(query);
      });
    }
    
    return filtered;
  }, [commands, query, filter]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      recent: [],
      workspace: [],
      repository: [],
      action: [],
    };

    // Add recent items if no search query
    if (!query && recentItems.length > 0) {
      recentItems.slice(0, 5).forEach(item => {
        const command = commands.find(cmd => 
          (item.type === 'workspace' && cmd.id === `workspace-${item.id}`) ||
          (item.type === 'repository' && cmd.id === `repo-${item.id}`) ||
          (item.type === 'action' && cmd.id === `action-${item.id}`)
        );
        if (command) {
          groups.recent.push(command);
        }
      });
    }

    // Group filtered commands
    filteredCommands.forEach(cmd => {
      if (!groups.recent.includes(cmd)) {
        groups[cmd.category]?.push(cmd);
      }
    });

    return groups;
  }, [filteredCommands, query, recentItems, commands]);

  // Format star count
  const formatStars = (stars: number): string => {
    if (stars >= 1000) {
      return `${(stars / 1000).toFixed(1)}k`;
    }
    return stars.toString();
  };

  // Get tier badge color
  const getTierColor = (tier?: string): string => {
    switch (tier) {
      case 'pro':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'enterprise':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }

      // Direct navigation for repo paths
      if (e.key === 'Enter' && filter === 'repository' && query) {
        e.preventDefault();
        // Check if the query looks like a full repo path (owner/name)
        if (query.includes('/')) {
          // Navigate directly to the repository
          navigate(`/${query}`);
          onOpenChange(false);
          return;
        }
        // If there's exactly one match, navigate to it
        if (filteredCommands.length === 1 && filteredCommands[0].category === 'repository') {
          filteredCommands[0].action();
          return;
        }
      }

      // Quick filters
      if (e.key === 'w' && e.metaKey) {
        e.preventDefault();
        setSearch('workspace:');
      } else if (e.key === 'r' && e.metaKey) {
        e.preventDefault();
        setSearch('repo:');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange, filter, query, filteredCommands, navigate]);

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearch(defaultSearchQuery);
    }
  }, [open, defaultSearchQuery]);

  // Announce search results to screen readers
  useEffect(() => {
    if (open && announcementRef.current) {
      const totalResults = filteredCommands.length;
      const message = totalResults === 0 
        ? 'No results found' 
        : `${totalResults} result${totalResults === 1 ? '' : 's'} found`;
      announcementRef.current.textContent = message;
    }
  }, [filteredCommands.length, open]);

  // Handle direct submission from input
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filter === 'repository' && query) {
      e.preventDefault();
      // Check if the query looks like a full repo path (owner/name)
      if (query.includes('/')) {
        // Navigate directly to the repository
        navigate(`/${query}`);
        onOpenChange(false);
        return;
      }
    }
  };

  return (
    <CommandDialog 
      open={open} 
      onOpenChange={onOpenChange}
      aria-label="Command palette"
    >
      {/* Screen reader announcements */}
      <div 
        ref={announcementRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
      <CommandInput
        placeholder="Search workspaces, repositories, or actions..."
        value={search}
        onValueChange={setSearch}
        onKeyDown={handleInputKeyDown}
        aria-label="Search command palette"
        aria-describedby="command-palette-help"
      />
      <CommandList aria-label="Search results">
        <CommandEmpty>
          {filter === 'repository' && query.includes('/') ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-2">Repository not in your workspaces</p>
              <p className="text-xs">Press <kbd className="rounded bg-muted px-1">↵</kbd> to navigate to <strong>{query}</strong></p>
            </div>
          ) : (
            `No results found for "${search}"`
          )}
        </CommandEmpty>

        {/* Recent Items */}
        {groupedCommands.recent.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {groupedCommands.recent.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  onSelect={cmd.action}
                  className="flex items-center gap-2"
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {cmd.icon}
                  <span className="flex-1">{cmd.name}</span>
                  {cmd.shortcut && (
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Workspaces */}
        {groupedCommands.workspace.length > 0 && (
          <CommandGroup heading="Workspaces">
            {groupedCommands.workspace.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.action}
                className="flex items-center gap-2"
              >
                {cmd.icon}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{cmd.name}</span>
                    {cmd.metadata?.tier && (
                      <Badge variant="secondary" className={cn('text-xs', getTierColor(cmd.metadata.tier || ''))}>
                        {cmd.metadata.tier}
                      </Badge>
                    )}
                  </div>
                  {cmd.description && (
                    <span className="text-xs text-muted-foreground">{cmd.description}</span>
                  )}
                </div>
                {cmd.metadata?.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(cmd.metadata.updated_at), { addSuffix: true })}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Repositories */}
        {groupedCommands.repository.length > 0 && (
          <>
            {groupedCommands.workspace.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Repositories">
              {groupedCommands.repository.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  onSelect={cmd.action}
                  className="flex items-center gap-2"
                >
                  {cmd.icon}
                  <div className="flex-1">
                    <span>{cmd.name}</span>
                    {cmd.description && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {cmd.metadata?.language && (
                          <>
                            <Code className="h-3 w-3" />
                            <span>{cmd.metadata.language}</span>
                          </>
                        )}
                        {cmd.metadata?.stars !== undefined && (
                          <>
                            <Star className="h-3 w-3" />
                            <span>{formatStars(cmd.metadata.stars)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Actions */}
        {groupedCommands.action.length > 0 && (
          <>
            {(groupedCommands.workspace.length > 0 || groupedCommands.repository.length > 0) && <CommandSeparator />}
            <CommandGroup heading="Actions">
              {groupedCommands.action.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  onSelect={cmd.action}
                  className="flex items-center gap-2"
                >
                  {cmd.icon}
                  <div className="flex-1">
                    <span>{cmd.name}</span>
                    {cmd.description && (
                      <span className="block text-xs text-muted-foreground">{cmd.description}</span>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Help text */}
        <div id="command-palette-help" className="px-2 py-2 text-xs text-muted-foreground border-t">
          <div className="flex items-center justify-between">
            <span>Type <kbd className="rounded bg-muted px-1" aria-label="workspace colon">workspace:</kbd> or <kbd className="rounded bg-muted px-1" aria-label="repo colon">repo:</kbd> to filter</span>
            <span>
              <kbd className="rounded bg-muted px-1" aria-label="arrow keys">↑↓</kbd> to navigate{' '}
              <kbd className="rounded bg-muted px-1" aria-label="enter key">↵</kbd> to select{' '}
              <kbd className="rounded bg-muted px-1" aria-label="escape key">esc</kbd> to close
            </span>
          </div>
        </div>
      </CommandList>
    </CommandDialog>
  );
}