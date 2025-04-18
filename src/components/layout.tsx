import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ModeToggle } from "./mode-toggle";
import { AuthButton } from "./auth-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useTimeRangeStore } from "@/lib/time-range-store";

export default function Layout() {
  const { timeRange, setTimeRange } = useTimeRangeStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check login status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate("/")}
              className="text-xl font-bold hover:text-primary transition-colors"
            >
              contributor.info
            </button>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            {isLoggedIn && (
              <div className="hidden md:block">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <AuthButton />
            <ModeToggle />
          </div>
        </div>
      </header>
      <main className="container px-4 py-6 flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-4">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          Made with ❤️ by{" "}
          <a
            href="https://github.com/bdougie"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            bdougie
          </a>
        </div>
      </footer>
    </div>
  );
}
