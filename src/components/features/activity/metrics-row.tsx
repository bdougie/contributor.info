import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PrCountCard } from "./pr-count-card";
import { AvgTimeCard } from "./avg-time-card";
import { VelocityCard } from "./velocity-card";
import { calculatePrActivityMetrics, type ActivityMetrics } from "@/lib/insights/pr-activity-metrics";

interface MetricsRowProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function MetricsRow({ owner, repo, timeRange }: MetricsRowProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [owner, repo, timeRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const metrics = await calculatePrActivityMetrics(owner, repo, timeRange);
      setMetrics(metrics);
    } catch (error) {
      console.error("Failed to load PR metrics:", error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metrics</CardTitle>
        <CardDescription>
          This snapshot is a sample of the last 100 pull requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <PrCountCard openPRs={0} totalPRs={0} loading={true} />
            <AvgTimeCard averageMergeTime={0} loading={true} />
            <div className="md:col-span-2">
              <VelocityCard velocity={{ current: 0, previous: 0, change: 0 }} loading={true} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <PrCountCard 
              openPRs={metrics.openPRs} 
              totalPRs={metrics.totalPRs}
              loading={loading}
            />
            <AvgTimeCard 
              averageMergeTime={metrics.averageMergeTime}
              averageMergeTimeTrend={metrics.averageMergeTimeTrend}
              loading={loading}
            />
            <div className="md:col-span-2">
              <VelocityCard 
                velocity={metrics.velocity}
                loading={loading}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}