import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RefreshCw } from '@/components/ui/icon';
import { ManualBackfill } from '@/components/ManualBackfill';

export function ManualBackfillDebug() {
  const navigate = useNavigate();
  const [repository, setRepository] = useState('');
  const [showBackfill, setShowBackfill] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repository && repository.includes('/')) {
      setShowBackfill(true);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate('/dev')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Debug Menu
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manual Backfill Debug</CardTitle>
            <CardDescription>
              Test the manual backfill functionality for GitHub repositories.
              This tool allows you to trigger a data backfill for any repository.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> This feature requires the gh-datapipe API to be deployed and configured.
                Make sure GH_DATPIPE_KEY and GH_DATPIPE_API_URL are set in your environment variables.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repository">Repository (owner/name)</Label>
                <Input
                  id="repository"
                  placeholder="e.g., facebook/react"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  pattern="[a-zA-Z0-9-_.]+/[a-zA-Z0-9-_.]+"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Enter the repository in the format: owner/name
                </p>
              </div>
              
              <Button type="submit" disabled={!repository}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Test Backfill
              </Button>
            </form>

            {showBackfill && repository && (
              <div className="mt-6 pt-6 border-t">
                <ManualBackfill 
                  repository={repository}
                  onComplete={() => {
                    console.log('Backfill completed for %s', repository);
                    // Could navigate to the repository view or show a success message
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Configuration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">GH_DATPIPE_API_URL:</span>{' '}
                <span>{process.env.GH_DATPIPE_API_URL || 'Not configured'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">GH_DATPIPE_KEY:</span>{' '}
                <span>{process.env.GH_DATPIPE_KEY ? '✓ Configured' : '✗ Not configured'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}