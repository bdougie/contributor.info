// filepath: /Users/briandouglas/code/contributor.info/src/components/quadrant-stats.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { QuadrantData } from "@/lib/types";

interface QuadrantStatsProps {
  data: QuadrantData[];
}

export function QuadrantStats({ data }: QuadrantStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
      {data.map((quadrant) => (
        <Card key={quadrant.name}>
          <CardHeader>
            <CardTitle className="text-lg">{quadrant.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quadrant.percentage.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">
              {quadrant.count} files touched
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
