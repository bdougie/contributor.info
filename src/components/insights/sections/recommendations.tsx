import { useState, useEffect } from "react";
import { Sparkles, Lightbulb, Target, Zap, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: string;
  type: "process" | "contributor" | "performance" | "quality";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  actionable: boolean;
  actions?: {
    label: string;
    url?: string;
    onClick?: () => void;
  }[];
  completed?: boolean;
}

interface RecommendationsProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function Recommendations({ owner, repo, timeRange }: RecommendationsProps) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecommendations();
  }, [owner, repo, timeRange]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      // TODO: Implement actual recommendations engine
      setTimeout(() => {
        setRecommendations([
          {
            id: "rec-1",
            type: "contributor",
            priority: "high",
            title: "Onboard new contributors",
            description: "Your repository has low contributor diversity. Consider creating good-first-issue labels and documentation.",
            impact: "Increase bus factor and community growth",
            actionable: true,
            actions: [
              { label: "Create good-first-issues", onClick: () => console.log("Create issues") },
              { label: "View contributing guide", url: `https://github.com/${owner}/${repo}/blob/main/CONTRIBUTING.md` }
            ]
          },
          {
            id: "rec-2",
            type: "process",
            priority: "medium",
            title: "Automate PR checks",
            description: "Enable GitHub Actions for automated testing and linting to reduce review burden.",
            impact: "Reduce review time by 40%",
            actionable: true,
            actions: [
              { label: "Setup GitHub Actions", url: `https://github.com/${owner}/${repo}/actions/new` }
            ]
          },
          {
            id: "rec-3",
            type: "performance",
            priority: "medium",
            title: "Optimize review assignments",
            description: "Use CODEOWNERS file to automatically assign reviewers based on expertise.",
            impact: "Faster review turnaround",
            actionable: true,
            actions: [
              { label: "Create CODEOWNERS", url: `https://github.com/${owner}/${repo}/new/main?filename=.github/CODEOWNERS` }
            ]
          },
          {
            id: "rec-4",
            type: "quality",
            priority: "low",
            title: "Add PR templates",
            description: "Standardize PR descriptions with templates to improve review efficiency.",
            impact: "Better PR documentation",
            actionable: true,
            actions: [
              { label: "Add PR template", url: `https://github.com/${owner}/${repo}/new/main?filename=.github/pull_request_template.md` }
            ]
          },
          {
            id: "rec-5",
            type: "process",
            priority: "low",
            title: "Weekly contributor sync",
            description: "Schedule regular sync meetings to discuss blockers and align on priorities.",
            impact: "Improved team coordination",
            actionable: false
          }
        ]);
        setLoading(false);
      }, 800);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
      setLoading(false);
    }
  };

  const getTypeIcon = (type: Recommendation["type"]) => {
    switch (type) {
      case "process":
        return Target;
      case "contributor":
        return Lightbulb;
      case "performance":
        return Zap;
      case "quality":
        return Sparkles;
    }
  };

  const getPriorityColor = (priority: Recommendation["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(new Set([...dismissedIds, id]));
  };

  const visibleRecommendations = recommendations.filter(
    (rec) => !dismissedIds.has(rec.id) && !rec.completed
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (visibleRecommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          All recommendations completed!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleRecommendations.map((rec) => {
        const Icon = getTypeIcon(rec.type);
        
        return (
          <Card key={rec.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium">{rec.title}</h4>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getPriorityColor(rec.priority))}
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.description}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Impact: {rec.impact}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDismiss(rec.id)}
                >
                  ×
                </Button>
              </div>
              
              {rec.actionable && rec.actions && rec.actions.length > 0 && (
                <div className="flex gap-2 pl-8">
                  {rec.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={index === 0 ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        if (action.url) {
                          window.open(action.url, "_blank");
                        } else if (action.onClick) {
                          action.onClick();
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
      
      <div className="text-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setDismissedIds(new Set())}
        >
          Show dismissed ({dismissedIds.size})
        </Button>
      </div>
    </div>
  );
}