import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that protects admin-only routes
 * Renders children only if user is authenticated and has admin privileges
 */
export function AdminRoute({ children, fallback }: AdminRouteProps) {
  const { isAuthenticated, isAdmin, isLoading, user, error } = useAdminAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Access Verification Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button asChild className="w-full mt-4">
            <Link to="/">Return to Home</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return fallback || (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Authentication Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Please sign in with GitHub to access this area.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">Go Home</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show admin access required
  if (!isAdmin) {
    return fallback || (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            Admin Access Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              This area is restricted to administrators only. Your access level has been verified and you do not have sufficient privileges.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Current user:</strong> {user?.github_username || 'Unknown'}</p>
            <p><strong>Admin status:</strong> {isAdmin ? 'Admin' : 'Regular user'}</p>
          </div>
          <Button asChild className="w-full mt-4">
            <Link to="/">Return to Home</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // User is authenticated and has admin privileges
  return <>{children}</>;
}

/**
 * Higher-order component version for route protection
 */
export function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function AdminProtectedComponent(props: P) {
    return (
      <AdminRoute fallback={fallback}>
        <Component {...props} />
      </AdminRoute>
    );
  };
}