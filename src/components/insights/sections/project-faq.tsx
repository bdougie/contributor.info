import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, HelpCircle } from '@/components/ui/icon';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { faqService } from "@/lib/llm/faq-service";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  confidence?: number;
  sources?: string[];
  isAIGenerated?: boolean;
  schema?: {
    "@type": string;
    name: string;
    acceptedAnswer: {
      "@type": string;
      text: string;
    };
  };
}

interface ProjectFAQProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function ProjectFAQ({ owner, repo, timeRange }: ProjectFAQProps) {
  const { stats } = useCachedRepoData(owner, repo, timeRange, false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [useAI, setUseAI] = useState(faqService.isAvailable());

  useEffect(() => {
    generateFAQs();
  }, [owner, repo, stats.pullRequests, timeRange, useAI]);

  const generateFAQs = async () => {
    if (!stats.pullRequests || stats.pullRequests.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (useAI) {
        // Use AI-powered FAQ generation
        const repositoryData = {
          pullRequests: stats.pullRequests
        };

        const aiAnswers = await faqService.generateFAQAnswers(
          owner,
          repo,
          timeRange,
          repositoryData
        );

        const aiFAQs: FAQ[] = aiAnswers.map(answer => ({
          id: answer.id,
          question: answer.question,
          answer: answer.answer,
          confidence: answer.confidence,
          sources: answer.sources,
          isAIGenerated: true,
          schema: {
            "@type": "Question",
            name: answer.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: answer.answer
            }
          }
        }));

        setFaqs(aiFAQs.slice(0, 8));
      } else {
        // Fallback to static FAQ generation
        generateStaticFAQs();
      }
    } catch (_error) {
      console.error('Failed to generate AI FAQs, falling back to static:', _error);
      setUseAI(false);
      generateStaticFAQs();
    }

    setLoading(false);
  };

