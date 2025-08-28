import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Markdown } from '@/components/common/layout/markdown';
import { Skeleton } from '@/components/ui/skeleton';
import { DocsToc } from './docs-toc';
import { DocsSEO } from './docs-seo';
import { DocsSidebar } from './docs-sidebar';
import { LastUpdated } from '@/components/ui/last-updated';
import { usePageTimestamp } from '@/hooks/use-data-timestamp';
import { DOCS_METADATA, fetchDocsContent } from './docs-loader';

/**
 * Individual documentation page component
 * Displays a single doc with proper TOC and navigation
 */
export function DocDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pageLoadedAt } = usePageTimestamp();

  // Find the doc metadata based on slug
  const docMeta = DOCS_METADATA.find((doc) => {
    const docSlug = doc.file.replace('.md', '').replace(/^(feature-|insight-)/, '');
    return docSlug === slug;
  });

  /**
   * Loads documentation content from the file system.
   * Fetches the markdown content for the current doc page and updates state.
   * Handles errors by setting an appropriate error message.
   */
  const loadDocContent = useCallback(async () => {
    if (!docMeta) return;

    try {
      setLoading(true);
      setError(null);

      const docContent = await fetchDocsContent(docMeta.file);
      setContent(docContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documentation');
    } finally {
      setLoading(false);
    }
  }, [docMeta]);

  useEffect(() => {
    if (!docMeta) {
      setError('Documentation page not found');
      setLoading(false);
      return;
    }

    loadDocContent();
  }, [docMeta, loadDocContent]);

  if (loading) {
    return (
      <div className="container px-4 py-8 mx-auto max-w-7xl">
        <div className="flex gap-8">
          <DocsSidebar />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-40 w-full" />
              </div>
              <div className="hidden lg:block">
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !docMeta) {
    return (
      <div className="container px-4 py-8 mx-auto max-w-7xl">
        <div className="flex gap-8">
          <DocsSidebar />
          <div className="flex-1 min-w-0">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Documentation Not Found</h2>
              <p className="text-muted-foreground mb-6">
                {error || 'The requested documentation page does not exist.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DocsSEO />
      <div className="container px-4 py-8 mx-auto max-w-7xl">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <DocsSidebar />

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
              {/* Main content */}
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h1>{docMeta.title}</h1>
                <p className="text-lg text-muted-foreground">{docMeta.description}</p>

                <Markdown>{content}</Markdown>

                <div className="mt-8 pt-8 border-t">
                  <LastUpdated timestamp={pageLoadedAt} />
                </div>
              </div>

              {/* Table of Contents - Fixed position on desktop */}
              <aside className="hidden lg:block">
                <div className="sticky top-20">
                  <DocsToc content={content} className="max-h-[calc(100vh-6rem)] overflow-y-auto" />
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
