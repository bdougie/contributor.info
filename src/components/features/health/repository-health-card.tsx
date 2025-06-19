import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { RepositoryHealthCore } from "@/components/insights/sections/repository-health-core";

export function RepositoryHealthCard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);

  if (!owner || !repo) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repository Health</CardTitle>
        <CardDescription>
          Overall health score and key metrics for repository maintenance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RepositoryHealthCore owner={owner} repo={repo} timeRange={timeRange} />
      </CardContent>
    </Card>
  );
}