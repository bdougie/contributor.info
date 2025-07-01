import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UnifiedRepoSearch } from "../search";
import { SocialMetaTags } from "./meta-tags-provider";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <SocialMetaTags
        title="contributor.info - Visualizing Open Source Contributions"
        description="Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact."
        url="https://contributor.info"
        image="social-cards/home-card.webp"
      />
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Analyze GitHub Repository Contributors
          </CardTitle>
          <CardDescription className="text-center text-lg mt-2">
            Enter a GitHub repository URL or owner/repo to visualize
            contribution patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnifiedRepoSearch 
            isHomeView={true}
            placeholder="e.g., etcd-io/etcd or https://github.com/etcd-io/etcd"
            buttonText="Analyze"
          />
        </CardContent>
      </Card>
    </div>
  );
}
