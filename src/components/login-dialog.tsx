import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { useGitHubAuth } from "@/hooks/use-github-auth";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { login, isLoggedIn } = useGitHubAuth();

  // Handle dialog close attempts - only allow close if logged in
  const handleOpenChange = (newOpen: boolean) => {
    // If trying to close the dialog and not logged in, prevent closing
    if (!newOpen && !isLoggedIn) {
      return;
    }

    // Otherwise, allow the change
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="login-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login Required</DialogTitle>
          <DialogDescription>
            You need to log in to search for repositories. This helps avoid rate
            limiting and provides access to more GitHub data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button onClick={login}>
            <GithubIcon className="mr-2 h-4 w-4" />
            Login with GitHub
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
