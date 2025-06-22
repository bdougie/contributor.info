import { useState, useEffect } from "react";
import { Markdown } from "@/components/common/layout/markdown";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Book, FileText } from "lucide-react";
import { DocsNavigation } from "./docs-navigation";
import { DocsToc } from "./docs-toc";
import { DocsSEO } from "./docs-seo";

interface DocsSection {
  title: string;
  description: string;
  content: string;
  category: "feature" | "insight";
}

export function DocsPage() {
  const [docsContent, setDocsContent] = useState<DocsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | undefined>();

  useEffect(() => {
    loadDocsContent();
  }, []);

  const loadDocsContent = async () => {
    try {
      // Define all available documentation files with metadata
      const docFiles = [
        // Features
        {
          file: "feature-lottery-factor.md",
          title: "Lottery Factor",
          description: "Understanding repository health and contribution risk",
          category: "feature" as const,
        },
        {
          file: "feature-activity-feed.md",
          title: "Activity Feed",
          description: "Real-time tracking of repository and contributor activity",
          category: "feature" as const,
        },
        {
          file: "feature-authentication.md",
          title: "Authentication",
          description: "User authentication and GitHub integration",
          category: "feature" as const,
        },
        {
          file: "feature-contribution-analytics.md",
          title: "Contribution Analytics",
          description: "Advanced analytics for measuring contributor impact",
          category: "feature" as const,
        },
        {
          file: "feature-contributor-of-month.md",
          title: "Contributor of the Month",
          description: "Recognition system for outstanding contributors",
          category: "feature" as const,
        },
        {
          file: "feature-contributor-profiles.md",
          title: "Contributor Profiles",
          description: "Detailed profiles showcasing contributor achievements",
          category: "feature" as const,
        },
        {
          file: "feature-distribution-charts.md",
          title: "Distribution Charts",
          description: "Visual analysis of contribution patterns and trends",
          category: "feature" as const,
        },
        {
          file: "feature-repository-health.md",
          title: "Repository Health",
          description: "Comprehensive health metrics for repositories",
          category: "feature" as const,
        },
        {
          file: "feature-repository-search.md",
          title: "Repository Search",
          description: "Advanced search and filtering capabilities",
          category: "feature" as const,
        },
        {
          file: "feature-social-cards.md",
          title: "Social Cards",
          description: "Dynamic social media card generation",
          category: "feature" as const,
        },
        {
          file: "feature-time-range-analysis.md",
          title: "Time Range Analysis",
          description: "Historical analysis and trend identification",
          category: "feature" as const,
        },
        // Insights
        {
          file: "insight-pr-activity.md",
          title: "PR Activity",
          description: "Monitoring pull request patterns and team velocity",
          category: "insight" as const,
        },
        {
          file: "insight-needs-attention.md",
          title: "Needs Attention",
          description: "Identifying pull requests requiring immediate action",
          category: "insight" as const,
        },
        {
          file: "insight-recommendations.md",
          title: "Recommendations",
          description: "Actionable suggestions for repository improvement",
          category: "insight" as const,
        },
        {
          file: "insight-repository-health.md",
          title: "Repository Health",
          description: "Comprehensive analysis of repository wellness",
          category: "insight" as const,
        },
      ];

      // Load all documentation files
      const responses = await Promise.all(
        docFiles.map(doc => fetch(`/docs/${doc.file}`))
      );

      // Check if any requests failed
      const failedFiles = responses
        .map((response, index) => ({ response, file: docFiles[index].file }))
        .filter(({ response }) => !response.ok)
        .map(({ file }) => file);

      if (failedFiles.length > 0) {
        console.warn(`Failed to load documentation files: ${failedFiles.join(", ")}`);
      }

      // Get content for successfully loaded files
      const contents = await Promise.all(
        responses.map(async (response, index) => {
          if (response.ok) {
            return {
              ...docFiles[index],
              content: await response.text(),
            };
          }
          return null;
        })
      );

      // Filter out failed loads and create sections
      const sections: DocsSection[] = contents
        .filter((content): content is NonNullable<typeof content> => content !== null)
        .map(({ file, ...doc }) => doc);

      setDocsContent(sections);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const getNavigationEntries = (sections: DocsSection[]) => {
    return sections.map((section) => ({
      title: section.title,
      category: section.category,
      anchor: `section-${section.title.toLowerCase().replace(/\s+/g, "-")}`,
    }));
  };

  const getCategoryColor = (category: "feature" | "insight") => {
    return category === "feature"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
      : "bg-purple-500/10 text-purple-700 dark:text-purple-400";
  };

  const getCategoryIcon = (category: "feature" | "insight") => {
    return category === "feature" ? FileText : Book;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-2 space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-2">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Error Loading Documentation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const navigationEntries = getNavigationEntries(docsContent);

  return (
    <>
      <DocsSEO />
      <div className="max-w-7xl mx-auto py-2">
        {/* Mobile navigation - shows on top, full width */}
        <div className="lg:hidden mb-6">
          <DocsNavigation
            entries={navigationEntries}
            activeSection={activeSection}
            onSectionSelect={setActiveSection}
          />
        </div>

        <div className="flex gap-8">
          {/* Desktop navigation - shows on left side */}
          <aside className="hidden lg:block sticky top-8 h-fit">
            <DocsNavigation
              entries={navigationEntries}
              activeSection={activeSection}
              onSectionSelect={setActiveSection}
            />
          </aside>

          <main className="flex-1 max-w-4xl">
            <div className="flex gap-8">
              <div className="flex-1">
                <div className="space-y-6">
                  {docsContent.map((section, index) => {
                    const anchor = `section-${section.title
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`;
                    const IconComponent = getCategoryIcon(section.category);

                    return (
                      <Card key={index} id={anchor} className="overflow-hidden">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-2xl flex items-center gap-2">
                              <IconComponent className="h-6 w-6" />
                              {section.title}
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className={getCategoryColor(section.category)}
                            >
                              {section.category === "feature"
                                ? "Feature"
                                : "Insight"}
                            </Badge>
                          </div>
                          <CardDescription>
                            {section.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Markdown className="prose-sm max-w-none">
                            {section.content}
                          </Markdown>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {docsContent.length === 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>No Documentation Available</CardTitle>
                      <CardDescription>
                        Documentation sections are being prepared. Check back
                        soon!
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>

              <aside className="hidden xl:block sticky top-8 h-fit">
                {docsContent.length > 0 && (
                  <DocsToc
                    content={docsContent
                      .map((section) => section.content)
                      .join("\n\n")}
                  />
                )}
              </aside>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
