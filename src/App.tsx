import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/common/theming";
import { Toaster } from "@/components/ui/sonner";
import { Layout, Home, NotFound } from "@/components/common/layout";
import { 
  RepoView,
  LotteryFactorRoute,
  ContributionsRoute,
  DistributionRoute,
} from "@/components/features/repository";
import { LoginPage, DebugAuthPage } from "@/components/features/auth";
import TestInsights from "@/components/features/auth/test-insights";
import { ChangelogPage } from "@/components/features/changelog";
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
            <Route path="/changelog" element={<ChangelogPage />} />
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