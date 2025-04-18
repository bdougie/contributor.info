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

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <Router>
        <Routes>
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
