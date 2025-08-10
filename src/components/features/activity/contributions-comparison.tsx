import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ContributionsChartNivo from "./contributions";
import ContributionsChartRecharts from "./contributions-recharts";

export function ContributionsComparison() {
  const [activeChart, setActiveChart] = useState<"nivo" | "recharts">("recharts");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scatterplot Implementation Comparison</CardTitle>
          <CardDescription>
            Testing Recharts vs Nivo implementation for bundle size optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Badge variant="outline">
              Nivo: ~120KB bundle size
            </Badge>
            <Badge variant="outline" className="text-green-600">
              Recharts: Already included (0KB additional)
            </Badge>
          </div>
          
          <Tabs value={activeChart} onValueChange={(value) => setActiveChart(value as "nivo" | "recharts")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nivo">
                Current (Nivo)
              </TabsTrigger>
              <TabsTrigger value="recharts">
                New (Recharts)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="nivo" className="mt-4">
              <ContributionsChartNivo />
            </TabsContent>
            
            <TabsContent value="recharts" className="mt-4">
              <ContributionsChartRecharts />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default ContributionsComparison;