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
import NotFound from "@/components/not-found";
import CardLayout from "@/components/social-cards/card-layout";
import HomeSocialCardWithData from "@/components/social-cards/home-card-with-data";
import RepoCardWithData from "@/components/social-cards/repo-card-with-data";
import SocialCardPreview from "@/components/social-cards/preview";

function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/test-insights" element={<TestInsights />} />
          <Route path="/debug-auth" element={<DebugAuthPage />} />
          <Route path="/dev/social-cards" element={<SocialCardPreview />} />
          
          {/* Social card routes */}
          <Route path="/social-cards" element={<CardLayout><HomeSocialCardWithData /></CardLayout>} />
          <Route path="/social-cards/home" element={<CardLayout><HomeSocialCardWithData /></CardLayout>} />
          <Route path="/social-cards/:owner/:repo" element={
            <CardLayout>
              <RepoCardWithData />
            </CardLayout>
          } />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/:owner/:repo" element={<RepoView />}>
              <Route path="" element={<LotteryFactorRoute />} />
              <Route path="contributions" element={<ContributionsRoute />} />
              <Route path="distribution" element={<DistributionRoute />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;