import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LogIn } from '@/components/ui/icon';
import { Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';

export interface WorkspaceCreationDisabledProps {
  variant?: 'card' | 'modal';
  onRequestAccess?: () => void;
  user?: User | null;
}

export function WorkspaceCreationDisabled({
  variant = 'card',
  onRequestAccess,
  user,
}: WorkspaceCreationDisabledProps) {
  if (variant === 'modal') {
    const isLoggedIn = !!user;

    return (
      <div className="p-6 space-y-4" data-testid="workspace-creation-disabled">
        <div className="text-center space-y-2">
          {!isLoggedIn && (
            <h3 className="text-lg font-semibold" data-testid="disabled-heading">
              Sign In Required
            </h3>
          )}
          <p
            className="text-muted-foreground text-sm max-w-sm mx-auto"
            data-testid="disabled-description"
          >
            {isLoggedIn ? (
              <>
                Workspaces are a Pro feature.{' '}
                <Link to="/billing" className="text-primary hover:underline font-medium">
                  Upgrade and find out
                </Link>{' '}
                how you can build successful open source projects.
              </>
            ) : (
              <>Sign in to organize repositories and collaborate with your team.</>
            )}
          </p>
        </div>
        <div className="flex justify-center pt-2">
          {isLoggedIn ? (
            <Button asChild variant="default">
              <Link to="/billing">Upgrade to Pro</Link>
            </Button>
          ) : (
            <Button
              onClick={onRequestAccess}
              disabled={!onRequestAccess}
              variant="outline"
              size="sm"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    );
  }

  const isLoggedIn = !!user;

  return (
    <Alert>
      {!isLoggedIn && <AlertTitle>Sign In Required</AlertTitle>}
      <AlertDescription className="mt-2">
        <p className="text-sm mb-3">
          {isLoggedIn ? (
            <>
              Workspaces are a Pro feature.{' '}
              <Link to="/billing" className="text-primary hover:underline font-medium">
                Upgrade and find out
              </Link>{' '}
              how we you can build successful open source projects.
            </>
          ) : (
            <>Sign in to organize repositories and collaborate with your team.</>
          )}
        </p>
        <div className="flex justify-center">
          {isLoggedIn ? (
            <Button asChild variant="default">
              <Link to="/billing">Upgrade to Pro</Link>
            </Button>
          ) : (
            onRequestAccess && (
              <Button onClick={onRequestAccess} variant="outline" size="sm">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
