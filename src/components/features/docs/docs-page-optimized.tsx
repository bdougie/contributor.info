import { useState, useEffect, useCallback } from "react"
import { Book, FileText } from '@/components/ui/icon';
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
import { DocsNavigation } from "./docs-navigation";
import { DocsToc } from "./docs-toc";
import { DocsSEO } from "./docs-seo";
import { LastUpdated } from "@/components/ui/last-updated";
import { usePageTimestamp } from "@/hooks/use-data-timestamp";
import { DOCS_METADATA, fetchDocsContent, preloadDocs } from "./docs-loader";

interface DocsSection {
  title: string;
  description: string;
  content: string;
  category: "feature" | "insight";
}

/**
 * Optimized DocsPage that loads markdown content dynamically
 * This keeps the markdown files out of the JavaScript bundle
 */
export function DocsPageOptimized() {
  const [docsContent, setDocsContent] = useState<DocsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | undefined>();
  const [loadedFiles, setLoadedFiles] = useState<Set<string>>(new Set());
  
  // Track when the page was loaded for freshness indicator
  const { pageLoadedAt } = usePageTimestamp();

  // Load only the initially visible docs
  useEffect(() => {
    loadInitialDocs();
    // Preload other docs in the background
    preloadDocs();
  }, []);

  const loadInitialDocs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load only the first 3 docs initially for faster initial render
      const initialDocs = DOCS_METADATA.slice(0, 3);
      const sections: DocsSection[] = [];
      
      for (const doc of initialDocs) {
        try {
          const content = await fetchDocsContent(doc.file);
          sections.push({
            ...doc,
            content
          });
          setLoadedFiles(prev => new Set([...prev, doc.file]));
        } catch (err) {
          console.error(`Failed to load ${doc.file}:`, err);
        }
      }
      
      // Set initial content
      setDocsContent(sections);
      
      // Load remaining docs in the background
      loadRemainingDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documentation");
    } finally {
      setLoading(false);
    }
  };

  const loadRemainingDocs = useCallback(async () => {
    // Load the rest of the docs progressively
    const remainingDocs = DOCS_METADATA.slice(3);
    
    for (const doc of remainingDocs) {
      if (loadedFiles.has(doc.file)) continue;
      
      try {
        const content = await fetchDocsContent(doc.file);
        
        setDocsContent(prev => [...prev, {
          ...doc,
          content
        }]);
        
        setLoadedFiles(prev => new Set([...prev, doc.file]));
        
        // Small delay between loads to not block the main thread
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`Failed to load ${doc.file}:`, err);
      }
    }
  }, [loadedFiles]);

  // Intersection Observer for lazy loading docs as they come into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            setActiveSection(sectionId);
          }
        });
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );

    const sections = document.querySelectorAll('.docs-section');
    sections.forEach(section => observer.observe(section));

    return () => {
      sections.forEach(section => observer.unobserve(section));
    };
  }, [docsContent]);

  if (loading && docsContent.length === 0) {
    return <DocsLoadingSkeleton />;
  }

  if (_error) {
    return (
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Documentation</CardTitle>
            <CardDescription>{error: _error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const featureDocs = docsContent.filter(doc => doc.category === "feature");
  const insightDocs = docsContent.filter(doc => doc.category === "insight");

  return (
    <>
      <DocsSEO />
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="flex gap-8">
          {/* Left sidebar navigation */}
          <aside className="hidden lg:block w-64 shrink-0">
            <DocsNavigation 
              entries={docsContent.map(doc => ({
                title: doc.title,
                category: doc.category,
                anchor: doc.title.toLowerCase().replace(/\s+/g, '-')
              }))}
              activeSection={activeSection}
            />
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="space-y-8">
              {/* Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Book className="h-8 w-8 text-primary" />
                  <h1 className="text-4xl font-bold">Documentation</h1>
                </div>
                <p className="text-lg text-muted-foreground">
                  Learn about all the features and insights that contributor.info provides
                  to help you understand and analyze GitHub repositories.
                </p>
                <LastUpdated timestamp={pageLoadedAt} />
              </div>

              {/* Documentation sections */}
              <div className="space-y-12">
                {/* Features Section */}
                {featureDocs.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <FileText className="h-6 w-6 text-primary" />
                      <h2 className="text-2xl font-semibold">Features</h2>
                      <Badge variant="secondary">{featureDocs.length}</Badge>
                    </div>
                    <div className="space-y-8">
                      {featureDocs.map((section) => (
                        <Card key={section.title} id={section.title.toLowerCase().replace(/\s+/g, '-')} className="docs-section">
                          <CardHeader>
                            <CardTitle>{section.title}</CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Markdown>{section.content}</Markdown>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Insights Section */}
                {insightDocs.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <FileText className="h-6 w-6 text-primary" />
                      <h2 className="text-2xl font-semibold">Insights</h2>
                      <Badge variant="secondary">{insightDocs.length}</Badge>
                    </div>
                    <div className="space-y-8">
                      {insightDocs.map((section) => (
                        <Card key={section.title} id={section.title.toLowerCase().replace(/\s+/g, '-')} className="docs-section">
                          <CardHeader>
                            <CardTitle>{section.title}</CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Markdown>{section.content}</Markdown>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}
                
                {/* Loading indicator for remaining docs */}
                {docsContent.length < DOCS_METADATA.length && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Loading additional documentation...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Right sidebar TOC */}
          <aside className="hidden xl:block w-64 shrink-0">
            <DocsToc 
              content={docsContent.map(doc => doc.content).join('\n\n')} 
              className="sticky top-4"
            />
          </aside>
        </div>
      </div>
    </>
  );
}

function DocsLoadingSkeleton() {
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="flex gap-8">
        {/* Left sidebar skeleton */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </aside>

        {/* Main content skeleton */}
        <main className="flex-1">
          <div className="space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-full max-w-2xl" />
            </div>
            
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-md" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default DocsPageOptimized;