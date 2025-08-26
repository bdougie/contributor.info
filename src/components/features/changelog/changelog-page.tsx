import { useState, useEffect } from "react"
import { Package, Bug, Sparkles, Rss } from '@/components/ui/icon';
import { Markdown } from "@/components/common/layout/markdown";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangelogNavigation } from "./changelog-navigation";
import { ChangelogSEO } from "./changelog-seo";
import { LastUpdated } from "@/components/ui/last-updated";
import { usePageTimestamp } from "@/hooks/use-data-timestamp";

interface ChangelogEntry {
  version: string;
  date: string;
  content: string;
  versionLink?: string;
}

export function ChangelogPage() {
  const [changelogContent, setChangelogContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | undefined>();
  
  // Track when the page was loaded for freshness indicator
  const { pageLoadedAt } = usePageTimestamp();

  useEffect(() => {
    // For now, load the CHANGELOG.md file
    // In the future, this could load MDX files from a changelog directory
    fetch("/CHANGELOG.md")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load changelog");
        }
        return response.text();
      })
      .then((text) => {
        setChangelogContent(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const parseChangelog = (content: string): ChangelogEntry[] => {
    const entries: ChangelogEntry[] = [];
    // Simplified regex: matches ## [version](link) (date) or ## version (date)
    const versionRegex = /## \[([0-9.]+)\]\(([^)]+)\) \((.+?)\)|## ([0-9.]+) \((.+?)\)/g;
    const matches = [...content.matchAll(versionRegex)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      // For linked version: match[1]=version, match[2]=link, match[3]=date
      // For unlinked version: match[4]=version, match[5]=date
      const version = match[1] || match[4];
      const versionLink = match[2] || undefined;
      const date = match[3] || match[5];
      
      const startIndex = match.index! + match[0].length;
      const endIndex = matches[i + 1]?.index || content.length;
      const entryContent = content.slice(startIndex, endIndex).trim();

      entries.push({
        version,
        date,
        content: entryContent,
        versionLink,
      });
    }

    return entries;
  };

  const getNavigationEntries = (entries: ChangelogEntry[]) => {
    return entries.map((entry) => ({
      version: entry.version,
      date: entry.date,
      anchor: `version-${entry.version.replace(/\./g, "-")}`,
    }));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-2 space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (_error) {
    return (
      <div className="max-w-4xl mx-auto py-2">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Error Loading Changelog</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const renderIcon = (line: string) => {
    if (line.includes("Features") || line.includes("feat:"))
      return <Sparkles className="h-4 w-4" />;
    if (line.includes("Bug") || line.includes("fix:"))
      return <Bug className="h-4 w-4" />;
    if (line.includes("Dependencies") || line.includes("chore:"))
      return <Package className="h-4 w-4" />;
    return null;
  };

  const getTypeColor = (content: string) => {
    if (content.includes("Features"))
      return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (content.includes("Bug"))
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    if (content.includes("Breaking"))
      return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  };

  const changelogEntries = parseChangelog(changelogContent);
  const navigationEntries = getNavigationEntries(changelogEntries);

  return (
    <>
      <ChangelogSEO 
        date={changelogEntries[0]?.date}
        version={changelogEntries[0]?.version}
      />
      <div className="max-w-7xl mx-auto py-2">
        {/* Mobile navigation - shows on top, full width */}
        <div className="lg:hidden mb-6">
          <ChangelogNavigation
            entries={navigationEntries}
            activeVersion={activeVersion}
            onVersionSelect={setActiveVersion}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Desktop navigation - shows on left side */}
          <aside className="hidden lg:block lg:sticky lg:top-6 lg:h-fit lg:min-h-0 lg:shrink-0">
            <ChangelogNavigation
              entries={navigationEntries}
              activeVersion={activeVersion}
              onVersionSelect={setActiveVersion}
              className="lg:max-h-[calc(100vh-6rem)]"
            />
          </aside>

          <main className="flex-1">
            <div className="flex gap-8">
              <div className="flex-1">
                {/* Add page freshness indicator */}
                <div className="mb-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Changelog</h1>
                    <div className="flex items-center gap-4">
                      <LastUpdated 
                        timestamp={pageLoadedAt}
                        label="Page loaded"
                        size="sm"
                        showIcon={true}
                      />
                      {changelogEntries.length > 0 && (
                        <LastUpdated 
                          timestamp={changelogEntries[0].date}
                          label="Latest release"
                          size="sm"
                          showIcon={true}
                          className="text-primary"
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Track all updates, new features, and improvements. Subscribe to our{' '}
                    <a href="/changelog-rss.xml" className="text-primary hover:underline">RSS</a> or{' '}
                    <a href="/changelog-atom.xml" className="text-primary hover:underline">Atom</a> feeds for real-time updates.
                  </p>
                </div>
                
            <div className="space-y-6">
              {changelogEntries.map((entry, index) => {
                const sections = entry.content.split("###").filter(Boolean);
                const anchor = `version-${entry.version.replace(/\./g, "-")}`;

                return (
                  <Card key={index} id={anchor} className="overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        {entry.versionLink
? (
                          <a
                            href={entry.versionLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                          >
                            v{entry.version}
                          </a>
                        )
: (
                          <span>v{entry.version}</span>
                        )}
                        <span className="text-lg text-muted-foreground font-normal">
                          (
                          {new Date(entry.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          )
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {sections.map((section, sectionIndex) => {
                        const lines = section.trim().split("\n");
                        const title = lines[0].trim();
                        const content = lines.slice(1).join("\n");
                        const icon = renderIcon(title);

                        return (
                          <div key={sectionIndex} className="space-y-3">
                            <div className="flex items-center gap-2">
                              {icon}
                              <h3 className="font-semibold text-lg">{title}</h3>
                              <Badge
                                variant="secondary"
                                className={getTypeColor(title)}
                              >
                                {content.split("*").filter(Boolean).length - 1}{" "}
                                changes
                              </Badge>
                            </div>
                            <div className="pl-6">
                              <Markdown className="prose-sm">
                                {content}
                              </Markdown>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
              </div>

              {changelogEntries.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Changelog Entries</CardTitle>
                    <CardDescription>
                      No changelog entries are available yet. Check back soon for
                      updates!
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
            
            <aside className="hidden xl:block sticky top-8 h-fit">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/changelog-rss.xml", "_blank")}
              >
                <Rss className="h-4 w-4 mr-2" />
                Subscribe to RSS
              </Button>
            </aside>
          </div>
          </main>
        </div>
      </div>
    </>
  );
}