  const generateStaticFAQs = () => {
    const generatedFAQs: FAQ[] = [
      {
        id: "contributor-count",
        question: `How many contributors does ${owner}/${repo} have?`,
        answer: generateContributorCountAnswer(),
        schema: {
          "@type": "Question",
          name: `How many contributors does ${owner}/${repo} have?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generateContributorCountAnswer()
          }
        }
      },
      {
        id: "top-contributors",
        question: `Who are the top contributors to ${owner}/${repo}?`,
        answer: generateTopContributorsAnswer(),
        schema: {
          "@type": "Question",
          name: `Who are the top contributors to ${owner}/${repo}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generateTopContributorsAnswer()
          }
        }
      },
      {
        id: "commit-frequency",
        question: `What is the commit frequency for ${owner}/${repo}?`,
        answer: generateCommitFrequencyAnswer(),
        schema: {
          "@type": "Question",
          name: `What is the commit frequency for ${owner}/${repo}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generateCommitFrequencyAnswer()
          }
        }
      },
      {
        id: "development-activity",
        question: `How active is ${owner}/${repo} development?`,
        answer: generateActivityAnswer(),
        schema: {
          "@type": "Question",
          name: `How active is ${owner}/${repo} development?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generateActivityAnswer()
          }
        }
      },
      {
        id: "recent-changes",
        question: `What are the recent changes in ${owner}/${repo}?`,
        answer: generateRecentChangesAnswer(),
        schema: {
          "@type": "Question",
          name: `What are the recent changes in ${owner}/${repo}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generateRecentChangesAnswer()
          }
        }
      },
      {
        id: "contributor-diversity",
        question: `How diverse is the contributor base of ${owner}/${repo}?`,
        answer: generateContributorDiversityAnswer(),
        schema: {
          "@type": "Question",
          name: `How diverse is the contributor base of ${owner}/${repo}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generateContributorDiversityAnswer()
          }
        }
      },
      {
        id: "pr-patterns",
        question: `What are the pull request patterns for ${owner}/${repo}?`,
        answer: generatePRPatternsAnswer(),
        schema: {
          "@type": "Question",
          name: `What are the pull request patterns for ${owner}/${repo}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: generatePRPatternsAnswer()
          }
        }
      }
    ];

    setFaqs(generatedFAQs.slice(0, 8)); // Limit to 8 FAQs
  };

  const generateContributorCountAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const uniqueContributors = new Set(stats.pullRequests.map(pr => pr.author?.login || pr.user?.login || 'unknown')).size;
    const timeRangeText = getTimeRangeText();
    
    let communityStatus: string;
    if (uniqueContributors >= 20) {
      communityStatus = 'a healthy and active';
    } else if (uniqueContributors >= 10) {
      communityStatus = 'a moderate';
    } else {
      communityStatus = 'a small but focused';
    }
    
    return `${uniqueContributors} unique contributors ${timeRangeText}. ${communityStatus.charAt(0).toUpperCase() + communityStatus.slice(1)} community.`;
  };

  const generateTopContributorsAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const contributorCounts = stats.pullRequests.reduce((acc, pr) => {
      const authorLogin = pr.author?.login || pr.user?.login || 'unknown';
      acc[authorLogin] = (acc[authorLogin] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topContributors = Object.entries(contributorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count} PRs)`);

    return `Top contributors: ${topContributors.join(', ')}.`;
  };

  const generateCommitFrequencyAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const totalPRs = stats.pullRequests.length;
    const timeRangeText = getTimeRangeText();
    const timeRangeDays = getTimeRangeDays();
    const avgPerWeek = (totalPRs / (timeRangeDays / 7)).toFixed(1);
    
    let activityLevel: string;
    const weeklyAvg = parseFloat(avgPerWeek);
    if (weeklyAvg >= 10) {
      activityLevel = 'high';
    } else if (weeklyAvg >= 3) {
      activityLevel = 'moderate';
    } else {
      activityLevel = 'low';
    }
    
    return `${totalPRs} PRs ${timeRangeText}. Average: ${avgPerWeek}/week. Activity level: ${activityLevel}.`;
  };

  const generateActivityAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const totalPRs = stats.pullRequests.length;
    const uniqueContributors = new Set(stats.pullRequests.map(pr => pr.author?.login || pr.user?.login || 'unknown')).size;
    const timeRangeText = getTimeRangeText();
    
    let activityLevel: string;
    if (totalPRs >= 50) {
      activityLevel = 'very active';
    } else if (totalPRs >= 20) {
      activityLevel = 'moderately active';
    } else {
      activityLevel = 'lightly active';
    }
    
    return `${activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1)}. ${totalPRs} PRs from ${uniqueContributors} contributors ${timeRangeText}.`;
  };

  const generateRecentChangesAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const recentPRs = stats.pullRequests.slice(0, 5);
    const recentTitles = recentPRs.map(pr => pr.title.substring(0, 60) + (pr.title.length > 60 ? '...' : ''));
    
    return `Recent: ${recentTitles.slice(0, 3).join('; ')}.`;
  };

  const generateContributorDiversityAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const contributorCounts = stats.pullRequests.reduce((acc, pr) => {
      const authorLogin = pr.author?.login || pr.user?.login || 'unknown';
      acc[authorLogin] = (acc[authorLogin] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const contributors = Object.values(contributorCounts);
    const totalContributors = contributors.length;
    const singlePRContributors = contributors.filter(count => count === 1).length;
    const diversityPercentage = ((singlePRContributors / totalContributors) * 100).toFixed(0);

    let diversityLevel: string;
    const diversityPercent = parseInt(diversityPercentage);
    if (diversityPercent >= 50) {
      diversityLevel = 'good';
    } else if (diversityPercent >= 25) {
      diversityLevel = 'moderate';
    } else {
      diversityLevel = 'limited';
    }
    
    return `${totalContributors} contributors. ${diversityPercentage}% are occasional contributors. Diversity: ${diversityLevel}.`;
  };

  const generatePRPatternsAnswer = (): string => {
    if (!stats.pullRequests) return "Data is still loading...";
    
    const featCount = stats.pullRequests.filter(pr => pr.title.toLowerCase().includes('feat')).length;
    const fixCount = stats.pullRequests.filter(pr => pr.title.toLowerCase().includes('fix')).length;
    
    const predominantType = featCount > fixCount ? 'feature development' : 'bug fixes and maintenance';
    
    return `${featCount} features, ${fixCount} fixes. Focus: ${predominantType}.`;
  };

  const getTimeRangeText = (): string => {
    switch (timeRange) {
      case '30d': return 'in the last 30 days';
      case '90d': return 'in the last 90 days';
      case '6m': return 'in the last 6 months';
      case '1y': return 'in the last year';
      default: return 'in the selected time period';
    }
  };

  const getTimeRangeDays = (): number => {
    switch (timeRange) {
      case '30d': return 30;
      case '90d': return 90;
      case '6m': return 180;
      case '1y': return 365;
      default: return 90;
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <div className="text-center py-4">
        <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No FAQ data available yet.
        </p>
      </div>
    );
  }

  // Generate FAQ schema markup
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => faq.schema).filter(Boolean)
  };

  return (
    <>
      {/* Add FAQ schema markup to document head */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema)
        }}
      />
      
      <div className="space-y-3">
        {faqs.map((faq) => (
          <Card key={faq.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-between h-auto p-0 text-left font-normal hover:bg-transparent"
                onClick={() => toggleExpanded(faq.id)}
              >
                <span className="text-sm font-medium pr-2 flex-1">
                  {faq.question}
                </span>
                {expandedItems.has(faq.id)
? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )
: (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </Button>
              
              {expandedItems.has(faq.id) && (
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                  {faq.isAIGenerated && faq.confidence && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span>AI confidence: {Math.round(faq.confidence * 100)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
        
        {useAI && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              AI-powered FAQ analysis • Updates with time range
            </p>
          </div>
        )}
      </div>
    </>
  );
}