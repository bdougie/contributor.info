import { useState } from "react";
import { Star, MessageSquare, RotateCcw, CheckCircle, TrendingUp, Users, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ContributorConfidenceLearnMoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContributorConfidenceLearnMore({ 
  open, 
  onOpenChange 
}: ContributorConfidenceLearnMoreProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'interpretation' | 'tips'>('overview');

  const confidenceLevels = [
    {
      range: "71-100%",
      level: "Welcoming",
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
      description: "Your project is welcoming!",
      detail: "Many stargazers and forkers come back later on to make a meaningful contribution",
      characteristics: [
        "Clear contribution guidelines",
        "Active maintainer engagement", 
        "Good documentation",
        "Welcoming community culture"
      ]
    },
    {
      range: "51-70%",
      level: "Approachable", 
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Your project is approachable!",
      detail: "Some stargazers and forkers come back later on to make a meaningful contribution",
      characteristics: [
        "Good documentation exists",
        "Moderate barrier to entry",
        "Some community activity",
        "Room for improvement in onboarding"
      ]
    },
    {
      range: "31-50%",
      level: "Challenging",
      color: "bg-orange-500", 
      textColor: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Your project is challenging",
      detail: "Few stargazers and forkers come back later on to make a meaningful contribution",
      characteristics: [
        "Complex codebase or domain",
        "Limited contribution guidance",
        "High technical barrier",
        "Inconsistent maintainer response"
      ]
    },
    {
      range: "0-30%",
      level: "Intimidating",
      color: "bg-red-500",
      textColor: "text-red-600", 
      bgColor: "bg-red-50",
      description: "Your project can be intimidating",
      detail: "Almost no stargazers and forkers come back later on to make a meaningful contribution",
      characteristics: [
        "Very high technical barrier",
        "Lack of documentation",
        "No clear contribution path",
        "Inactive or unwelcoming community"
      ]
    }
  ];

  const factors = [
    {
      name: "Star/Fork Conversion",
      weight: 35,
      icon: Star,
      description: "Percentage of users who starred or forked your repository and later became contributors",
      calculation: "Tracks users who show initial interest and convert to active participation",
      improvement: [
        "Add clear CONTRIBUTING.md file",
        "Create 'good first issue' labels", 
        "Respond promptly to new contributors",
        "Provide setup documentation"
      ]
    },
    {
      name: "Comment Engagement",
      weight: 25, 
      icon: MessageSquare,
      description: "Percentage of users who comment on issues/PRs and later contribute code",
      calculation: "Measures conversion from discussion participation to code contribution",
      improvement: [
        "Encourage discussion on issues",
        "Ask for help implementing features",
        "Thank commenters and guide them",
        "Break down complex issues"
      ]
    },
    {
      name: "Contributor Retention", 
      weight: 25,
      icon: RotateCcw,
      description: "Percentage of contributors who return to make additional contributions",
      calculation: "Tracks repeat contributions over different time windows",
      improvement: [
        "Acknowledge all contributions",
        "Provide feedback on PRs quickly",
        "Suggest related issues to work on",
        "Create contributor onboarding"
      ]
    },
    {
      name: "Contribution Quality",
      weight: 15,
      icon: CheckCircle, 
      description: "Percentage of contributions that are successfully merged",
      calculation: "Measures PR acceptance rate and overall code quality",
      improvement: [
        "Provide clear PR templates",
        "Set up automated testing",
        "Give constructive code review",
        "Document coding standards"
      ]
    }
  ];

  const TabButton = ({ label, isActive, onClick }: { 
    label: string; 
    isActive: boolean; 
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Contributor Confidence
          </DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <TabButton 
            label="Overview" 
            isActive={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <TabButton 
            label="Confidence Factors" 
            isActive={activeTab === 'factors'} 
            onClick={() => setActiveTab('factors')} 
          />
          <TabButton 
            label="Score Interpretation" 
            isActive={activeTab === 'interpretation'} 
            onClick={() => setActiveTab('interpretation')} 
          />
          <TabButton 
            label="Improvement Tips" 
            isActive={activeTab === 'tips'} 
            onClick={() => setActiveTab('tips')} 
          />
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">What is Contributor Confidence?</h3>
                <p className="text-muted-foreground mb-4">
                  Contributor Confidence measures how likely people who show interest in your repository 
                  (by starring, forking, or commenting) are to return and make meaningful contributions. 
                  It's a key indicator of your project's approachability and community health.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Why It Matters</h4>
                      <p className="text-blue-700 text-sm">
                        High contributor confidence indicates your project is welcoming, well-documented, 
                        and easy to contribute to. This leads to more sustained community growth and 
                        better long-term project health.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">How It's Calculated</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {factors.slice(0, 4).map((factor) => {
                    const Icon = factor.icon;
                    return (
                      <div key={factor.name} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{factor.name}</span>
                          <Badge variant="outline">{factor.weight}%</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{factor.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'factors' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Confidence Factors in Detail</h3>
                <p className="text-muted-foreground mb-6">
                  Each factor contributes to your overall confidence score with different weights, 
                  reflecting their relative importance in measuring project approachability.
                </p>
              </div>

              <div className="space-y-6">
                {factors.map((factor) => {
                  const Icon = factor.icon;
                  return (
                    <div key={factor.name} className="border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{factor.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Weighted at {factor.weight}% of total score
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">{factor.weight}%</Badge>
                      </div>
                      
                      <p className="text-muted-foreground mb-4">{factor.description}</p>
                      
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h5 className="font-medium mb-2">How it's measured:</h5>
                        <p className="text-sm text-muted-foreground">{factor.calculation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'interpretation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Understanding Your Score</h3>
                <p className="text-muted-foreground mb-6">
                  Your confidence score falls into one of four categories, each indicating different 
                  levels of project approachability and community engagement.
                </p>
              </div>

              <div className="space-y-4">
                {confidenceLevels.map((level) => (
                  <div key={level.level} className={`border rounded-lg p-6 ${level.bgColor}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${level.color}`} />
                        <div>
                          <h4 className={`font-semibold ${level.textColor}`}>
                            {level.description}
                          </h4>
                          <p className="text-sm font-medium text-muted-foreground">
                            Score range: {level.range}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-4">{level.detail}</p>
                    
                    <div>
                      <h5 className="font-medium mb-2">Typical characteristics:</h5>
                      <ul className="space-y-1">
                        {level.characteristics.map((char, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                            {char}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Improving Your Confidence Score</h3>
                <p className="text-muted-foreground mb-6">
                  Here are specific actions you can take to make your project more approachable 
                  and increase contributor confidence.
                </p>
              </div>

              <div className="space-y-6">
                {factors.map((factor) => {
                  const Icon = factor.icon;
                  return (
                    <div key={factor.name} className="border rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-semibold">Improving {factor.name}</h4>
                      </div>
                      
                      <div className="space-y-2">
                        {factor.improvement.map((tip, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                              <span className="text-xs font-medium text-primary">{index + 1}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900 mb-2">Quick Wins</h4>
                    <ul className="space-y-1 text-sm text-green-700">
                      <li>• Add a clear README with setup instructions</li>
                      <li>• Create issue templates for bug reports and features</li>
                      <li>• Label issues with difficulty levels (beginner, intermediate, advanced)</li>
                      <li>• Respond to first-time contributors within 24 hours</li>
                      <li>• Set up automated testing and clear PR guidelines</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}