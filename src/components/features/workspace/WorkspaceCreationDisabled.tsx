import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Crown, LogIn } from '@/components/ui/icon';
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
        <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-muted">
          {isLoggedIn ? (
            <Crown className="w-6 h-6 text-muted-foreground" />
          ) : (
            <LogIn className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold" data-testid="disabled-heading">
            {isLoggedIn ? 'Upgrade to Pro' : 'Sign In Required'}
          </h3>
          <p
            className="text-muted-foreground text-sm max-w-sm mx-auto"
            data-testid="disabled-description"
          >
            {isLoggedIn ? (
              <>
                Workspaces are a Pro feature. Upgrade to create and manage unlimited workspaces with
                team collaboration.
              </>
            ) : (
              <>Sign in to organize repositories and collaborate with your team.</>
            )}
          </p>
        </div>
        <div className="flex justify-center pt-2">
          {isLoggedIn ? (
            <Button asChild variant="default" size="sm">
              <Link to="/billing">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Link>
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
      {isLoggedIn ? <Crown className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
      <AlertTitle>{isLoggedIn ? 'Upgrade to Pro' : 'Sign In Required'}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm mb-3">
          {isLoggedIn ? (
            <>
              Workspaces are a Pro feature. Upgrade to create and manage unlimited workspaces with
              team collaboration.
            </>
          ) : (
            <>Sign in to organize repositories and collaborate with your team.</>
          )}
        </p>
        {isLoggedIn ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/billing">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Link>
          </Button>
        ) : (
          onRequestAccess && (
            <Button onClick={onRequestAccess} variant="outline" size="sm">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )
        )}
      </AlertDescription>
    </Alert>
  );
}
