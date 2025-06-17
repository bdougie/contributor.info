/**
 * Debug component for cache statistics (development only)
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cacheService, type CacheStats } from "@/lib/llm";
import { Database, Trash2, BarChart3 } from "lucide-react";

export function CacheDebug() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = () => {
    setStats(cacheService.getStats());
  };

  const handleClear = () => {
    cacheService.clear();
    loadStats();
  };

  const handleCleanup = () => {
    cacheService.cleanup();
    loadStats();
  };

  const formatHitRate = (hitRate: number) => {
    return `${(hitRate * 100).toFixed(1)}%`;
  };

  const getHitRateColor = (hitRate: number) => {
    if (hitRate >= 0.8) return "text-green-600";
    if (hitRate >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  if (!stats) return null;

  // Only show in development
  if (import.meta.env.PROD) return null;

  return (
    <Card className="p-4 border-blue-200 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          LLM Cache Stats
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Memory Cache:</span>
            <span className="ml-2 font-medium">{stats.memorySize}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Persistent Cache:</span>
            <span className="ml-2 font-medium">{stats.persistentSize}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Hit Rate:</span>
            <span className={`ml-2 font-medium ${getHitRateColor(stats.hitRate)}`}>
              {formatHitRate(stats.hitRate)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Requests:</span>
            <span className="ml-2 font-medium">{stats.totalHits + stats.totalMisses}</span>
          </div>
        </div>

        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-green-600">
                Hits: {stats.totalHits}
              </Badge>
              <Badge variant="outline" className="text-red-600">
                Misses: {stats.totalMisses}
              </Badge>
            </div>
            
            {stats.oldestEntry && (
              <div className="text-xs text-muted-foreground">
                Oldest entry: {stats.oldestEntry.toLocaleString()}
              </div>
            )}
            
            {stats.newestEntry && (
              <div className="text-xs text-muted-foreground">
                Newest entry: {stats.newestEntry.toLocaleString()}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanup}
            className="text-xs"
          >
            Cleanup Expired
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="text-xs text-red-600"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      </div>
    </Card>
  );
}