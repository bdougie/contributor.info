import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Mail } from '@/components/ui/icon';

export interface WorkspaceCreationDisabledProps {
  variant?: 'card' | 'modal';
  onRequestAccess?: () => void;
}

export function WorkspaceCreationDisabled({
  variant = 'card',
  onRequestAccess,
}: WorkspaceCreationDisabledProps) {
  if (variant === 'modal') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-muted">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Workspace Creation Unavailable</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Workspace creation is currently disabled. We're working on improvements to bring you a
            better experience.
          </p>
        </div>
        {onRequestAccess && (
          <div className="flex justify-center pt-2">
            <Button onClick={onRequestAccess} variant="outline" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Request Early Access
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Alert>
      <Lock className="h-4 w-4" />
      <AlertTitle>Workspace Creation Disabled</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm mb-3">
          Workspace creation is currently unavailable. We're making improvements to bring you a
          better experience.
        </p>
        {onRequestAccess && (
          <Button onClick={onRequestAccess} variant="outline" size="sm">
            <Mail className="w-4 h-4 mr-2" />
            Request Early Access
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
