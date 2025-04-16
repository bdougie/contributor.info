import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/layout";
import RepoView from "@/components/repo-view";
import Home from "@/components/home";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/:owner/:repo" element={<RepoView />}>
              <Route path="" element={<RepoView.LotteryFactor />} />
              <Route
                path="contributions"
                element={<RepoView.Contributions />}
              />
              <Route path="activity" element={<RepoView.Activity />} />
            </Route>
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
