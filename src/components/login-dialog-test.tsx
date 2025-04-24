import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";

/**
 * Standalone page for testing the login dialog in isolation
 */
export default function LoginDialogTest() {
  const [dialogOpen, setDialogOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Login Dialog Test Page</h1>

      <div className="flex gap-4 mb-8">
        <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
        <Button variant="outline" onClick={() => setDialogOpen(false)}>
          Close Dialog
        </Button>
      </div>

      <div className="p-4 bg-muted rounded-md">
        <p>
          Current dialog state:{" "}
          <span className="font-bold">{dialogOpen ? "OPEN" : "CLOSED"}</span>
        </p>
      </div>

      {/* Basic Dialog with no dependencies on hooks */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              You need to log in to search for repositories. This helps avoid
              rate limiting and provides access to more GitHub data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => console.log("Login clicked")}>
              <GithubIcon className="mr-2 h-4 w-4" />
              Login with GitHub
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
