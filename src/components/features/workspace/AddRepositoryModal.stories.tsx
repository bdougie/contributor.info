import type { Meta, StoryObj } from '@storybook/react';
import { AddRepositoryModal } from './AddRepositoryModal';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

// Mock the supabase module for Storybook
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
};

const mockWorkspace = {
  id: 'test-workspace-id',
  name: 'Test Workspace',
  owner_id: 'test-user-123',
  tier: 'free',
  max_repositories: 10,
  current_repository_count: 3,
  visibility: 'public',
  settings: {},
  data_retention_days: 30,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

const mockRepositories = [
  {
    id: 'repo-1',
    full_name: 'facebook/react',
    owner: 'facebook',
    name: 'react',
  },
  {
    id: 'repo-2', 
    full_name: 'vercel/next.js',
    owner: 'vercel',
    name: 'next.js',
  },
];

// Override supabase for stories
const setupMockSupabase = () => {
  if (typeof window !== 'undefined') {
    // Create a mock for the supabase client
    (window as any).__mockSupabase = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
        onAuthStateChange: (callback: any) => {
          // Immediately call with signed in state
          callback('SIGNED_IN', { user: mockUser });
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      from: (table: string) => ({
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            single: () => {
              if (table === 'workspaces') {
                return Promise.resolve({ data: mockWorkspace, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
            maybeSingle: () => {
              if (table === 'workspace_members') {
                return Promise.resolve({ 
                  data: { role: 'owner', user_id: mockUser.id }, 
                  error: null 
                });
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
          in: (column: string, values: any[]) => 
            Promise.resolve({ 
              data: table === 'repositories' ? mockRepositories : [], 
              error: null 
            }),
        }),
        insert: (data: any) => ({
          select: () => ({
            single: () => Promise.resolve({ 
              data: { id: 'new-repo-link', ...data }, 
              error: null 
            }),
          }),
        }),
        update: (data: any) => ({
          eq: () => ({
            select: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    };
  }
};

const meta: Meta<typeof AddRepositoryModal> = {
  title: 'Features/Workspace/AddRepositoryModal',
  component: AddRepositoryModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      useEffect(() => {
        setupMockSupabase();
        
        // Mock the WorkspaceService
        const mockWorkspaceService = {
          addRepositoryToWorkspace: () => Promise.resolve({
            success: true,
            data: { id: 'new-link', repository_id: 'repo-123' },
          }),
          checkPermissions: () => Promise.resolve({ hasPermission: true }),
        };
        
        // Override the import
        if (typeof window !== 'undefined') {
          (window as any).__mockWorkspaceService = mockWorkspaceService;
        }
      }, []);
      
      return <Story />;
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper component to manage modal state
function AddRepositoryModalDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Add Repository Modal</Button>
      <AddRepositoryModal
        open={open}
        onOpenChange={setOpen}
        workspaceId="test-workspace-id"
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <AddRepositoryModalDemo />,
};

// Story showing the modal open by default with auth
export const OpenModalAuthenticated: Story = {
  args: {
    open: true,
    workspaceId: 'test-workspace-id',
  },
  render: (args) => {
    const [open, setOpen] = useState(args.open);
    
    return (
      <AddRepositoryModal
        {...args}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    );
  },
};

// Story with mock search results and authenticated user
export const WithSearchResults: Story = {
  parameters: {
    mockData: [
      {
        url: '/api/repositories/search',
        method: 'GET',
        status: 200,
        response: {
          data: [
            {
              id: '1',
              owner: 'facebook',
              name: 'react',
              full_name: 'facebook/react',
              description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
              language: 'JavaScript',
              stargazers_count: 200000,
              is_tracked: true,
            },
            {
              id: '2',
              owner: 'vuejs',
              name: 'vue',
              full_name: 'vuejs/vue',
              description: 'A progressive, incrementally-adoptable JavaScript framework for building UI on the web.',
              language: 'TypeScript',
              stargazers_count: 195000,
              is_tracked: true,
            },
            {
              id: '3',
              owner: 'angular',
              name: 'angular',
              full_name: 'angular/angular',
              description: 'One framework. Mobile & desktop.',
              language: 'TypeScript',
              stargazers_count: 85000,
              is_tracked: true,
            },
          ],
        },
      },
    ],
  },
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <>
        <div className="text-sm text-muted-foreground mb-4 p-4 bg-muted rounded-lg">
          <p className="font-semibold mb-2">Authenticated as: test@example.com</p>
          <p>Workspace: Test Workspace (3/10 repositories)</p>
          <p>Tier: Free</p>
        </div>
        <AddRepositoryModal
          open={open}
          onOpenChange={setOpen}
          workspaceId="test-workspace-id"
          onSuccess={() => {
            console.log('Repository added successfully');
            setOpen(false);
          }}
        />
      </>
    );
  },
};

// Story simulating loading state with auth
export const LoadingState: Story = {
  parameters: {
    mockData: [
      {
        url: '/api/repositories/add',
        method: 'POST',
        status: 200,
        delay: 2000, // 2 second delay to show loading state
        response: {
          success: true,
        },
      },
    ],
  },
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <AddRepositoryModal
        open={open}
        onOpenChange={setOpen}
        workspaceId="test-workspace-id"
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    );
  },
};

// Story showing error state (repository limit reached)
export const RepositoryLimitError: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        setupMockSupabase();
        // Override workspace to show at limit
        if (typeof window !== 'undefined') {
          const supabase = (window as any).__mockSupabase;
          const originalFrom = supabase.from;
          supabase.from = (table: string) => {
            const result = originalFrom(table);
            if (table === 'workspaces') {
              return {
                ...result,
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({ 
                      data: { ...mockWorkspace, current_repository_count: 10 }, 
                      error: null 
                    }),
                  }),
                }),
              };
            }
            return result;
          };
        }
      }, []);
      
      return <Story />;
    },
  ],
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <>
        <div className="text-sm text-destructive mb-4 p-4 bg-destructive/10 rounded-lg">
          <p className="font-semibold">Repository Limit Reached!</p>
          <p>You have reached the maximum of 10 repositories for the free tier.</p>
        </div>
        <AddRepositoryModal
          open={open}
          onOpenChange={setOpen}
          workspaceId="test-workspace-id"
          onSuccess={() => {
            console.log('Repository added successfully');
            setOpen(false);
          }}
        />
      </>
    );
  },
};

// Story simulating unauthenticated state
export const UnauthenticatedError: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        // Mock unauthenticated state
        if (typeof window !== 'undefined') {
          (window as any).__mockSupabase = {
            auth: {
              getUser: () => Promise.resolve({ data: { user: null }, error: null }),
              onAuthStateChange: (callback: any) => {
                callback('SIGNED_OUT', { user: null });
                return { data: { subscription: { unsubscribe: () => {} } } };
              },
            },
            from: () => ({
              select: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: null }),
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
      }, []);
      
      return <Story />;
    },
  ],
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <>
        <div className="text-sm text-destructive mb-4 p-4 bg-destructive/10 rounded-lg">
          <p className="font-semibold">Authentication Required</p>
          <p>You must be logged in to add repositories to a workspace.</p>
        </div>
        <AddRepositoryModal
          open={open}
          onOpenChange={setOpen}
          workspaceId="test-workspace-id"
          onSuccess={() => {
            console.log('Repository added successfully');
            setOpen(false);
          }}
        />
      </>
    );
  },
};