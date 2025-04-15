import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login Required</DialogTitle>
          <DialogDescription>
            To avoid rate limiting and access more GitHub data, please log in with your GitHub account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button onClick={handleLogin}>
            <GithubIcon className="mr-2 h-4 w-4" />
            Login with GitHub
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}