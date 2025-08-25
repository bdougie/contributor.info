import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Search,
  Plus,
  Settings,
  TrendingUp,
  Clock,
  Star,
  Code,
  FileText,
  User,
  Layout,
} from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Types
interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workspaces?: Workspace[];
  repositories?: Repository[];
  recentItems?: RecentItem[];
  defaultSearchQuery?: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  repositories?: string[];
  repository_count?: number;
  tier?: string;
  updated_at?: string;
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

interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'workspace' | 'repository' | 'action' | 'navigation' | 'recent';
  metadata?: Record<string, unknown>;
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
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Parse search query for filters
  const { query, filter } = useMemo(() => {
    const lowerSearch = search.toLowerCase().trim();
    
    // Check for filter prefixes
    if (lowerSearch.startsWith('workspace:') || lowerSearch.startsWith('w:')) {
      return { 
        query: lowerSearch.replace(/^(workspace:|w:)/, '').trim(),
        filter: 'workspace' 
      };
    }
    
    if (lowerSearch.startsWith('repo:') || lowerSearch.startsWith('r:')) {
      return { 
        query: lowerSearch.replace(/^(repo:|r:)/, '').trim(),
        filter: 'repository' 
      };
    }
    
    if (lowerSearch.startsWith('>')) {
      return { 
        query: lowerSearch.replace(/^>/, '').trim(),
        filter: 'action' 
      };
    }
    
    return { query: lowerSearch, filter: null };
  }, [search]);

  // Build command items
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Add workspace commands
    if (!filter || filter === 'workspace') {
      workspaces.forEach(workspace => {
        items.push({
          id: `workspace-${workspace.id}`,
          name: workspace.name,
          description: workspace.description || `${workspace.repository_count || 0} repositories`,
          icon: <Package className="h-4 w-4" />,
          action: () => {
            navigate(`/i/${workspace.id}`);
            onOpenChange(false);
          },
          category: 'workspace',
          metadata: { tier: workspace.tier, updated_at: workspace.updated_at },
        });
      });
    }

    // Add repository commands
    if (!filter || filter === 'repository') {
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
    }

    // Add action commands
    if (!filter || filter === 'action') {
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
    }

    return items;
  }, [workspaces, repositories, filter, navigate, onOpenChange]);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;

    return commands.filter(cmd => {
      const searchableText = `${cmd.name} ${cmd.description || ''}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [commands, query]);

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
  }, [open, onOpenChange]);

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearch(defaultSearchQuery);
      setSelectedIndex(0);
    }
  }, [open, defaultSearchQuery]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search workspaces, repositories, or actions..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          No results found for "{search}"
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
                      <Badge variant="secondary" className={cn('text-xs', getTierColor(cmd.metadata.tier as string))}>
                        {cmd.metadata.tier as string}
                      </Badge>
                    )}
                  </div>
                  {cmd.description && (
                    <span className="text-xs text-muted-foreground">{cmd.description}</span>
                  )}
                </div>
                {cmd.metadata?.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(cmd.metadata.updated_at as string), { addSuffix: true })}
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
                            <span>{cmd.metadata.language as string}</span>
                          </>
                        )}
                        {cmd.metadata?.stars && (
                          <>
                            <Star className="h-3 w-3" />
                            <span>{formatStars(cmd.metadata.stars as number)}</span>
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
        <div className="px-2 py-2 text-xs text-muted-foreground border-t">
          <div className="flex items-center justify-between">
            <span>Type <kbd className="rounded bg-muted px-1">workspace:</kbd> or <kbd className="rounded bg-muted px-1">repo:</kbd> to filter</span>
            <span><kbd className="rounded bg-muted px-1">↑↓</kbd> to navigate <kbd className="rounded bg-muted px-1">↵</kbd> to select <kbd className="rounded bg-muted px-1">esc</kbd> to close</span>
          </div>
        </div>
      </CommandList>
    </CommandDialog>
  );
}