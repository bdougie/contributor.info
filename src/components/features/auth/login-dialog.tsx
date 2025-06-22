import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { useState } from "react";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { login, isLoggedIn } = useGitHubAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle dialog close attempts - only allow close if logged in
  const handleOpenChange = (newOpen: boolean) => {
    // If trying to close the dialog and not logged in, prevent closing
    if (!newOpen && !isLoggedIn) {
      return;
    }

    // Otherwise, allow the change
    onOpenChange(newOpen);
  };

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setError(null);

      // Store current path for redirect after login
      const currentPath = window.location.pathname;
      localStorage.setItem("redirectAfterLogin", currentPath);

      await login();
      // The dialog will close automatically when isLoggedIn changes
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent data-testid="login-dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              You need to log in to search for repositories. This helps avoid
              rate limiting and provides access to more GitHub data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center pt-4 gap-2">
            <Button onClick={handleLogin} disabled={isLoggingIn}>
              <GithubIcon className="mr-2 h-4 w-4" />
              {isLoggingIn ? "Logging in..." : "Login with GitHub"}
            </Button>

            {error && (
              <div className="text-red-500 text-sm mt-2 text-center">
                {error}
              </div>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
