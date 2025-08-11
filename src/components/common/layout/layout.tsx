import { useState, useEffect } from "react"
import { Menu } from '@/components/ui/icon';
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { ModeToggle } from "../theming";
import { AuthButton } from "../../features/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { useTimeRangeStore } from "@/lib/time-range-store";

export default function Layout() {
  const { timeRange, setTimeRange } = useTimeRangeStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if current page needs time range controls
  const needsTimeRange = () => {
    const path = location.pathname;
    // Show on home page and repository pages
    return path === '/' || /^\/[^/]+\/[^/]+/.test(path);
  };

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
          {/* Hamburger Menu - Now on all screen sizes */}
          <div className="flex items-center space-x-4">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-md">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-4 mt-6" aria-label="Main navigation">
                  <button
                    onClick={() => {
                      navigate("/");
                      setIsMenuOpen(false);
                    }}
                    className="text-lg font-semibold hover:text-primary transition-colors text-left"
                  >
                    Home
                  </button>
                  <Link
                    to="/changelog"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-base hover:text-primary transition-colors"
                  >
                    Changelog
                  </Link>
                  <Link
                    to="/docs"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-base hover:text-primary transition-colors"
                  >
                    Docs
                  </Link>
                  
                  {/* Time Range - only on relevant pages */}
                  {isLoggedIn && needsTimeRange() && (
                    <section className="pt-4 border-t">
                      <label className="text-sm font-medium mb-2 block">Time Range</label>
                      <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select time range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </section>
                  )}
                  
                  <section className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Theme</span>
                      <ModeToggle />
                    </div>
                  </section>
                  
                  <section className="pt-4 border-t">
                    <nav className="flex space-x-4 text-xs text-muted-foreground" aria-label="Footer links">
                      <Link
                        to="/privacy"
                        onClick={() => setIsMenuOpen(false)}
                        className="hover:text-primary transition-colors"
                      >
                        Privacy
                      </Link>
                      <Link
                        to="/terms"
                        onClick={() => setIsMenuOpen(false)}
                        className="hover:text-primary transition-colors"
                      >
                        Terms
                      </Link>
                    </nav>
                  </section>
                </nav>
              </SheetContent>
            </Sheet>
            
            <button
              onClick={() => navigate("/")}
              className="text-xl font-bold hover:text-primary transition-colors"
            >
              contributor.info
            </button>
          </div>
          
          {/* Auth Button - Always visible in header */}
          <div className="ml-auto">
            <AuthButton />
          </div>
        </div>
      </header>
      
      <main className="flex-1 bg-muted/50">
        <div className="container px-4 py-6">
          <Outlet />
        </div>
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
