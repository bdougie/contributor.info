import { Link } from 'react-router-dom';
import { DocsSEO } from './docs-seo';
import { DocsSidebar } from './docs-sidebar';
import { DOCS_METADATA } from './docs-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Documentation list page with sidebar navigation and table layout
 */
export function DocsList() {
  const getDocSlug = (filename: string) => {
    return filename.replace('.md', '').replace(/^(feature-|insight-)/, '');
  };

  // Group docs by category
  const featureDocs = DOCS_METADATA.filter((doc) => doc.category === 'feature');
  const insightDocs = DOCS_METADATA.filter((doc) => doc.category === 'insight');

  return (
    <>
      <DocsSEO />
      <div className="container px-4 py-8 mx-auto max-w-7xl">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <DocsSidebar />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Documentation</h1>
              <p className="text-muted-foreground">
                Browse all features and insights available in contributor.info
              </p>
            </div>

            {/* Features Table */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold mb-4">Features</h2>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-medium">Name</TableHead>
                      <TableHead className="font-medium">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {featureDocs.map((doc) => {
                      const slug = getDocSlug(doc.file);
                      return (
                        <TableRow key={doc.file} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <Link to={`/docs/${slug}`} className="hover:underline">
                              {doc.title}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{doc.description}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Insights Table */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Insights</h2>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-medium">Name</TableHead>
                      <TableHead className="font-medium">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insightDocs.map((doc) => {
                      const slug = getDocSlug(doc.file);
                      return (
                        <TableRow key={doc.file} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <Link to={`/docs/${slug}`} className="hover:underline">
                              {doc.title}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{doc.description}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
