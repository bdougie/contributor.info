import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GithubIcon, LogOut, MessageSquare, Shield, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check admin status for a user
    const checkAdminStatus = async (user: User | null) => {
      if (!user || !user.user_metadata?.user_name) {
        setIsAdmin(false);
        return;
      }

      try {
        // Get GitHub user ID from metadata and check admin status
        const githubId = user.user_metadata?.provider_id || user.user_metadata?.sub;
        if (!githubId) {
          setIsAdmin(false);
          return;
        }

        const { data: isAdminResult, error } = await supabase
          .rpc('is_user_admin', { user_github_id: parseInt(githubId) });

        if (error) {
          console.warn('Failed to check admin status:', error);
          
          // Log auth error to database for monitoring
          try {
            await supabase.rpc('log_auth_error', {
              p_auth_user_id: user.id,
              p_github_user_id: parseInt(githubId),
              p_github_username: user.user_metadata?.user_name,
              p_error_type: 'admin_check_failed',
              p_error_message: error.message,
              p_error_code: error.code
            });
          } catch (logError) {
            console.warn('Failed to log auth error:', logError);
          }
          
          setIsAdmin(false);
          return;
        }

        setIsAdmin(isAdminResult === true);
      } catch (err) {
        console.warn('Failed to check admin status:', err);
        setIsAdmin(false);
      }
    };

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
        }
        const user = session?.user ?? null;
        setUser(user);
        checkAdminStatus(user);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to get session");
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUser(user);
      checkAdminStatus(user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setError(null);
      
      // Get the correct redirect URL for the current environment
      const redirectTo = window.location.origin + window.location.pathname;
      
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo,
          scopes: "public_repo read:user user:email",
        },
      });

      if (signInError) {
        setError(signInError.message);
      }
    } catch (err) {
      setError("Failed to initiate login");
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
      }
    } catch (err) {
      setError("Failed to log out");
    }
  };

  if (loading) {
    return (
      <Button variant="outline" disabled>
        Loading...
      </Button>
    );
  }

  if (error) {
    // Error is already displayed in UI state
  }

  if (!user) {
    return (
      <Button variant="outline" onClick={handleLogin}>
        <GithubIcon className="mr-2 h-4 w-4" />
        Login with GitHub
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata.user_name}
            />
            <AvatarFallback>
              {user.user_metadata.user_name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="font-medium">
          <div className="flex items-center justify-between w-full">
            <span>{user.user_metadata.user_name}</span>
            {isAdmin && (
              <Badge variant="destructive" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
        </DropdownMenuItem>
        
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <Shield className="mr-2 h-4 w-4" />
              Admin Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/dev")}>
              <Settings className="mr-2 h-4 w-4" />
              Developer Tools
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href="https://github.com/bdougie/contributor.info/discussions"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Give Feedback
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
