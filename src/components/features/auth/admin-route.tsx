import { useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldX, Lock } from "lucide-react";

interface AdminRouteProps {
  children: ReactNode;
  requireRole?: 'admin' | 'moderator'; // Optional specific role requirement
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoggedIn, isAdmin, loading, error } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      // Store the attempted URL for redirect after login
      const redirectTo = location.pathname + location.search;
      localStorage.setItem("redirectTo", redirectTo);
      navigate("/login");
    }
  }, [isLoggedIn, loading, navigate, location]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Checking admin access...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an authentication error
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              Authentication error: {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (navigation will handle redirect)
  if (!isLoggedIn || !user) {
    return null;
  }

  // Check admin access
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You need administrator privileges to access this page.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Current user: <span className="font-medium">{user.user_metadata?.user_name}</span>
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // TODO: Add specific role checking when needed
  // This can be extended later for more granular permissions
  // if (requireRole === 'moderator') {
  //   const hasModerator = await hasRole('moderator');
  //   if (!hasModerator) {
  //     // Show insufficient permissions
  //   }
  // }

  return <>{children}</>;
}