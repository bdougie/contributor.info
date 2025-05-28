import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/layout";
import RepoView, {
  LotteryFactorRoute,
  ContributionsRoute,
  DistributionRoute,
} from "@/components/repo-view";
import Home from "@/components/home";
import LoginPage from "@/components/login-page";
import TestInsights from "@/components/test-insights";
import DebugAuthPage from "@/components/debug-auth-page";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

function App() {
  // Add auth debugging code
  useEffect(() => {
    console.log("App mounted, debug auth info:");
    console.log("Current URL:", window.location.href);
    console.log("URL Hash:", window.location.hash);
    console.log("URL Search:", window.location.search);
    console.log("Protocol:", window.location.protocol);
    console.log("Is HTTPS:", window.location.protocol === "https:");

    // Check if we have auth tokens in the URL
    if (window.location.hash.includes("access_token")) {
      console.log("Auth tokens found in URL hash");
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log("Current session:", session);
      console.log("Session error:", error);
    });

    // Emergency auth handler for direct URL handling
    if (window.location.hash.includes("access_token")) {
      console.log("Auth tokens detected, forcing session refresh...");
      setTimeout(async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          console.log("Session established after hash detection");
          // Don't redirect here - let the normal auth flow handle it
        } else {
          console.log("No session established after hash detection");
        }
      }, 1000);
    }
  }, []);

  // Add auth state change listener
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event from App.tsx:", event);
      console.log("Session from App.tsx:", session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/test-insights" element={<TestInsights />} />
          <Route path="/debug-auth" element={<DebugAuthPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/:owner/:repo" element={<RepoView />}>
              <Route path="" element={<LotteryFactorRoute />} />
              <Route path="contributions" element={<ContributionsRoute />} />
              <Route path="distribution" element={<DistributionRoute />} />
            </Route>
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
