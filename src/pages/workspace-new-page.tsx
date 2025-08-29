import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@/components/ui/icon';
import { WorkspaceCreateForm } from '@/components/features/workspace/WorkspaceCreateForm';
import { WorkspaceService } from '@/services/workspace.service';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { CreateWorkspaceRequest } from '@/types/workspace';
import type { User } from '@supabase/supabase-js';

export default function WorkspaceNewPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the current user when the page loads
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();
  }, []);

  const handleWorkspaceSubmit = async (data: CreateWorkspaceRequest) => {
    if (!user?.id) {
      setError('You must be logged in to create a workspace');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await WorkspaceService.createWorkspace(user.id, data);

      if (response.success && response.data) {
        toast.success('Workspace created successfully!');
        navigate(`/i/${response.data.id}`);
      } else {
        setError(response.error || 'Failed to create workspace');
      }
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Create New Workspace</h1>
            <p className="text-muted-foreground">
              Organize your favorite repositories and collaborate with your team. You can add repositories and invite members after creating your workspace.
            </p>
          </div>
        </div>

        {/* Main Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace Details</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkspaceCreateForm
              onSubmit={handleWorkspaceSubmit}
              onCancel={handleCancel}
              loading={loading}
              error={error}
              mode="create"
            />
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help? Check out our{' '}
            <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/docs')}>
              documentation
            </Button>
            {' '}to learn more about workspaces.
          </p>
        </div>
      </div>
    </div>
  );
}