import { useState, useEffect } from 'react';
import { Markdown } from '@/components/common/layout/markdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Book, FileText } from 'lucide-react';
import { DocsNavigation } from './docs-navigation';
import { DocsSEO } from './docs-seo';

interface DocsSection {
  title: string;
  description: string;
  content: string;
  category: 'feature' | 'insight';
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
      // Load the markdown files for the two initial sections
      const [lotteryFactorResponse, prActivityResponse] = await Promise.all([
        fetch('/docs/feature-lottery-factor.md'),
        fetch('/docs/insight-pr-activity.md')
      ]);

      if (!lotteryFactorResponse.ok || !prActivityResponse.ok) {
        throw new Error('Failed to load documentation files');
      }

      const [lotteryFactorText, prActivityText] = await Promise.all([
        lotteryFactorResponse.text(),
        prActivityResponse.text()
      ]);

      const sections: DocsSection[] = [
        {
          title: 'Lottery Factor',
          description: 'Understanding repository health and contribution risk',
          content: lotteryFactorText,
          category: 'feature'
        },
        {
          title: 'PR Activity',
          description: 'Monitoring pull request patterns and team velocity',
          content: prActivityText,
          category: 'insight'
        }
      ];

      setDocsContent(sections);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const getNavigationEntries = (sections: DocsSection[]) => {
    return sections.map(section => ({
      title: section.title,
      category: section.category,
      anchor: `section-${section.title.toLowerCase().replace(/\s+/g, '-')}`
    }));
  };

  const getCategoryColor = (category: 'feature' | 'insight') => {
    return category === 'feature' 
      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      : 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
  };

  const getCategoryIcon = (category: 'feature' | 'insight') => {
    return category === 'feature' ? FileText : Book;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="space-y-4">
          {[1, 2].map(i => (
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
      <div className="max-w-4xl mx-auto py-8">
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
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Guide</h1>
          <p className="text-muted-foreground">
            Learn how to understand and effectively use contributor.info features to analyze repository health and team dynamics.
          </p>
        </div>

        <div className="flex gap-8">
          <aside className="sticky top-8 h-fit">
            <DocsNavigation 
              entries={navigationEntries}
              activeSection={activeSection}
              onSectionSelect={setActiveSection}
            />
          </aside>
          
          <main className="flex-1 max-w-4xl">
            <div className="space-y-6">
              {docsContent.map((section, index) => {
                const anchor = `section-${section.title.toLowerCase().replace(/\s+/g, '-')}`;
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
                          {section.category === 'feature' ? 'Feature' : 'Insight'}
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
                    Documentation sections are being prepared. Check back soon!
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </main>
        </div>
      </div>
    </>
  );
}